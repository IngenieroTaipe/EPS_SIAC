import requests
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

class TelegramService:
    """
        Servicio para enviar alertas mediante un bot de Telegram a un grupo.
        Se recomienda configurar TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en settings.py,
        o en su defecto pasarlos como parámetros al instanciar la clase.
    """
    
    def __init__(self, bot_token=None, chat_id=None):
        """
            Inicializa el servicio de Telegram con el token del bot y el id del chat (grupo).
        """
        self.bot_token = bot_token or getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
        self.chat_id = chat_id or getattr(settings, 'TELEGRAM_CHAT_ID', None)
        
        if self.bot_token:
            self.api_url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        else:
            self.api_url = None

    def test_connection(self):
        """
            Método para probar la conexión con la API de Telegram y verificar que el token es válido.
            Retorna una tupla (bool, mensaje/datos).
        """
        if not self.bot_token:
            return False, "Bot token no configurado."
        
        test_url = f"https://api.telegram.org/bot{self.bot_token}/getMe"
        try:
            response = requests.get(test_url, timeout=5)
            if response.status_code == 200:
                return True, response.json()
            else:
                return False, f"Error de conexión: {response.status_code} - {response.text}"
        except requests.exceptions.RequestException as e:
            logger.error(f"Excepción al conectar con Telegram: {str(e)}")
            return False, f"Excepción de conexión: {str(e)}"

    def send_message(self, message, parse_mode='HTML'):
        """
            Envía un mensaje personalizado al grupo de Telegram configurado.
            
            `@param message` Texto del mensaje a enviar.
            `@param parse_mode` Modo de parseo del mensaje (HTML o Markdown). Por defecto HTML.
            `@return` Tupla (bool, mensaje/datos de respuesta).
        """
        if not self.bot_token or not self.chat_id:
            error_msg = "Telegram Bot Token o Chat ID no están configurados."
            logger.error(error_msg)
            return False, error_msg

        data = {
            "chat_id": self.chat_id,
            "text": message,
            "parse_mode": parse_mode
        }

        try:
            response = requests.post(self.api_url, data=data, timeout=10)
            if response.status_code == 200:
                logger.info("Mensaje de Telegram enviado exitosamente.")
                return True, response.json()
            else:
                error_msg = f"Error al enviar mensaje por Telegram: {response.status_code} - {response.text}"
                logger.error(error_msg)
                return False, error_msg
        except requests.exceptions.RequestException as e:
            error_msg = f"Excepción al enviar mensaje por Telegram: {str(e)}"
            logger.error(error_msg)
            return False, error_msg

    @staticmethod
    def generate_alert_message(
        unidad_operativa,
        intensidad,
        fecha,
        hora,
        codigo,
        localidades
    ):
        """
        Genera un mensaje de alerta formateado basado en la plantilla solicitada.
        """
        template = (
            f"📍 ¡¡Atención, Unidad Operativa {unidad_operativa}!!\n\n"
            f"⚠️ Existe una alta probabilidad de Lluvias 🔴 {intensidad} durante el siguiente periodo:\n"
            f"🗓️ {fecha}  🕙 {hora}\n\n"
            f"📊 Detalles del evento:\n"
            f"Código: {codigo}\n"
            f"Localidades abarcadas: {localidades}"
        )
        return template
