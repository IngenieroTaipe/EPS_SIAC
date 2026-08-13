# alerts_management/tasks.py

import logging
# pyrefly: ignore [missing-import]
from celery import shared_task
from celery.exceptions import Retry
from django.utils import timezone
from django.db.models import OuterRef, Subquery
from datetime import timedelta

from alerts_management.models import Alert, AlertNotification, NotificationChannel, AlertHistory
from alerts_management.services.forecast_pipeline_service import ForecastPipelineDomainService
from alerts_management.services.alert_state_machine_service import AlertStateMachineService
from alerts_management.services.notification_service import NotificationDomainService
from alerts_management.services.telegram_dispatcher import TelegramNotificationDispatcher

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

    dispatched_count = 0
    stagger_delay = 0

    for notification in pending_notifications:
        alert = notification.alert_history.alert

        # Regla de Despacho: Solo enviar si está dentro de la ventana de 6 horas O si es Cancelación/Reprogramación
        is_in_window = alert.start_time_utc <= six_hours_future
        is_priority_type = notification.notification_type in ['CANCELLED', 'RESCHEDULED']
        
        if is_in_window or is_priority_type:
            send_telegram_notification_task.apply_async(
                args=[notification.id],
                countdown=stagger_delay
            )
            dispatched_count += 1
            stagger_delay += 3 # Necesario para que el mensaje y el punto estén sincronizados (no cambiar)
            logger.info(f"✅ [Worker Beat] Encolada Notificación ID #{notification.id} para Alerta #{alert.code}")

    return dispatched_count

@shared_task(
    name="alerts_management.tasks.process_forecast_and_adapt_alerts",
    bind=True,
    max_retries=3,
    default_retry_delay=60
)
def process_forecast_and_adapt_alerts_task(self, gfs_request_id: int):
    """
    Tarea Celery Asíncrona:
    Delegación de la adaptación espacial al servicio de dominio del pipeline.
    """
    logger.info(f"[Celery Task] Iniciando procesamiento de alertas para GFSRequest #{gfs_request_id}...")

    try:
        success, persisted_count, msg = ForecastPipelineDomainService.execute_forecast_adaptation(gfs_request_id)
        if not success:
            logger.error(f"[Celery Task Error] Falló el pipeline para GFSRequest #{gfs_request_id}: {msg}")
            raise self.retry(exc=Exception(msg))

        return persisted_count

    except Retry:
        raise

    except Exception as exc:
        logger.error(f"[Celery Task Error] Excepción inesperada en GFSRequest #{gfs_request_id}: {str(exc)}")
        raise self.retry(exc=exc)

@shared_task(name="alerts_management.tasks.process_state_machine_timeouts")
def process_state_machine_timeouts_task():
    """
        Worker Recurrente (Ejecución cada 60 min vía Celery Beat):
            1. Transiciona 'Predicho' -> 'En Espera de Confirmación' cuando llega start_time_utc.
            2. Transiciona 'En Espera de Confirmación' -> 'No Confirmado' al cumplir 60 min de inacción.
    """
    now = timezone.now()
    one_hour_ago = now - timedelta(hours=1)
    
    latest_history_id_subquery = Subquery(
        AlertHistory.objects.filter(
            alert=OuterRef('pk')
        ).order_by('-created_at').values('id')[:1]
    )

    # === EVALUAR: Llega la hora 'start_time_utc' del fenómeno -> Migrar a 'En Espera de Confirmación' ===
    predicted_alerts = Alert.objects.filter(
        start_time_utc__lte=now,
        historic_alert__id=latest_history_id_subquery,
        historic_alert__status__name="PREDICHO"
    ).distinct()

    migrated_to_waiting = 0
    for alert in predicted_alerts:
        AlertStateMachineService.transition_to_state_phase(
            alert=alert,
            status_name="EN ESPERA DE CONFIRMACIÓN"
        )
        migrated_to_waiting += 1
        logger.info(f"[FSM Worker] Alerta #{alert.code} pasó a 'En Espera de Confirmación'.")

    # === EVALUAR: Pasan > 1 hora en 'En Espera de Confirmación' sin acción -> Migrar a 'No Confirmado' ===
    waiting_histories = AlertHistory.objects.filter(
            id=Subquery(
            AlertHistory.objects.filter(
                alert=OuterRef('alert_id')
            ).order_by('-created_at').values('id')[:1]
        ),
        status__name="EN ESPERA DE CONFIRMACIÓN",
        created_at__lte=one_hour_ago
    ).select_related('alert')

    migrated_to_unconfirmed = 0
    for history in waiting_histories:
        AlertStateMachineService.transition_to_state_phase(
            alert=history.alert,
            status_name="NO CONFIRMADO"
        )
        migrated_to_unconfirmed += 1
        logger.warning(f"[FSM Worker] Alerta #{history.alert.code} caducó por timeout de 1h -> Migrada a 'No Confirmado'.")

    return {
        "migrated_to_waiting": migrated_to_waiting,
        "migrated_to_unconfirmed": migrated_to_unconfirmed
    }