import logging
from typing import Tuple

from alerts_management.services.notification_service import NotificationPayloadDTO
from alerts_management.services.telegram_service import TelegramService

logger = logging.getLogger(__name__)


class TelegramNotificationDispatcher:
    """Servicio de Infraestructura: Gestiona las comunicaciones de red con Telegram."""

    def __init__(self):
        self.telegram_service = TelegramService()

    def dispatch(self, payload: NotificationPayloadDTO) -> Tuple[bool, bool, str]:
        """
            Ejecuta el envío del mensaje de texto y el mapa de ubicación si existe.
            
            Returns:
                Tuple[
                    success (bool): Estado de la operación.
                    is_config_error (bool): Si el error es por configuración.
                    error_message (str): Mensaje de error si existe.
                ]
        """
        # === Generación de Mensaje ===
        start_date = payload.start_local.strftime("%Y-%m-%d")
        start_time = payload.start_local.strftime("%H:%M")
        end_date = payload.end_local.strftime("%Y-%m-%d") if payload.end_local else start_date
        end_time = payload.end_local.strftime("%H:%M") if payload.end_local else start_time

        message_text = TelegramService.generate_alert_message(
            unidades_operativas=payload.unidades_operativas,
            intensidad=payload.max_threshold_str,
            fecha_inicio=start_date,
            hora_inicio=start_time,
            fecha_fin=end_date,
            hora_fin=end_time,
            codigo=payload.alert_code,
            localidades="Sectores críticos e infraestructura de la EPS"
        )

        # === Envío de Texto ===
        success, response = self.telegram_service.send_message(message_text)

        if not success:
            error_str = str(response) if response is not None else "response=None"
            is_config_error = False
            return False, is_config_error, error_str

        # === Envío de Ubicación Espacial (PointField EPSG:4326) ===
        if payload.latitude is not None and payload.longitude is not None:
            logger.info(
                f"[Telegram Dispatcher] Enviando centroide del clúster "
                f"(Lat: {payload.latitude}, Lon: {payload.longitude})..."
            )
            self.telegram_service.send_location(
                latitude=payload.latitude, 
                longitude=payload.longitude
            )

        return True, False, ""