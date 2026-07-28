from django.db import connection
from typing import Dict, List

from core_predictive.models import (
    GFSActiveCell,
    ThresholdsNaturalPhenomena
)

import logging

logger = logging.getLogger(__name__)

class GridIntersectionService:
    """
        El servicio nos permite realizar la integración y geoprocesamiento espacial entre la malla de celdas
        generadas a partir del GRIB2 (e insertadas en PostGIS) y los polígonos de distritos de la EPS Selva Central (también en PostGIS) o los polígonos de los componentes de la EPS Selva Central.

        Ejecuta el Spatial Join ST_Intersects (indexado en GiST) entre las geometrías.
    """

    @classmethod
    def intersect_cells_with_districts(cls, 
        gfs_request_id: int,
        target_variable_id: int,
        natural_phenomena_id: int
    ) -> list:
        """
            El método permite poder enriquecer la tabla gfs_active_cells con los datos de los distritos
            y los umbrales asociados a los distritos (Esto es vital para que el frontend pueda trabajar sin problemas).

            1. Consulta via PostGIS ST_Intersects qué distrito interseca cada celda.
            2. Recupera las reglas de umbrales de dicho distrito para la variable y fenómeno.
            3. Evalúa la serie de intensidades horarias [t1..t12] contra las reglas.
            4. Actualiza el campo threshold_names en lote (Batch Update).
        """
        logger.info(f"[Spatial Join PostGIS] Iniciando intersección y clasificación de umbrales para Request #{gfs_request_id}...")

        # === Umbrales por distrito ===
        rules_qs = ThresholdsNaturalPhenomena.objects.filter(
            variable_id=target_variable_id,
            natural_phenomena_id=natural_phenomena_id
        ).select_related('district', 'threshold').order_by('district_id', '-min_value')

        # === Umbrales ordenados por distrito ===
        district_rules_map: Dict[int, List[ThresholdsNaturalPhenomena]] = {}
        for rule in rules_qs:
            district_rules_map.setdefault(rule.district_id, []).append(rule)

        # === Celdas con sus intersecciones ===
        spatial_join_query = """
            SELECT 
                c.id AS cell_id,
                d.ubigeo AS district_id
            FROM gfs_active_cells c
            INNER JOIN districts d ON ST_Intersects(c.geometry, d.geometry)
            WHERE c.gfs_request_id = %s;
        """

        cell_district_pairs = []

        with connection.cursor() as cursor:
            cursor.execute(spatial_join_query, [gfs_request_id])
            cell_district_pairs = cursor.fetchall()

        if not cell_district_pairs:
            logger.warning(f"[Spatial Join] No se encontraron intersecciones entre celdas de Request #{gfs_request_id} y distritos.")
            return

        # === Mapeo: cell_id -> district_id ===
        cell_to_district = {
            row[0]: row[1] 
            for row in cell_district_pairs
        }

        # === Celdas para evaluación atómica ===
        cells_to_update = (
            GFSActiveCell.objects
            .filter(gfs_request_id=gfs_request_id)
            .iterator(chunk_size=1000)
        )

        updated_cells_list = []

        for cell in cells_to_update:
            district_id = cell_to_district.get(cell.id)
            district_rules = district_rules_map.get(district_id, []) if district_id else []

            names_series = []

            # === Evaluamos cada paso horario [t1..t12] contra las reglas del distrito correspondiente ===
            for intensity in cell.intensity_series:
                # === Identificamos el umbral al que pertenece la intensidad ===
                for rule in district_rules:
                    if rule.min_value is not None and intensity >= rule.min_value:
                        names_series.append(rule.threshold.name)
                        break

                else:
                    names_series.append("-")

            cell.threshold_names = names_series

            updated_cells_list.append(cell)

        # === Actualización Masiva en Lote (Batch Update) ===
        GFSActiveCell.objects.bulk_update(
            updated_cells_list, 
            fields=['threshold_names'], 
            batch_size=1000
        )

        logger.info(f"[Spatial Join PostGIS] Se enriquecieron exitosamente {len(updated_cells_list)} celdas con sus series de umbrales.")

    def map_geojson_to_components(self, geojson_features: list):
        logger.info(f"[Spatial Intersect] Ejecutando intersección para {len(geojson_features)} celdas contra los componentes geográficos de la EPS Selva Central...")
        
        # components = ComponentService.get_all_components()

        # return geojson_intersected