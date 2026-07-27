import logging

from datetime import datetime
from celery import shared_task
from django.db import transaction
from django.contrib.gis.geos import Polygon
from django.utils import timezone
from datetime import timedelta
from core_predictive.models import EMCWFRequest
from core_predictive.services import ECMWFDataService, ECMWFRequestService

logger = logging.getLogger(__name__)

@shared_task(
    name="core_predictive.tasks.run_scheduled_ecmwf_download",
    bind=True,
    max_retries=3,
    default_retry_delay=600  # Reintento después de 10 min
)
def run_scheduled_ecmwf_download(self, total_hours: int = 48):
    """
        Tarea Celery de Fondo (Worker):
        Orquesta la descarga periódica del modelo IFS de ECMWF.
        Verifica la existencia previa de la ejecución, crea el registro en BD
        y ejecuta la conversión y la intersección de distritos.
    """
    now_utc = datetime.utcnow()
    
    # Determinación de la ejecución nominal más cercana (00Z o 12Z)
    run_time = "0" if now_utc.hour < 12 else "12"
    date_offset = "0"

    data_service = ECMWFDataService()

    # === Verifica que el archivo no haya sido descargado previamente ===
    if data_service.is_run_already_processed(date_offset=date_offset, run_time=run_time):
        logger.info(f"⚡ [Skip Download] La ejecución (Date Offset: {date_offset}, Time: {run_time}Z) ya existe en estado COMPLETED.")
        return {"status": "SKIPPED", "message": "Ejecución previamente descargada."}

    logger.info(f"🚀 [Job ECMWF] Iniciando automatización para ejecución {run_time}Z...")

    try:
        # === Creación del registro trazable en Base de Datos (PostGIS) ===
        request_code = f"AUTO_{now_utc.strftime('%Y%m%d')}_{run_time}Z"
        
        peru_bbox_polygon = Polygon((
            (-81.5, -18.5),
            (-68.5, -18.5),
            (-68.5, 0.5),
            (-81.5, 0.5),
            (-81.5, -18.5)
        ), srid=4326)

        date_range_start = timezone.now()
        date_range_end = date_range_start + timedelta(hours=total_hours)

        with transaction.atomic():
            request_obj, created = EMCWFRequest.objects.get_or_create(
                request_code=request_code,
                defaults={
                    "status": "PENDING",
                    "file_name": f"pending_{request_code}",
                    "date_range_start": date_range_start,
                    "date_range_end": date_range_end,
                    "geom_bounds": peru_bbox_polygon
                }
            )

        # === Invocación del servicio orquestador ===
        orchestrator = ECMWFRequestService(ecmwf_request_instance=request_obj)
        result = orchestrator.process_request(total_hours=total_hours)

        logger.info(f"✅ [Job ECMWF] Ingesta completada exitosamente: {request_code}")
        return result

    except Exception as exc:
        logger.error(f"❌ [Job ECMWF Error] Falló la ejecución automática: {str(exc)}")
        # Reintento programado ante fallos de red o HTTP 404 momentáneos en ECMWF
        raise self.retry(exc=exc)