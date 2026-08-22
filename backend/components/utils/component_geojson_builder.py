import logging
from typing import List, Dict, Any, Optional
from django.db import connection

from core_shared.services.gis_cache_manager import (
    GISCacheManager
)
from core_shared.constants import (
    CACHE_KEY_COMPONENTS_MAP,
    CACHE_TTL_COMPONENTS_MAP
)

logger = logging.getLogger(__name__)


class ComponentGeoJSONBuilder:
    """
        Servicio de Dominio e Infraestructura Espacial:
        Extrae y compila la capa vectorial de componentes y sus nodos de coordenadas
        directamente en PostGIS en formato RFC 7946 (GeoJSON).
    """

    @classmethod
    def get_feature_collection(cls) -> str:
        """
        Compila el FeatureCollection GeoJSON directamente en PostgreSQL.
        
        `return`: Cadena de texto JSON cruda compilada por la base de datos.
        
        `return_example`: Retorna la estructura JSON solicitada con anidamiento de coordenadas:
            [
                {
                    "id": 1,
                    "code": "CAP-01",
                    "name": "BOCATOMA CHANCHAMAYO",
                    "type": "BOCATOMA",
                    "district": "SAN RAMÓN",
                    "coords": [
                        {
                            "id": 10,
                            "criticality": "ALTA",
                            "geojson": {"type": "Point", "coordinates": [-75.35, -11.05]}
                        }
                    ],
                    "operational_status": {"code": "001", "name": "OPERATIVO"}
                }
            ]
        """
        # Intenta leer de Redis primero
        try:
            cached_payload = GISCacheManager.get(CACHE_KEY_COMPONENTS_MAP)
            if cached_payload:
                return cached_payload
        except Exception as exc:
            logger.warning(f"[ComponentGeoJSONBuilder] Fallo al leer de Redis: {str(exc)}")

        where_clauses = ["c.deleted_at IS NULL"]

        where_sql = " AND ".join(where_clauses)

        query = f"""
            WITH aggregated_coords AS (
                -- Subconsulta para agrupar las coordenadas activas por componente
                SELECT 
                    cc.component_id,
                    COALESCE(
                        jsonb_agg(
                            jsonb_build_object(
                                'id', cc.id,
                                'criticality', COALESCE(cr.name, 'NO ASIGNADO'),
                                'geojson', ST_AsGeoJSON(cc.coords)::jsonb
                            )
                        ) FILTER (WHERE cc.id IS NOT NULL AND cc.deleted_at IS NULL AND cc.coords IS NOT NULL),
                        '[]'::jsonb
                    ) AS coords_json
                FROM components_coords cc
                LEFT JOIN criticalities cr ON cc.criticality_id = cr.id
                WHERE cc.deleted_at IS NULL
                GROUP BY cc.component_id
            )
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'id', c.id,
                        'code', c.code,
                        'name', c.name,
                        'type', COALESCE(ct.name, 'SIN TIPO'),
                        'district', COALESCE(d.name, 'SIN DISTRITO'),
                        'coords', COALESCE(ac.coords_json, '[]'::jsonb),
                        'operational_status', jsonb_build_object(
                            'code', os.code,
                            'name', os.name
                        )
                    )
                ),
                '[]'::jsonb
            )::text
            FROM components c
            LEFT JOIN type_components ct ON c.type_id = ct.id
            LEFT JOIN districts d ON c.district_id = d.ubigeo
            LEFT JOIN operational_statuses os ON c.operational_status_id = os.id
            LEFT JOIN aggregated_coords ac ON ac.component_id = c.id

            WHERE {where_sql};
        """

        try:
            with connection.cursor() as cursor:
                cursor.execute(query)
                result = cursor.fetchone()
                payload = result[0] if result and result[0] else "[]"
                
                if payload != "[]":
                    try:
                        GISCacheManager.set(
                            key=CACHE_KEY_COMPONENTS_MAP,
                            value=payload, 
                            timeout_seconds=CACHE_TTL_COMPONENTS_MAP
                        )
                    except Exception as exc:
                        logger.warning(f"[ComponentGeoJSONBuilder] Fallo al escribir en Redis: {str(exc)}")

                return payload
        except Exception as exc:
            logger.error(f"[ComponentGeoJSONBuilder] Error al compilar estructura JSON en PostGIS: {str(exc)}")
            raise exc

    @classmethod
    def invalidate_cache(cls) -> None:
        """ Purga la caché cartográfica de componentes. """
        try:
            GISCacheManager.delete(CACHE_KEY_COMPONENTS_MAP)
            logger.info("[ComponentGeoJSONBuilder] Caché de mapa de componentes invalidada con éxito.")
        except Exception as exc:
            logger.warning(f"[ComponentGeoJSONBuilder] Error al invalidar caché: {str(exc)}")