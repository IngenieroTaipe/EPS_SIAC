# core_predictive/tasks.py

import logging
# pyrefly: ignore [missing-import]
from celery import shared_task
from django.core.cache import cache

from core_predictive.utils.time_utils import ForecastClockService
from core_predictive.services.request_factory import GFSRequestFactory
from core_predictive.services.forecast_orchestrator_service import ForecastRainRequestService
from core_predictive.services.download_data_service import GFSDataService
from core_predictive.constants import GFS_TOTAL_HOURS_FORECAST

logger = logging.getLogger(__name__)
LOCK_EXPIRE_SECONDS = 60 * 60 * 2 # 2 horas TTL


@shared_task(
    name="core_predictive.tasks.run_scheduled_gfs_download",
    bind=True,
    max_retries=3,
    default_retry_delay=600
)
def run_scheduled_gfs_download(self):
    """
        Coordina el disparo de la descarga e ingesta del pronóstico climático.
        El task delega el flujo a los servicios especializados para descargar,
        procesar y almacenar el pronóstico.
    """
    # === Determinar código y fecha de ejecución de pronóstico ===
    request_code, now_utc = ForecastClockService.get_current_run_code()
    
    # === Control de Concurrencia (Redis Lock) ===
    lock_id = f"redis_lock_gfs_{request_code}"

    if not cache.add(lock_id, "locked", LOCK_EXPIRE_SECONDS):
        logger.warning(f"[Skip Task] La ejecución {request_code} ya está en proceso por otro Worker.")
        return {"status": "SKIPPED", "reason": "LOCK_ACTIVE"}

    try:
        # === Verificación si la info ya fue procesada ===
        if GFSDataService().is_data_already_processed(request_code=request_code):
            logger.info(f"[Skip Task] La ejecución {request_code} ya se encuentra COMPLETED.")
            return {"status": "SKIPPED", "reason": "ALREADY_COMPLETED"}

        logger.info(f"[Worker GFS] Iniciando automatización delegada para {request_code}...")

        # === Creación/Recuperación del registro de la ejecución en PostGIS ===
        request_obj, var_id, phenom_id = GFSRequestFactory.get_or_create_pending_request(
            request_code=request_code, 
            now_utc=now_utc
        )

        # === Ejecución del Pipeline de Dominio (Descarga -> Staging -> Spatial Join -> Thresholds) ===
        orchestrator = ForecastRainRequestService(
            gfs_request_instance=request_obj,
            target_variable_id=var_id,
            natural_phenomena_id=phenom_id
        )
        
        return orchestrator.process_request(total_hours=GFS_TOTAL_HOURS_FORECAST)

    except Exception as exc:
        logger.error(f"[Worker GFS Error] Falló la tarea {request_code}: {str(exc)}")
        cache.delete(lock_id)
        raise self.retry(exc=exc)

    finally:
        # Liberación garantizada del candado distribuido
        cache.delete(lock_id)