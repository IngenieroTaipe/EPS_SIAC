# alerts_management/tasks.py

import logging
# pyrefly: ignore [missing-import]
from celery import shared_task
from django.utils import timezone
from datetime import timedelta

from alerts_management.models import Alert, AlertNotification, NotificationChannel, AlertHistory
from alerts_management.services.telegram_service import TelegramService
from alerts_management.services.infrastructure_intersection_service import InfrastructureIntersectionService
from alerts_management.services.alert_management_service import AlertManagementService
from alerts_management.services.alert_state_machine_service import AlertStateMachineService
from core_predictive.models import GFSRequest, NaturalPhenomena
from core_shared.constants import LIMA_TZ

logger = logging.getLogger(__name__)

@shared_task(
    name="tasks.send_telegram_notification",
    bind=True,
    max_retries=3,
    default_retry_delay=30
)
def send_telegram_notification_task(self, notification_id: int):
    """
    Worker Asíncrono de Celery:
    Toma el ID de un registro AlertNotification, construye el mensaje formateado en HTML 
    con las Unidades Operativas y el horizonte temporal, y realiza el despacho mediante TelegramService.
    
    Si la alerta posee un punto representativo de impacto (representative_point en PostGIS), 
    adjunta el mapa interactivo mediante sendLocation.
    """
    logger.info(f"[Celery Worker] Procesando despacho de notificación #{notification_id}...")

    try:
        # === Recuperar la notificación y precargar relaciones ===
        notification = AlertNotification.objects.select_related(
            'alert_history__alert',
            'alert_history__alert__natural_phenomena'
        ).get(pk=notification_id)

        # === Verificar si la notificación se envió ===
        logger.info(f"Notificasción estado: {notification.is_sent}")
        if notification.is_sent:
            logger.info(f"Notificación #{notification_id} ya se encuentra marcada como enviada. Omitiendo.")
            return True

        alert = notification.alert_history.alert
        telegram_service = TelegramService()

        # === Extraer Unidades Operativas (Distritos / Sectores impactados) ===
        if hasattr(alert, 'districts') and alert.districts.exists():
            unidades = list(alert.districts.values_list('name', flat=True))
        elif hasattr(alert, 'district') and alert.district:
            unidades = [alert.district.name]
        else:
            unidades = ["Selva Central - Cobertura EPS"]

        # === Extraer el snapshot activo y su punto representativo (PointField EPSG:4326) ===
        active_snapshot = alert.alerts_clusters_alerts.filter(is_active_forecast=True).first()

        start_local = alert.start_time_utc.astimezone(LIMA_TZ)
        end_local = alert.end_time_utc.astimezone(LIMA_TZ) if alert.end_time_utc else None
        # === Construir el mensaje de texto formateado en HTML ===
        message_text = TelegramService.generate_alert_message(
            unidades_operativas=unidades,
            intensidad=f"{alert.max_intensity_mm_h} mm/h",
            fecha_inicio=start_local.strftime("%Y-%m-%d"),
            hora_inicio=start_local.strftime("%H:%M"),
            fecha_fin=end_local.strftime("%Y-%m-%d") if end_local else start_local.strftime("%Y-%m-%d"),
            hora_fin=end_local.strftime("%H:%M") if end_local else "23:59",
            codigo=alert.code,
            localidades="Sectores críticos e infraestructura de la EPS"
        )

        # === Ejecutar envío del mensaje principal de texto ===
        success, response = telegram_service.send_message(message_text)

        if success:
            # === Si existe punto representativo espacial en PostGIS, despachar la ubicación geográfica ===
            if active_snapshot and active_snapshot.representative_point:
                lat = active_snapshot.representative_point.y
                lon = active_snapshot.representative_point.x
                
                logger.info(f"Enviando mapa geográfico a Telegram (Lat: {lat}, Lon: {lon})...")
                telegram_service.send_location(latitude=lat, longitude=lon)

            # === Marcar la notificación como enviada en la bitácora SQL ===
            notification.is_sent = True
            notification.sent_at = timezone.now()
            notification.save()
            
            logger.info(f"Notificación #{notification_id} despachada exitosamente para Alerta #{alert.code}.")
            return True
        else:
            raise Exception(f"Fallo en la respuesta de la API de Telegram: {response}")

    except AlertNotification.DoesNotExist:
        logger.error(f"Error: La notificación #{notification_id} no existe en la base de datos.")
        return False
        
    except Exception as exc:
        logger.error(f"Error al procesar notificación Telegram #{notification_id}: {str(exc)}")
        # Reintento automático con delay exponencial
        raise self.retry(exc=exc)

@shared_task(name="tasks.dispatch_hourly_alerts")
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
    name="tasks.process_forecast_and_adapt_alerts",
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

@shared_task(name="tasks.process_state_machine_timeouts")
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
                status_name="EN ESPERA DE CONFIRMACIÓN",
                phase_name="SIN FASE"
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
                status_name="NO CONFIRMADO",
                phase_name="SIN FASE"
            )
            logger.warning(f"[FSM Worker] Alerta #{alert.code} caducó por timeout de 1h -> Migrada a 'No Confirmado'.")