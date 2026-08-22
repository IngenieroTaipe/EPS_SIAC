import logging
from typing import List, Dict, Any, Optional
from django.db import connection

logger = logging.getLogger(__name__)


class BranchGeoJSONService:
    """
    Servicio de Infraestructura y Dominio Espacial:
    Responsable de la extracción y compilación de capas vectoriales de sucursales
    directamente en el motor C de PostGIS (RFC 7946 GeoJSON).
    """

    @classmethod
    def get_feature_collection(cls, branch_ids: Optional[List[int]] = None) -> Dict[str, Any]:
        """
        Compila el FeatureCollection GeoJSON directamente en PostgreSQL/PostGIS.
        
        `params`:
            - `branch_ids` (`list`[`int`] | `None`): Lista opcional de IDs de sucursales filtradas.
        
        `return`:
            - `dict`[`str`, `Any`]: Estructura FeatureCollection completa.
        """
        # Si se pasa una lista vacía explícita, retornamos la estructura base sin consultar la BD
        if branch_ids is not None and len(branch_ids) == 0:
            return {"type": "FeatureCollection", "features": []}

        where_clauses = ["b.deleted_at IS NULL", "b.status = TRUE"]
        params: List[Any] = []

        if branch_ids is not None:
            where_clauses.append("b.id = ANY(%s)")
            params.append(branch_ids)

        where_sql = " AND ".join(where_clauses)

        query = f"""
            SELECT jsonb_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
            )
            FROM (
                SELECT jsonb_build_object(
                    'type', 'Feature',
                    'id', b.id,
                    'properties', jsonb_build_object(
                        'code', b.code,
                        'name', b.name,
                        'acronym', b.acronym,
                        'district_name', d.name,
                        'district_ubigeo', d.ubigeo
                    ),
                    'geometry', ST_AsGeoJSON(d.geometry)::jsonb
                ) AS feature
                FROM branches b
                INNER JOIN districts d ON b.district_id = d.ubigeo
                WHERE {where_sql}
            ) features;
        """

        try:
            with connection.cursor() as cursor:
                cursor.execute(query, params)
                geojson_data = cursor.fetchone()[0]
            return geojson_data
        except Exception as exc:
            logger.error(f"[BranchGeoJSONService] Error al compilar GeoJSON en PostGIS: {str(exc)}")
            raise exc