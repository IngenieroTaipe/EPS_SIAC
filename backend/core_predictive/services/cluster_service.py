# core_predictive/services/cluster_service.py

from core_predictive.models import ThresholdsNaturalPhenomena
import logging
from typing import List, Tuple, Dict, Any
from django.db import connection, transaction
from django.contrib.gis.geos import GEOSGeometry

from core_predictive.models import GFSRequest, GFSClusterSnapshot, Threshold
from core_predictive.constants import (
    LOCAL_MORAN_NEIGHBOR_DISTANCE,
    MIN_ACTIVE_INTENSITY,
    DBSCAN_EPS_DEGREES,
    MIN_CELLS_PER_CLUSTER
)
logger = logging.getLogger(__name__)


class SpatialClusteringService:
    """
    Servicio de Clustering y Clasificación de Umbrales (Etapa 2):
    Segrega el pipeline espacial en fases atómicas:
    Consulta DBSCAN/PostGIS -> Clasificación de Negocio -> Persistencia Atómica.
    """

    DBSCAN_EPS_DEGREES = 0.15
    MIN_CELLS_PER_CLUSTER = 2

    @classmethod
    def generate_and_persist_clusters(
        cls, 
        gfs_request_id: int, 
        target_variable_id: int,
        natural_phenomena_id: int
    ) -> int:
        """
        Método Orquestador Delgado (Thin Pipeline Coordinator).

        `@params`:
            - gfs_request_id: ID de la solicitud GFS.
            - target_variable_id: ID de la variable objetivo.
            - natural_phenomena_id: ID del fenómeno natural.

        `@return`:
            - Número de clústeres generados y persistidos.
        """
        logger.info(f"[Cluster Engine] Iniciando orquestación de clústeres para GFSRequest #{gfs_request_id}...")

        gfs_request = cls._get_request_instance(gfs_request_id)
        if not gfs_request:
            return 0

        # === Matriz de umbrales ordenados ===
        thresholds = cls._get_thresholds(target_variable_id, natural_phenomena_id)

        # === Geoprocesamiento Espacial en PostGIS ===
        raw_cluster_rows = cls._execute_spatial_local_getis_ord_query(gfs_request_id)

        # === Transformación de Dominio y Clasificación de Peligro ===
        cluster_objects = cls._build_and_classify_snapshots(gfs_request, raw_cluster_rows, thresholds)

        # === Persistencia Atómica Transaccional en Base de Datos ===
        return cls._persist_cluster_snapshots(gfs_request, cluster_objects)

    # =========================================================================
    # MÉTODOS PRIVADOS ESPECIALIZADOS (SEGREGACIÓN DE RESPONSABILIDADES)
    # =========================================================================

    @staticmethod
    def _get_request_instance(gfs_request_id: int) -> GFSRequest | None:
        """ Sub-método 1: Recupera la entidad padre de la base de datos. """
        try:
            return GFSRequest.objects.get(pk=gfs_request_id)
        except GFSRequest.DoesNotExist:
            logger.error(f"[Cluster Engine Error] No existe GFSRequest ID #{gfs_request_id}")
            return None

    @staticmethod
    def _get_thresholds(target_variable_id: int, natural_phenomena_id: int) -> Dict[str, List[Dict]]:
        """
        Sub-método 1: Carga en memoria las reglas de umbrales ordenadas de mayor a menor 
        severidad (min_value DESC) agrupadas por el ID de distrito (UBIGEO).

        @return: Un diccionario donde la clave es el UBIGEO y el valor es una lista de umbrales ordenados.
        @rtype: Dict[str, List[Dict]]
        """
        rules_qs = ThresholdsNaturalPhenomena.objects.filter(
            variable_id=target_variable_id,
            natural_phenomena_id=natural_phenomena_id
        ).select_related('district', 'threshold').order_by('district_id', '-min_value') # Orden ascendente en base al id de distritos, pero descendente en base al min_value.

        district_rules_map = {}
        for rule in rules_qs:
            ubigeo = str(rule.district_id)
            district_rules_map.setdefault(ubigeo, []).append({
                "min_value": rule.min_value if rule.min_value is not None else 0.0,
                "threshold_id": rule.threshold.id,
                "threshold_name": rule.threshold.name
            })
        return district_rules_map

    @classmethod
    def _execute_spatial_dbscan_query(cls, gfs_request_id: int) -> List[Tuple]:
        """
        Sub-método 3: Ejecuta la consulta SQL/PostGIS de agrupación y disolución espacial.
        Responsabilidad única: Cómputo Geodésico C/C++ en PostGIS.
        """
        cluster_query = """
            WITH numbered_cells AS (
                SELECT 
                    c.id AS cell_id,
                    c.geometry,
                    c.timestamps->>(idx - 1) AS timestamp_utc,
                    (c.intensity_series->>(idx - 1))::float AS intensity,
                    idx AS time_step
                FROM gfs_active_cells c,
                     generate_series(1, jsonb_array_length(c.intensity_series)) AS idx
                WHERE c.gfs_request_id = %s
            ),
            filtered_cells AS (
                SELECT * FROM numbered_cells WHERE intensity > 0.0
            ),
            clustered AS (
                SELECT 
                    cell_id,
                    geometry,
                    intensity,
                    timestamp_utc,
                    time_step,
                    ST_ClusterDBSCAN(geometry, eps := %s, minpoints := %s) OVER (
                        PARTITION BY time_step ORDER BY cell_id
                    ) AS cluster_id
                FROM filtered_cells
            ),
            dissolved_clusters AS (
                SELECT 
                    time_step,
                    timestamp_utc,
                    cluster_id,
                    COUNT(cell_id) AS total_cells,
                    ROUND(MAX(intensity)::numeric, 2) AS max_intensity,
                    ROUND(AVG(intensity)::numeric, 2) AS avg_intensity,
                    ST_Multi(ST_Union(geometry)) AS geom
                FROM clustered
                WHERE cluster_id IS NOT NULL
                GROUP BY time_step, timestamp_utc, cluster_id
            )
            -- Intersección con la tabla de distritos
            SELECT 
                dc.time_step,
                dc.timestamp_utc,
                dc.cluster_id,
                dc.total_cells,
                dc.max_intensity,
                dc.avg_intensity,
                ST_AsText(dc.geom) AS wkt_geometry,
                COALESCE(array_agg(DISTINCT d.ubigeo), ARRAY[]::varchar[]) AS intersected_ubigeos
            FROM dissolved_clusters dc
            LEFT JOIN districts d ON ST_Intersects(dc.geom, d.geometry)
            GROUP BY dc.time_step, dc.timestamp_utc, dc.cluster_id, dc.total_cells, dc.max_intensity, dc.avg_intensity, dc.geom
            ORDER BY dc.time_step, dc.cluster_id;
        """

        try:
            with connection.cursor() as cursor:
                cursor.execute(cluster_query, [
                    gfs_request_id, 
                    cls.DBSCAN_EPS_DEGREES, 
                    cls.MIN_CELLS_PER_CLUSTER
            ])
                results = cursor.fetchall()
                logger.info(f"[PostGIS DBSCAN Query] Filas obtenidas de la base de datos: {len(results)}")
                return results

        except Exception as e:
            logger.error(f"[PostGIS Error] Falló la ejecución del query de clústeres: {str(e)}")
            return []

    @classmethod
    def _execute_spatial_local_morans_hotspot_query(
        cls,
        gfs_request_id: int,
    ) -> list[tuple]:
        """
        Ejecuta Local Moran's I en PostGIS para detectar hotspots High-High.

        Optimizaciones:
        1. Filtra intensidades bajas antes de calcular vecindades.
        2. Calcula estadísticas globales una sola vez por paso temporal.
        3. Evita funciones de ventana dentro de agregaciones.
        4. Usa centroides para calcular vecindades.
        5. Limita la vecindad a un radio espacial.
        6. Solo disuelve geometrías clasificadas como hotspots.
        """

        sql = """
        WITH

        /* ==========================================================
        1. Expandir las series JSON únicamente para el request
        ========================================================== */
        temporal_cells AS (
            SELECT
                c.id AS cell_id,
                c.geometry,
                ST_Centroid(c.geometry) AS centroid,

                idx AS time_step,

                c.timestamps ->> (idx - 1) AS timestamp_utc,

                (c.intensity_series ->> (idx - 1))::double precision
                    AS intensity

            FROM gfs_active_cells c

            CROSS JOIN LATERAL generate_series(
                1,
                jsonb_array_length(c.intensity_series)
            ) AS idx

            WHERE c.gfs_request_id = %s
        ),

        /* ==========================================================
        2. Eliminar valores nulos o inferiores al mínimo
        ========================================================== */
        active_cells AS (
            SELECT *
            FROM temporal_cells
            WHERE intensity IS NOT NULL
            AND intensity >= %s
        ),

        /* ==========================================================
        3. Calcular estadísticas una sola vez por hora
        ========================================================== */
        time_statistics AS (
            SELECT
                time_step,

                COUNT(*) AS total_active_cells,

                AVG(intensity) AS mean_intensity,

                VAR_POP(intensity) AS variance_intensity

            FROM active_cells

            GROUP BY time_step

            HAVING COUNT(*) >= 3
            AND VAR_POP(intensity) > 0
        ),

        /* ==========================================================
        4. Estandarizar intensidades
        z = x - media

        Se utiliza la desviación respecto a la media, porque
        Local Moran trabaja sobre valores centrados.
        ========================================================== */
        centered_cells AS (
            SELECT
                ac.*,

                ts.mean_intensity,

                ts.variance_intensity,

                (
                    ac.intensity - ts.mean_intensity
                ) AS centered_intensity

            FROM active_cells ac

            INNER JOIN time_statistics ts
                ON ts.time_step = ac.time_step
        ),

        /* ==========================================================
        5. Construir vecindades espaciales

        Se usa ST_DWithin sobre centroides.

        El operador && ayuda al planificador a utilizar el índice
        espacial de las geometrías originales.

        No se incluye la propia celda.
        ========================================================== */
        spatial_neighbors AS (
            SELECT
                a.time_step,

                a.cell_id AS source_cell_id,

                a.intensity AS source_intensity,

                a.centered_intensity AS source_centered,

                b.cell_id AS neighbor_cell_id,

                b.intensity AS neighbor_intensity,

                b.centered_intensity AS neighbor_centered

            FROM centered_cells a

            INNER JOIN centered_cells b

                ON b.time_step = a.time_step

            AND b.cell_id <> a.cell_id

            AND ST_DWithin(
                    a.centroid,
                    b.centroid,
                    %s
            )
        ),

        /* ==========================================================
        6. Calcular la suma ponderada de los vecinos

        Peso binario:
        w_ij = 1 si es vecino
        w_ij = 0 si no es vecino
        ========================================================== */
        local_neighbor_statistics AS (
            SELECT
                time_step,

                source_cell_id,

                MAX(source_intensity)
                    AS intensity,

                MAX(source_centered)
                    AS centered_intensity,

                COUNT(*) AS neighbor_count,

                SUM(neighbor_centered)
                    AS neighbor_centered_sum

            FROM spatial_neighbors

            GROUP BY
                time_step,
                source_cell_id
        ),

        /* ==========================================================
        7. Calcular Local Moran's I

        I_i =
            (x_i - media)
            ----------------
                varianza

            × suma de vecinos:
                w_ij (x_j - media)

        ========================================================== */
        local_moran AS (
            SELECT
                lns.time_step,

                lns.source_cell_id AS cell_id,

                lns.intensity,

                lns.neighbor_count,

                (
                    lns.centered_intensity
                    /
                    ts.variance_intensity
                )
                *
                lns.neighbor_centered_sum
                    AS local_moran_i

            FROM local_neighbor_statistics lns

            INNER JOIN time_statistics ts
                ON ts.time_step = lns.time_step

            WHERE lns.neighbor_count > 0
            AND ts.variance_intensity > 0
        ),

        /* ==========================================================
        8. Clasificar High-High

        Condiciones:

        - Intensidad de la celda > media.
        - Promedio de vecinos > media.
        - Local Moran I > 0.

        ========================================================== */
        hotspots AS (
            SELECT
                lm.time_step,

                lm.cell_id,

                lm.intensity,

                lm.local_moran_i

            FROM local_moran lm

            INNER JOIN time_statistics ts
                ON ts.time_step = lm.time_step

            INNER JOIN local_neighbor_statistics lns
                ON lns.time_step = lm.time_step
            AND lns.source_cell_id = lm.cell_id

            WHERE lm.intensity > ts.mean_intensity

            AND (
                lns.neighbor_centered_sum
                /
                NULLIF(
                    lns.neighbor_count,
                    0
                )
            ) > 0

            AND lm.local_moran_i > 0
        ),

        /* ==========================================================
        9. Recuperar geometrías únicamente de hotspots
        ========================================================== */
        hotspot_geometries AS (
            SELECT
                h.time_step,

                h.cell_id,

                h.intensity,

                h.local_moran_i,

                ac.geometry

            FROM hotspots h

            INNER JOIN active_cells ac
                ON ac.cell_id = h.cell_id
            AND ac.time_step = h.time_step
        ),

        /* ==========================================================
        10. Agrupar hotspots contiguos

        ST_ClusterDBSCAN se ejecuta únicamente sobre hotspots,
        no sobre todas las celdas activas.

        eps debe configurarse según la resolución del modelo.

        ========================================================== */
        hotspot_clusters AS (
            SELECT
                hg.*,

                ST_ClusterDBSCAN(
                    hg.geometry,
                    eps := %s,
                    minpoints := %s
                ) OVER (
                    PARTITION BY hg.time_step
                    ORDER BY hg.cell_id
                ) AS cluster_id

            FROM hotspot_geometries hg
        ),

        /* ==========================================================
        11. Disolver únicamente los clusters finales

        ST_UnaryUnion(ST_Collect(...)) suele ser más eficiente
        que ejecutar ST_Union repetidamente.
        ========================================================== */
        dissolved_hotspots AS (
            SELECT
                hc.time_step,

                hc.cluster_id,

                COUNT(*) AS total_cells,

                ROUND(
                    MAX(hc.intensity)::numeric,
                    2
                ) AS max_intensity,

                ROUND(
                    AVG(hc.intensity)::numeric,
                    2
                ) AS avg_intensity,

                ROUND(
                    MAX(hc.local_moran_i)::numeric,
                    5
                ) AS max_local_moran_i,

                ST_UnaryUnion(
                    ST_Collect(hc.geometry)
                ) AS geometry

            FROM hotspot_clusters hc

            WHERE hc.cluster_id IS NOT NULL

            GROUP BY
                hc.time_step,
                hc.cluster_id
        ),

        /* ==========================================================
        12. Obtener timestamp sin repetir el procesamiento
        ========================================================== */
        time_labels AS (
            SELECT DISTINCT
                time_step,
                timestamp_utc
            FROM active_cells
        )

        /* ==========================================================
        13. Resultado final
        ========================================================== */
        SELECT
            dh.time_step,

            tl.timestamp_utc,

            dh.cluster_id,

            dh.total_cells,

            dh.max_intensity,

            dh.avg_intensity,

            dh.max_local_moran_i,

            ST_AsText(
                ST_Multi(dh.geometry)
            ) AS wkt_geometry

        FROM dissolved_hotspots dh

        INNER JOIN time_labels tl
            ON tl.time_step = dh.time_step

        ORDER BY
            dh.time_step,
            dh.cluster_id;
        """

        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    sql,
                    [
                        gfs_request_id,
                        MIN_ACTIVE_INTENSITY,
                        LOCAL_MORAN_NEIGHBOR_DISTANCE,
                        DBSCAN_EPS_DEGREES,
                        MIN_CELLS_PER_CLUSTER,
                    ],
                )

                results = cursor.fetchall()
                logger.info(f"[PostGIS Local Moran's I Query] Filas obtenidas de la base de datos: {len(results)}")
                return results

        except Exception as e:
            logger.exception(
                f"[PostGIS Error] Falló la ejecución del query "
                f"de Local Moran's I: {str(e)}"
            )
            return []
    
    @classmethod
    def _execute_spatial_local_getis_ord_query(
        cls,
        gfs_request_id: int
    ) -> List[Tuple]:
        """
        Sub-método de Geoprocesamiento Avanzado: Getis-Ord Gi* + DBSCAN.
        Complejidad Cómputo: O(N log N) soportado en índice GiST Bounding Box (&&).
        """
        cluster_query = """
            WITH numbered_cells AS (
                SELECT 
                    c.id AS cell_id,
                    c.geometry,
                    CASE 
                        WHEN jsonb_typeof(c.timestamps->(idx - 1)) = 'number' THEN 
                            to_timestamp((c.timestamps->>(idx - 1))::double precision) AT TIME ZONE 'UTC'
                        ELSE 
                            ((c.timestamps->>(idx - 1))::timestamp) AT TIME ZONE 'UTC'
                    END AS timestamp_utc,
                    (c.intensity_series->>(idx - 1))::float AS intensity,
                    idx AS time_step
                FROM gfs_active_cells c,
                     generate_series(1, jsonb_array_length(c.intensity_series)) AS idx
                WHERE c.gfs_request_id = %s
            ),
            filtered_cells AS (
                SELECT * FROM numbered_cells WHERE intensity > 0.0
            ),
            global_stats AS (
                SELECT 
                    time_step,
                    COUNT(*)::float AS n,
                    AVG(intensity)::float AS global_avg,
                    STDDEV(intensity)::float AS global_stddev
                FROM filtered_cells
                GROUP BY time_step
            ),
            getis_ord AS (
                SELECT 
                    fc.cell_id,
                    fc.geometry,
                    fc.time_step,
                    fc.timestamp_utc,
                    fc.intensity,
                    gs.global_avg,
                    gs.global_stddev,
                    gs.n,
                    COALESCE(SUM(sub.intensity), 0.0) AS local_sum,
                    COUNT(sub.cell_id) AS local_count
                FROM filtered_cells fc
                JOIN global_stats gs ON gs.time_step = fc.time_step
                LEFT JOIN filtered_cells sub 
                       ON sub.time_step = fc.time_step
                      AND sub.geometry && fc.geometry
                      AND ST_DWithin(sub.geometry, fc.geometry, 0.15)
                GROUP BY fc.cell_id, fc.geometry, fc.time_step, fc.timestamp_utc, fc.intensity, gs.global_avg, gs.global_stddev, gs.n
            ),
            z_scores AS (
                SELECT 
                    cell_id,
                    geometry,
                    time_step,
                    timestamp_utc,
                    intensity,
                    CASE 
                        WHEN global_stddev > 0 AND local_count > 0 THEN
                            (local_sum - (global_avg * local_count)) / 
                            (global_stddev * SQRT(( (n * local_count) - (local_count * local_count) ) / (n - 1)))
                        ELSE 0
                    END AS gi_z_score
                FROM getis_ord
            ),
            hotspots AS (
                SELECT * 
                FROM z_scores 
                WHERE gi_z_score >= 1.65
            ),
            clustered AS (
                SELECT 
                    cell_id,
                    geometry,
                    time_step,
                    timestamp_utc,
                    intensity,
                    ST_ClusterDBSCAN(geometry, eps := %s, minpoints := %s) OVER (
                        PARTITION BY time_step ORDER BY cell_id
                    ) AS cluster_id
                FROM hotspots
            ),
            dissolved_clusters AS (
                SELECT 
                    time_step,
                    timestamp_utc,
                    cluster_id,
                    COUNT(cell_id) AS total_cells,
                    ROUND(MAX(intensity)::numeric, 2) AS max_intensity,
                    ROUND(AVG(intensity)::numeric, 2) AS avg_intensity,
                    ST_Multi(ST_Union(geometry)) AS geom
                FROM clustered
                WHERE cluster_id IS NOT NULL
                GROUP BY time_step, timestamp_utc, cluster_id
            )
            SELECT 
                dc.time_step,
                dc.timestamp_utc,
                dc.cluster_id,
                dc.total_cells,
                dc.max_intensity,
                dc.avg_intensity,
                ST_AsText(dc.geom) AS wkt_geometry,
                COALESCE(array_remove(array_agg(DISTINCT d.ubigeo), NULL), ARRAY[]::varchar[]) AS intersected_ubigeos
            FROM dissolved_clusters dc
            LEFT JOIN districts d ON dc.geom && d.geometry AND ST_Intersects(dc.geom, d.geometry)
            GROUP BY dc.time_step, dc.timestamp_utc, dc.cluster_id, dc.total_cells, dc.max_intensity, dc.avg_intensity, dc.geom
            ORDER BY dc.time_step, dc.cluster_id;
        """
        try:
            with connection.cursor() as cursor:
                cursor.execute(cluster_query, [
                    gfs_request_id, 
                    cls.DBSCAN_EPS_DEGREES, 
                    cls.MIN_CELLS_PER_CLUSTER
                ])
                results = cursor.fetchall()
                logger.info(f"[PostGIS Getis-Ord Query] Filas obtenidas exitosamente: {len(results)}")
                return results if results is not None else []

        except Exception as e:
            logger.error(f"[PostGIS Error] Falló la ejecución del query Getis-Ord: {str(e)}")
            return []

    @classmethod
    def _build_and_classify_snapshots(
        cls, 
        gfs_request: GFSRequest, 
        raw_rows: List[Tuple],
        district_rules_map: Dict[str, List[Dict]]
    ) -> List[GFSClusterSnapshot]:
        """
        Sub-método 3: Transforma los resultados de PostGIS en instancias del ORM 
        asignando el nombre de umbral correspondiente según los distritos intersecados.

            `@param gfs_request`: Instancia del modelo GFSRequest que contiene la información de la solicitud.
            `@param raw_rows`: Lista de tuplas provenientes de la consulta PostGIS.
            `@param district_rules_map`: Diccionario con las reglas de umbrales para cada distrito.

            `@return`: Lista de instancias del modelo GFSClusterSnapshot.
        """
        if not raw_rows:
            logger.warning(f"[Cluster Engine] No hay filas devueltas por PostGIS para procesar.")
            return []

        cluster_objects = []

        for row in raw_rows:
            time_step, timestamp_utc, cluster_id, total_cells, max_intensity, avg_intensity, wkt_geom, intersected_ubigeos = row
            max_intensity_val = float(max_intensity)

            # Evaluamiento usando los nombres reales del modelo Threshold
            threshold_id = cls._classify_threshold(
                max_intensity_val=max_intensity_val,
                intersected_ubigeos=intersected_ubigeos,
                district_rules_map=district_rules_map
            )

            cluster_objects.append(
                GFSClusterSnapshot(
                    gfs_request=gfs_request,
                    time_step=time_step,
                    timestamp_utc=timestamp_utc,
                    cluster_index=cluster_id,
                    total_cells=total_cells,
                    max_intensity_mm_h=max_intensity_val,
                    avg_intensity_mm_h=float(avg_intensity),    
                    threshold_id=threshold_id,            
                    affected_ubigeos=intersected_ubigeos,
                    geometry=GEOSGeometry(wkt_geom, srid=4326)
                )
            )

        return cluster_objects

    @staticmethod
    def _classify_threshold(
        max_intensity_val: float, 
        intersected_ubigeos: List[str], 
        district_rules_map: Dict[str, List[Dict]]
    ) -> int | None:
        """
        Sub-método 4: Evalúa la intensidad del clúster frente a las reglas locales 
        de cada distrito impactado (UBIGEO).
        
        Retorna el ID del umbral de mayor riesgo/severidad alcanzado entre todos los distritos.
        """
        if not intersected_ubigeos:
            return None

        assigned_threshold_id = None
        highest_min_value_reached = -1.0

        for ubigeo in intersected_ubigeos:
            # === Reglas de umbrales en base al distrito ===
            rules = district_rules_map.get(str(ubigeo), [])
            
            # === Asigna la regla según la intensidad ===
            for rule in rules:
                min_val = rule["min_value"]
                
                # === Intensidad supera el umbral del distrito ===
                if max_intensity_val >= min_val:
                    # === Criterio Conservador de Riesgo: Se tiene en cuenta la regla con el mayor min_value ===
                    if min_val > highest_min_value_reached:
                        highest_min_value_reached = min_val # la de mayor severidad entre todos los distritos
                        assigned_threshold_id = rule["threshold_id"]
                    
                    # Al estar las reglas ordenadas DESC por min_value, el valor "min_value" del rule está en orden descendente en base a los umbrales, ello significa que ante el primer caso que la precipitación del clúster sea mayor o igual al valor "min_value" del rule, se está ante el umbral de mayor severidad para ESTE distrito específico.
                    break

        return assigned_threshold_id

    @staticmethod
    def _persist_cluster_snapshots(gfs_request: GFSRequest, cluster_objects: List[GFSClusterSnapshot]) -> int:
        """
        Sub-método 6: Persistencia atómica transaccional en la tabla gfs_cluster_snapshots.
        """
        if not cluster_objects:
            logger.info(f"[Cluster Engine] No se generaron clústeres para GFSRequest #{gfs_request.id}.")
            return 0

        with transaction.atomic():
            GFSClusterSnapshot.objects.filter(gfs_request=gfs_request).delete()
            GFSClusterSnapshot.objects.bulk_create(cluster_objects, batch_size=500)

        logger.info(f"[Cluster Engine] Persistidos {len(cluster_objects)} clústeres en gfs_cluster_snapshots.")
        return len(cluster_objects)