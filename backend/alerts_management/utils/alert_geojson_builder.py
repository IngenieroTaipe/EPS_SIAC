import logging
from typing import List, Optional
from django.db import connection

from alerts_management.constants import MAXIMUM_DAYS_TO_SHOW_ATTENDED_ALERTS

logger = logging.getLogger(__name__)

class AlertGeoJSONBuilder:
    """
        Servicio de Dominio e Infraestructura Espacial:
        Compila el listado optimizado de alertas activas para el visor cartográfico
        directamente en PostgreSQL/PostGIS.
    """

    @classmethod
    def get_alerts_map_payload(clsº) -> str:
        """
            Retorna la estructura JSON de alertas requerida para el mapa:

            `return_example`:
            [
                {
                    "id": 1,
                    "code": "000000001",
                    "natural_phenomena_name": "LLUVIAS INTENSAS",
                    "max_intensity_mm_h": "8.00",
                    "max_threshold": "MUY LLUVIOSO (Nivel 3)",
                    "status_name": "PREDICHO",
                    "phase_name": "Sin Fase",
                    "start_time_local": "2026-08-22T10:00:00-05:00",
                    "end_time_local": "2026-08-22T23:00:00-05:00"
                }
            ]
        """

        where_clauses = [
            "a.deleted_at IS NULL",
            "UPPER(COALESCE(lh.status_name, '')) != 'NO CONFIRMADO'",
            f"""(
                  -- Si está en CONFIRMADO y fase ATENDIDO: mostrar máximo {MAXIMUM_DAYS_TO_SHOW_ATTENDED_ALERTS} días desde su atención
                  (
                      UPPER(COALESCE(lh.status_name, '')) = 'CONFIRMADO' 
                      AND UPPER(COALESCE(lh.phase_name, '')) = 'ATENDIDO' 
                      AND lh.transition_time >= NOW() - INTERVAL '{MAXIMUM_DAYS_TO_SHOW_ATTENDED_ALERTS} days'
                  )
                  -- Para cualquier otra combinación de estado y fase: mostrar siempre
                  OR NOT (
                      UPPER(COALESCE(lh.status_name, '')) = 'CONFIRMADO' 
                      AND UPPER(COALESCE(lh.phase_name, '')) = 'ATENDIDO'
                  )
            )"""
        ]
        params: List = []

        where_sql = " AND ".join(where_clauses)

        query = f"""
            WITH latest_history AS (
                -- Extrae el historial más reciente por cada alerta en tiempo constante
                SELECT DISTINCT ON (ah.alert_id)
                    ah.alert_id,
                    st.name AS status_name,
                    ph.name AS phase_name,
                    ah.created_at AS transition_time
                FROM alerts_historic ah
                LEFT JOIN alerts_statuses st ON ah.status_id = st.id
                LEFT JOIN alerts_phases ph ON ah.phase_id = ph.id
                ORDER BY ah.alert_id, ah.created_at DESC
            )
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'id', a.id,
                        'code', a.code,
                        'natural_phenomena_name', COALESCE(np.name, 'NO DEFINIDO'),
                        'max_intensity_mm_h', TO_CHAR(a.max_intensity_mm_h, 'FM999990.00'),
                        'max_threshold', COALESCE(t.name, 'SIN UMBRAL'),
                        'status_name', COALESCE(lh.status_name, 'Desconocido'),
                        'phase_name', COALESCE(lh.phase_name, 'Sin Fase'),

                        -- Conversión a zona horaria America/Lima (UTC-5)
                        'start_time_local', TO_CHAR(
                            a.start_time_utc AT TIME ZONE 'America/Lima',
                            'YYYY-MM-DD"T"HH24:MI:SS-05:00'
                        ),
                        'end_time_local', TO_CHAR(
                            a.end_time_utc AT TIME ZONE 'America/Lima',
                            'YYYY-MM-DD"T"HH24:MI:SS-05:00'
                        )
                    ) ORDER BY a.id ASC
                ),
                '[]'::jsonb
            )::text
            FROM alerts a
            LEFT JOIN natural_phenomenas np ON a.natural_phenomena_id = np.id
            LEFT JOIN thresholds t ON a.max_threshold_id = t.id
            LEFT JOIN latest_history lh ON lh.alert_id = a.id
            WHERE {where_sql};
        """

        try:
            with connection.cursor() as cursor:
                cursor.execute(query, params)
                row = cursor.fetchone()
                return row[0] if row and row[0] else "[]"
        except Exception as exc:
            logger.error(f"[AlertMapService] Error al compilar payload de alertas en PostgreSQL: {str(exc)}")
            raise exc