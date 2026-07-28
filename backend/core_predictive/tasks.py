import logging

from datetime import datetime
from celery import shared_task
from django.db import transaction
from django.contrib.gis.geos import Polygon
from django.utils import timezone
from datetime import timedelta
from core_predictive.models import GFSRequest
from core_predictive.services import (
    GFSDataService,
    ForecastRainRequestService
)

from core_predictive.constants import (
    GFS_TOTAL_HOURS_FORECAST
)

logger = logging.getLogger(__name__)

@shared_task(
    name="core_predictive.tasks.run_scheduled_gfs_download",
    bind=True,
    max_retries=3,
    default_retry_delay=600  # Reintento después de 10 min
)
def run_scheduled_gfs_download(self):
    """
        Tarea Celery de Fondo (Worker):
        Orquesta la descarga periódica del modelo GFS de NOAA.
        Verifica la existencia previa de la ejecución, crea el registro en BD
        y ejecuta la conversión y la intersección de distritos.
    """
    now_utc = datetime.utcnow() # Hora Universal
    
    # === Creación del código de Request ===
    run_hour_int = 0 if now_utc.hour < 12 else 12
    run_time_str = f"{run_hour_int:02d}Z" # Genera '00Z' o '12Z'
    date_str = now_utc.strftime('%Y%m%d')
    
    # Clave de Negocio Unívoca Trazable (Business Key)
    request_code = f"AUTO_{date_str}_{run_time_str}"

    gfs_service = GFSDataService()

    # === Verifica que el archivo no haya sido descargado previamente ===
    if gfs_service.is_data_already_processed(request_code=request_code):
        logger.info(f"⚡ [Skip Download] La ejecución {request_code} ya existe en estado COMPLETED.")
        return {"status": "SKIPPED", "message": "Ejecución previamente descargada."}

    logger.info(f"🚀 [Job GFS] Iniciando automatización para ejecución {request_code}...")

    try:
        # === Creación del registro trazable en Base de Datos (PostGIS) ===
        peru_bbox_polygon = Polygon((
            (-81.5, -18.5),
            (-68.5, -18.5),
            (-68.5, 0.5),
            (-81.5, 0.5),
            (-81.5, -18.5)
        ), srid=4326)

        date_range_start = timezone.now()
        date_range_end = date_range_start + timedelta(hours=GFS_TOTAL_HOURS_FORECAST)

        with transaction.atomic():
            request_obj, created = GFSRequest.objects.get_or_create(
                request_code=request_code,
                defaults={
                    "status": "PENDING",
                    "file_name": f"pending_{request_code}",
                    "date_range_start": date_range_start,
                    "date_range_end": date_range_end,
                    "geom_bounds": peru_bbox_polygon
                }
            )

        data_service = ForecastRainRequestService(request_obj)
        result = data_service.process_request()

        logger.info(f"[Job GFS] Ingesta completada exitosamente: {request_code}")
        return result

    except Exception as exc:
        logger.error(f"[Job GFS Error] Falló la ejecución automática: {str(exc)}")
        # Reintento programado ante fallos de red o HTTP 404 momentáneos en ECMWF
        raise self.retry(exc=exc)