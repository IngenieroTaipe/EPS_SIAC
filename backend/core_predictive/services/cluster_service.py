# core_predictive/services/cluster_service.py

from core_predictive.models import ThresholdsNaturalPhenomena
import logging
from typing import List, Tuple, Dict, Any
from django.db import connection, transaction

from core_predictive.models import GFSRequest, GFSClusterSnapshot, Threshold
from django.contrib.gis.geos import GEOSGeometry

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
        """
        logger.info(f"[Cluster Engine] Iniciando orquestación de clústeres para GFSRequest #{gfs_request_id}...")

        gfs_request = cls._get_request_instance(gfs_request_id)
        if not gfs_request:
            return 0

        # === Matriz de umbrales ordenados ===
        thresholds = cls._get_thresholds(target_variable_id, natural_phenomena_id)

        # === Geoprocesamiento Espacial en PostGIS ===
        raw_cluster_rows = cls._execute_spatial_dbscan_query(gfs_request_id)

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
                    c.timestamps->>(idx - 1) AS timestamp_str,
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
                    timestamp_str,
                    time_step,
                    ST_ClusterDBSCAN(geometry, eps := %s, minpoints := %s) OVER (
                        PARTITION BY time_step ORDER BY cell_id
                    ) AS cluster_id
                FROM filtered_cells
            ),
            dissolved_clusters AS (
                SELECT 
                    time_step,
                    timestamp_str,
                    cluster_id,
                    COUNT(cell_id) AS total_cells,
                    ROUND(MAX(intensity)::numeric, 2) AS max_intensity,
                    ROUND(AVG(intensity)::numeric, 2) AS avg_intensity,
                    ST_Multi(ST_Union(geometry)) AS geom
                FROM clustered
                WHERE cluster_id IS NOT NULL
                GROUP BY time_step, timestamp_str, cluster_id
            )
            -- Intersección con la tabla de distritos
            SELECT 
                dc.time_step,
                dc.timestamp_str,
                dc.cluster_id,
                dc.total_cells,
                dc.max_intensity,
                dc.avg_intensity,
                ST_AsText(dc.geom) AS wkt_geometry,
                COALESCE(array_agg(DISTINCT d.ubigeo), ARRAY[]::varchar[]) AS intersected_ubigeos
            FROM dissolved_clusters dc
            LEFT JOIN districts d ON ST_Intersects(dc.geom, d.geometry)
            GROUP BY dc.time_step, dc.timestamp_str, dc.cluster_id, dc.total_cells, dc.max_intensity, dc.avg_intensity, dc.geom
            ORDER BY dc.time_step, dc.cluster_id;
        """

        with connection.cursor() as cursor:
            cursor.execute(cluster_query, [
                gfs_request_id, 
                cls.DBSCAN_EPS_DEGREES, 
                cls.MIN_CELLS_PER_CLUSTER
            ])
            return cursor.fetchall()

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
        """
        cluster_objects = []

        for row in raw_rows:
            time_step, timestamp_str, cluster_id, total_cells, max_intensity, avg_intensity, wkt_geom, intersected_ubigeos = row
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
                    timestamp_str=timestamp_str,
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