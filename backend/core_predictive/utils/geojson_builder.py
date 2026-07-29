# core_predictive/utils/geojson_builder.py

import logging
from typing import List, Dict, Any, Type, Optional
from django.db import connection, models
from django.core.cache import cache
from rest_framework import status
from rest_framework.response import Response

from core_predictive.models import GFSRequest

logger = logging.getLogger(__name__)


class PostGISGeoJSONExtractor:
    """
        La clase nos permite poder extraer Geometrías del motor de base de datos Postgis.
        Responsabilidad: Permite la construcción y ejecución de consultas SQL nativas en PostGIS 
        devolviendo estructuras GeoJSON (RFC 7946) puras.
    """

    @classmethod
    def extract_latest_feature_collection(
        cls,
        model_class: Type[models.Model],
        properties_fields: List[str],
        geometry_field_name: str = "geometry"
    ) -> Dict[str, Any]:
        """ 
            Extrae el GeoJSON directamente desde el engine de PostGIS. 
        """
        latest_request = GFSRequest.objects.filter(
            status='COMPLETED'
        ).order_by('-date_range_start', '-created_at').first()

        if not latest_request:
            return {
                "type": "FeatureCollection",
                "metadata": {
                    "message": "No existen solicitudes GFS procesadas en estado COMPLETED.",
                    "total_features": 0
                },
                "features": []
            }

        db_table = model_class._meta.db_table
        properties_sql = ", ".join([f"'{f}', c.{f}" for f in properties_fields])

        raw_query = f"""
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'metadata', json_build_object(
                    'request_code', %s,
                    'target_variable', %s,
                    'run_start_utc', %s,
                    'run_end_utc', %s,
                    'total_features', COUNT(c.id)
                ),
                'features', COALESCE(json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'id', c.id,
                        'geometry', ST_AsGeoJSON(c.{geometry_field_name})::json,
                        'properties', json_build_object(
                            {properties_sql},
                            'threshold_name', COALESCE(t.name, 'Normal / Sin Alerta') -- Incluimos el nombre del umbral para facilitar su identificación en el frontend.
                        )
                    )
                ), '[]'::json)
            )
            FROM {db_table} c
            LEFT JOIN thresholds t ON c.threshold_id = t.id -- Especificamos que la tabla se une mediante el campo threshold_id.
            WHERE c.gfs_request_id = %s;
        """

        with connection.cursor() as cursor:
            cursor.execute(raw_query, [
                latest_request.request_code,
                latest_request.target_variable,
                latest_request.date_range_start.isoformat(),
                latest_request.date_range_end.isoformat(),
                latest_request.id
            ])
            return cursor.fetchone()[0]

    @classmethod
    def extract_18h_window_feature_collection(
        cls,
        model_class: Type[models.Model],
        properties_fields: List[str],
        geometry_field_name: str = "geometry"
    ) -> Dict[str, Any]:
        """
        Extrae una colección GeoJSON que integra:
        - Las primeras 6 horas de la corrida previa (T-6h a T-1h).
        - Las 12 horas de la corrida actual (T0 a T+12h).
        """
        # === Recuperar las dos últimas solicitudes completadas (Latest y Previous) ===
        completed_requests = list(
            GFSRequest.objects.filter(status='COMPLETED')
            .order_by('-date_range_start', '-created_at')[:2]
        )

        if not completed_requests:
            return {
                "type": "FeatureCollection",
                "metadata": {"total_features": 0, "message": "No hay ejecuciones completadas."},
                "features": []
            }

        latest_request = completed_requests[0]
        previous_request = completed_requests[1] if len(completed_requests) > 1 else None

        db_table = model_class._meta.db_table
        properties_sql = ", ".join([f"'{f}', c.{f}" for f in properties_fields])

        # === Consulta SQL: Une las 6h de la corrida anterior + 12h de la corrida actual ===
        raw_query = f"""
            WITH previous_slice AS (
                -- Trae los pasos 1 al 6 de la corrida previa (Pasado)
                SELECT c.*, 'HISTORIC' AS temporal_status
                FROM {db_table} c
                WHERE c.gfs_request_id = %s AND c.time_step BETWEEN 1 AND 6
            ),
            latest_slice AS (
                -- Trae los pasos 1 al 12 de la corrida actual (Presente/Futuro)
                SELECT c.*, 'FORECAST' AS temporal_status
                FROM {db_table} c
                WHERE c.gfs_request_id = %s AND c.time_step BETWEEN 1 AND 12
            ),
            combined_window AS (
                SELECT * FROM previous_slice
                UNION ALL
                SELECT * FROM latest_slice
            )
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'metadata', json_build_object(
                    'latest_request_code', %s,
                    'previous_request_code', %s,
                    'window_duration_hours', 18,
                    'total_features', COUNT(c.id)
                ),
                'features', COALESCE(json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'id', c.id,
                        'geometry', ST_AsGeoJSON(c.{geometry_field_name})::json,
                        'properties', json_build_object(
                            {properties_sql},
                            'threshold_name', COALESCE(t.name, 'Normal / Sin Alerta'), -- Incluimos el nombre del umbral para facilitar su identificación en el frontend.
                            'temporal_status', c.temporal_status
                        )
                    )
                ), '[]'::json)
            )
            FROM combined_window c
            LEFT JOIN thresholds t ON c.threshold_id = t.id; -- Especificamos que la tabla se une mediante el campo threshold_id.
        """

        # === Ejecución de la Consulta SQL con los parámetros ===
        prev_id = previous_request.id if previous_request else latest_request.id
        prev_code = previous_request.request_code if previous_request else latest_request.request_code

        with connection.cursor() as cursor:
            cursor.execute(raw_query, [
                prev_id,
                latest_request.id,
                latest_request.request_code,
                prev_code
            ])
            return cursor.fetchone()[0]

class GISCacheManager:
    """
        La clase nos permite la gestión de datos en Caché.
        Responsabilidad: Abstraer la persistencia temporal en Caché (En el proyecto el gestor de caché es Redis).
    """

    @staticmethod
    def get(key: str) -> Optional[Dict[str, Any]]:
        return cache.get(key)

    @staticmethod
    def set(key: str, value: Dict[str, Any], timeout_seconds: int = 21600) -> None:
        cache.set(key, value, timeout=timeout_seconds)

    @staticmethod
    def invalidate(key: str) -> None:
        cache.delete(key)


class GeoJSONResponseService:
    """
    Componente 3: Adaptador REST de Presentación (Presentation Layer).
    Responsabilidad única: Orquestar el Extractor y la Caché para entregar 
    respuestas HTTP compatibles con Django REST Framework.
    """

    @classmethod
    def build_latest_response(
        cls,
        model_class: Type[models.Model],
        properties_fields: List[str],
        cache_key: str,
        geometry_field_name: str = "geometry",
        cache_timeout_seconds: int = 21600
    ) -> Response:
        """
        Orquesta la extracción, cacheo y formateo de respuesta HTTP.
        """
        # === Intentar leer desde caché ===
        cached_geojson = GISCacheManager.get(cache_key)
        if cached_geojson:
            logger.info(f"[GeoJSON Service] Cache HIT: '{cache_key}'")
            return Response(cached_geojson, status=status.HTTP_200_OK)

        # === Extraer datos desde PostGIS ===
        geojson_data = PostGISGeoJSONExtractor.extract_latest_feature_collection(
            model_class=model_class,
            properties_fields=properties_fields,
            geometry_field_name=geometry_field_name
        )

        # === Escribir en caché para futuras consultas ===
        GISCacheManager.set(cache_key, geojson_data, timeout_seconds=cache_timeout_seconds)
        logger.info(f"✅ [GeoJSON Service] Cache MISS. Extraído y guardado en Redis: '{cache_key}'")

        return Response(geojson_data, status=status.HTTP_200_OK)

    @classmethod
    def build_18h_window_response(
        cls,
        model_class: Type[models.Model],
        properties_fields: List[str],
        cache_key: str,
        geometry_field_name: str = "geometry",
        cache_timeout_seconds: int = 21600
    ) -> Response:
        """
        Orquesta la respuesta HTTP para la ventana extendida de 18 horas (T-6h a T+12h).
        """
        cached_geojson = GISCacheManager.get(cache_key)
        if cached_geojson:
            logger.info(f"[GeoJSON Service] Cache HIT 18h Window: '{cache_key}'")
            return Response(cached_geojson, status=status.HTTP_200_OK)

        geojson_data = PostGISGeoJSONExtractor.extract_18h_window_feature_collection(
            model_class=model_class,
            properties_fields=properties_fields,
            geometry_field_name=geometry_field_name
        )

        # === Escribir en caché para futuras consultas ===
        GISCacheManager.set(cache_key, geojson_data, timeout_seconds=cache_timeout_seconds)
        logger.info(f"✅ [GeoJSON Service] Cache MISS 18h Window. Guardado en Redis: '{cache_key}'")

        return Response(geojson_data, status=status.HTTP_200_OK) 