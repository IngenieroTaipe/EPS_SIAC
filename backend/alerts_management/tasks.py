# alerts_management/tasks.py

import logging
# pyrefly: ignore [missing-import]
from celery import shared_task
from celery.exceptions import Retry
from django.utils import timezone
from datetime import timedelta

from alerts_management.models import Alert, AlertNotification, NotificationChannel, AlertHistory
from alerts_management.services.infrastructure_intersection_service import InfrastructureIntersectionService
from alerts_management.services.alert_management_service import AlertManagementService
from alerts_management.services.alert_state_machine_service import AlertStateMachineService
from alerts_management.services.notification_service import NotificationDomainService
from alerts_management.services.telegram_dispatcher import TelegramNotificationDispatcher

from core_predictive.models import GFSRequest, NaturalPhenomena

logger = logging.getLogger(__name__)

@shared_task(
    name="alerts_management.tasks.send_telegram_notification",
    bind=True,
    max_retries=3,
    default_retry_delay=30
)
def send_telegram_notification_task(self, notification_id: int) -> bool:
    """
    Worker Asíncrono de Celery (Thin Coordinator Pattern):
    Delegación exclusiva de orquestación, reintentos y tolerancia a fallos.
    """
    logger.info(f"[Celery Worker] Procesando despacho de notificación #{notification_id}...")

    try:
        # === Recuperación de datos y geoprocesamiento de dominio ===
        payload = NotificationDomainService.get_notification_payload(notification_id)
        if not payload:
            # Notificación no existe o ya fue enviada
            return True

        # === Despacho a través de la infraestructura de red ===
        dispatcher = TelegramNotificationDispatcher()
        success, is_config_error, error_msg = dispatcher.dispatch(payload)

        if success:
            # === Marcar como enviada de forma atómica ===
            NotificationDomainService.mark_as_sent(notification_id)
            logger.info(f"[Celery Worker] Notificación #{notification_id} despachada exitosamente.")
            return True

        # === Manejo de error de configuración (No reintentar) ===
        if is_config_error:
            logger.warning(
                f"[Telegram] Notificación #{notification_id} omitida: credenciales no configuradas."
            )
            return False

        # === Error transitorio -> Reintentar en Celery ===
        logger.error(f"[Telegram] Error transitorio en notificación #{notification_id}: {error_msg}")
        raise self.retry(exc=Exception(error_msg))

    except Retry:
        # === Excepción nativa de Celery: debe propagarse directamente ===
        logger.error(f"[Telegram] Error transitorio en notificación #{notification_id}: {error_msg}")
        raise

    except Exception as exc:
        # === Error no esperado -> Reintentar en Celery ===
        error_str = str(exc)
        if "no están configurados" in error_str or "no configurad" in error_str:
            logger.warning(f"[Telegram] Notificación #{notification_id} omitida por falta de credenciales.")
            return False

        logger.error(f"[Telegram] Error no esperado en notificación #{notification_id}: {error_str}")
        raise self.retry(exc=exc)

@shared_task(name="alerts_management.tasks.dispatch_hourly_alerts")
def dispatch_hourly_alerts_task():
    """
        Worker Horario (Celery Beat):
        Filtra notificaciones no despachadas en el horizonte operativo <= 6 horas.
    """
    now = timezone.now()
    six_hours_future = now + timedelta(hours=6)

    # === Buscar notificaciones pendientes ===
    pending_notifications = AlertNotification.objects.filter(
        is_sent=False,
        channel=NotificationChannel.TELEGRAM
    ).select_related('alert_history__alert')

    for notification in pending_notifications:
        alert = notification.alert_history.alert

        # === Regla de Despacho: Solo enviar si está dentro de la ventana de 6 horas O si es Cancelación/Reprogramación ===
        if alert.start_time_utc <= six_hours_future or notification.notification_type in ['CANCELLED', 'RESCHEDULED']:
            
            # Ejecución asíncrona de la lógica del worker
            send_telegram_notification_task.delay(notification.id)
            
            logger.info(f"✅ [Worker] Notificación ID #{notification.id} despachada para Alerta {alert.code}")

@shared_task(
    name="alerts_management.tasks.process_forecast_and_adapt_alerts",
    bind=True,
    max_retries=3,
    default_retry_delay=60
)
def process_forecast_and_adapt_alerts_task(self, gfs_request_id: int):
    """
        Tarea Celery Asíncrona:
            Se desencadena ÚNICAMENTE si la descarga e ingesta del archivo GFS fue exitosa.
            Ejecuta las Etapas 3, 4 y 5 del Pipeline de Alertas.
    """
    logger.info(f"[Celery Task] Iniciando procesamiento de alertas para GFSRequest #{gfs_request_id}...")

    try:
        natural_phenomena = NaturalPhenomena.objects.filter(name="LLUVIAS INTENSAS").first()

        # === Validar existencia y estado nominal de la solicitud ===
        gfs_request = GFSRequest.objects.filter(pk=gfs_request_id, status='COMPLETED').first()
        if not gfs_request:
            logger.warning(f"[Celery Task] GFSRequest #{gfs_request_id} no existe o no está en estado COMPLETED. Abortando.")
            return 0

        # === Intersectar clústeres con los componentes de la EPS ===
        impacted_clusters = InfrastructureIntersectionService.get_impacted_components_by_clusteres(gfs_request_id)
        
        if not impacted_clusters:
            logger.info(f"[Celery Task] No se detectó impacto en infraestructura para GFSRequest #{gfs_request_id}.")
            return 0

        # === Adaptadmos las alertas al nuevo pronóstico ===
        persisted_count = AlertManagementService.adapt_alerts_to_gfs_forecast(gfs_request_id, natural_phenomena.id, impacted_clusters)
        
        logger.info(f"[Celery Task] Finalizada exitosamente la adaptación de las alertas al nuevo pronóstico para GFSRequest #{gfs_request_id}. Snapshots procesados: {persisted_count}")
        return persisted_count

    except Exception as exc:
        logger.error(f"[Celery Task Error] Falló la adaptación de las alertas al nuevo pronóstico para GFSRequest #{gfs_request_id}: {str(exc)}")
        # Reintento automático en caso de fallos temporales de concurrencia en la BD
        raise self.retry(exc=exc)

@shared_task(name="alerts_management.tasks.process_state_machine_timeouts")
def process_state_machine_timeouts_task():
    """
        Worker Recurrente (Ejecución cada 60 min vía Celery Beat):
            1. Transiciona 'Predicho' -> 'En Espera de Confirmación' cuando llega start_time_utc.
            2. Transiciona 'En Espera de Confirmación' -> 'No Confirmado' al cumplir 60 min de inacción.
    """
    now = timezone.now()

    # === EVALUAR: Llega la hora 'start_time_utc' del fenómeno -> Migrar a 'En Espera de Confirmación' ===
    predicted_alerts = Alert.objects.filter(
        start_time_utc__lte=now,
        historic_alert__status__name="PREDICHO"
    ).distinct()

    for alert in predicted_alerts:
        latest_history = alert.historic_alert.order_by('-created_at').first()
        if latest_history and latest_history.status.name == "PREDICHO":
            AlertStateMachineService.transition_to_state_phase(
                alert=alert,
                status_name="EN ESPERA DE CONFIRMACIÓN"
            )
            logger.info(f"[FSM Worker] Alerta #{alert.code} pasó a 'En Espera de Confirmación'.")

    # === EVALUAR: Pasan > 1 hora en 'En Espera de Confirmación' sin acción -> Migrar a 'No Confirmado' ===
    one_hour_ago = now - timedelta(hours=1)
    
    waiting_histories = AlertHistory.objects.filter(
        status__name="EN ESPERA DE CONFIRMACIÓN",
        created_at__lte=one_hour_ago
    ).select_related('alert')

    for history in waiting_histories:
        alert = history.alert
        latest_history = alert.historic_alert.order_by('-created_at').first()
        
        # Verificar si la alerta sigue en 'En Espera de Confirmación' (Sin acción de usuario)
        if latest_history.id == history.id:
            AlertStateMachineService.transition_to_state_phase(
                alert=alert,
                status_name="NO CONFIRMADO"
            )
            logger.warning(f"[FSM Worker] Alerta #{alert.code} caducó por timeout de 1h -> Migrada a 'No Confirmado'.")
