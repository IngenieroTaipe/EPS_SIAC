import logging
import requests
from typing import Tuple, Dict, Any, Optional, Union, List
from django.conf import settings
from alerts_management.constants import MAXIMUM_VISIBLE_OPERATIVE_UNITS
logger = logging.getLogger(__name__)


class TelegramService:
    """
    Servicio de integración con la API de Telegram Bot para la emisión 
    de alertas meteorológicas e infraestructura a grupos operativos de la EPS.
    """
    
    def __init__(
        self, 
        bot_token: Optional[str] = None, 
        chat_id: Optional[str] = None
    ):
        """
            Inicializa el servicio de Telegram Bot.

            `@params`:
                `bot_token` (`Optional[str]`): Token del bot de Telegram.
                `chat_id` (`Optional[str]`): ID del chat de Telegram.
        """
        self.bot_token = bot_token or getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
        self.chat_id = chat_id or getattr(settings, 'TELEGRAM_CHAT_ID', None)
        
        if self.bot_token:
            self.base_url = f"https://api.telegram.org/bot{self.bot_token}"
        else:
            self.base_url = None

    def send_message(
        self, 
        message: str, 
        parse_mode: str = 'HTML'
    ) -> Tuple[bool, Any]:
        """
            Envía un mensaje de texto formateado al grupo de Telegram.

            `@params`:
                `message` (`str`): Mensaje a enviar.
                `parse_mode` (`str`): Formato del mensaje (HTML o Markdown).

            `@return`:
                `Tuple[bool, Any]`: Tupla con el estado de la operación y la respuesta de la API.
        """
        if not self.bot_token or not self.chat_id:
            error_msg = "Telegram Bot Token o Chat ID no están configurados."
            logger.error(error_msg)
            return False, error_msg

        url = f"{self.base_url}/sendMessage"
        payload = {
            "chat_id": self.chat_id,
            "text": message,
            "parse_mode": parse_mode
        }

        try:
            response = requests.post(url, json=payload, timeout=10)
            if response.status_code == 200:
                logger.info("Mensaje de Telegram enviado exitosamente.")
                return True, response.json()
            else:
                error_msg = f"Error API Telegram: {response.status_code} - {response.text}"
                logger.error(error_msg)
                return False, error_msg

        except requests.exceptions.RequestException as e:
            error_msg = f"Error API Telegram: {response.status_code} - {str(e)}"
            logger.error(error_msg)
            return False, error_msg

    def send_location(
        self, 
        latitude: float, 
        longitude: float
    ) -> Tuple[bool, Any]:
        """
            Envía un pin geográfico interactivo al grupo de Telegram utilizando 
            el punto representativo (representative_point) en WGS84.
        
            `@params`:
                `latitude` (`float`): Latitud del punto.
                `longitude` (`float`): Longitud del punto.

            `@return`:
                `Tuple[bool, Any]`: Tupla con el estado de la operación y la respuesta de la API.
        """
        if not self.bot_token or not self.chat_id:
            return False, "Bot token o Chat ID no configurados."

        url = f"{self.base_url}/sendLocation"
        payload = {
            "chat_id": self.chat_id,
            "latitude": latitude,
            "longitude": longitude
        }

        try:
            response = requests.post(url, json=payload, timeout=10)
            return (True, response.json()) if response.status_code == 200 else (False, response.text)
        except requests.exceptions.RequestException as e:
            logger.error(f"Excepción al enviar localización a Telegram: {str(e)}")
            return False, str(e)

    @staticmethod
    def generate_alert_message(
        unidades_operativas: Union[List[str], str],
        intensidad: str,
        fecha_inicio: str,
        hora_inicio: str,
        fecha_fin: str,
        hora_fin: str,
        codigo: str,
        localidades: str
    ) -> str:
        """
            Genera la plantilla oficial formateada en HTML soportando múltiples Unidades Operativas
            y el horizonte temporal completo (Inicio y Fin).

            @params:
                `unidades_operativas` (`Union[List[str]`, `str]`): Lista de unidades operativas.
                `intensidad` (`str`): Intensidad de la alerta.
                `fecha_inicio` (`str`): Fecha de inicio de la alerta.
                `hora_inicio` (`str`): Hora de inicio de la alerta.
                `fecha_fin` (`str`): Fecha de fin de la alerta.
                `hora_fin` (`str`): Hora de fin de la alerta.
                `codigo` (`str`): Código de la alerta.
                `localidades` (`str`): Localidades afectadas.

            @return:
                `str:` Mensaje formateado.
        """
        # =========================================================================
        # TRUNCAMIENTO ADAPTATIVO DE UNIDADES OPERATIVAS (PROCESS IN BATCH)
        # =========================================================================
        if isinstance(unidades_operativas, list):
            total_unidades = len(unidades_operativas)
            
            if total_unidades > MAXIMUM_VISIBLE_OPERATIVE_UNITS:
                visible_list = [u.upper() for u in unidades_operativas[:MAXIMUM_VISIBLE_OPERATIVE_UNITS]]
                remanente = total_unidades - MAXIMUM_VISIBLE_OPERATIVE_UNITS
                unidades_str = f"{', '.join(visible_list)} Y {remanente} MÁS"
            
            else:
                unidades_str = ", ".join([u.upper() for u in unidades_operativas])
        else:
            unidades_str = unidades_operativas.upper()

        # =========================================================================
        # FORMATEO DEL HORIZONTE TEMPORAL
        # =========================================================================
        if fecha_inicio == fecha_fin:
            rango_tiempo = f"🗓️ <b>{fecha_inicio}</b> \n 🕙 <b>{hora_inicio} a {hora_fin}</b>"
        else:
            rango_tiempo = (
                f"🗓️ <b>Inicio:</b> {fecha_inicio} \n 🕙 <b>{hora_inicio}</b>\n"
                f"🗓️ <b>Fin:</b> {fecha_fin} \n 🕙 <b>{hora_fin}</b>"
            )

        return (
            f"📍 <b>¡¡ATENCIÓN, UNIDADES OPERATIVAS: {unidades_str}!!</b>\n\n"
            f"⚠️ Existe una alta probabilidad de Lluvias 🔴 <b>{intensidad}</b> durante el siguiente periodo:\n"
            f"{rango_tiempo}\n\n"
            f"📊 <b>Detalles del evento:</b>\n"
            f"• <b>Código de Alerta:</b> <code>{codigo}</code>\n"
            f"🔗 <a href='https://localhost'>Ver más detalles aquí</a>"
        )