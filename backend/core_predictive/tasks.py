# core_predictive/tasks.py

import logging
# pyrefly: ignore [missing-import]
from celery import shared_task
from django.core.cache import cache
from django.utils import timezone
from django.db import transaction
from datetime import timedelta

from core_predictive.models import (
    GFSActiveCell,
    GFSClusterSnapshot
)
from core_predictive.utils.time_utils import ForecastClockService
from core_predictive.services.request_factory import GFSRequestFactory
from core_predictive.services.forecast_orchestrator_service import ForecastRainRequestService
from core_predictive.services.download_data_service import GFSDataService
from core_predictive.constants import (
    GFS_TOTAL_HOURS_FORECAST,
    ACTIVE_CELLS_RETENTION_DAYS,
    CLUSTER_SNAPSHOTS_RETENTION_DAYS
)

logger = logging.getLogger(__name__)
LOCK_EXPIRE_SECONDS = 60 * 60 * 2 # 2 horas TTL

# === Cache keys del GeoJSON builder (sincronizadas con views.py) ===
# Estas son las keys que el backend guarda en LocMem/Redis con TTL de 6h.
# Se invalidan automáticamente cuando una corrida nueva queda COMPLETED,
# para que el frontend vea data fresca en el próximo polling (5 min) sin
# necesidad de reiniciar la API manualmente.
GFS_CACHE_KEYS = [
    "gfs_window_18h_clusters_geojson",   # /window-18h/  (timeline)
    "gfs_latest_clusters_geojson",       # /latest/     (clusters)
    "gfs_latest_cells_geojson",          # /latest/      (celdas)
]


def _invalidate_gfs_cache():
    """
        Borra todas las keys de caché del GeoJSON de GFS.
        Se invoca después de que una corrida queda COMPLETED exitosamente,
        para que el próximo request al endpoint sirva data fresca en vez
        de la respuesta "congelada" por 6h (TTL del GISCacheManager).
    """
    for key in GFS_CACHE_KEYS:
        cache.delete(key)
    logger.info(f"[Cache] Invalidadas {len(GFS_CACHE_KEYS)} keys de GeoJSON GFS.")


# =========================================================================
# DESCARGA DEL PRONÓSTICO NOAA CADA 6 HORAS
# =========================================================================
@shared_task(
    name="core_predictive.tasks.run_scheduled_gfs_download",
    bind=True,
    max_retries=8,                # === FIX === antes 3 → 8 reintentos.
                                  # NOAA tarda ~3h36min en publicar f012 desde el run.
                                  # Cron a +1h del run → primer intento a H+1h, último a H+5h.
                                  # 8 reintentos × 30min = 4h ventana total, cubre el retardo.
    default_retry_delay=1800      # === FIX === antes 600s (10min) → 1800s (30min).
                                  # Cad media hora reintenta; NOAA sube los .idx de golpe,
                                  # no tiene sentido chequear cada 10min (overhead en S3).
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
        
        result = orchestrator.process_request(total_hours=GFS_TOTAL_HOURS_FORECAST)

        # === FIX: Invalidar caché del GeoJSON tras una corrida exitosa ===
        # Sin esto, el backend seguiría sirviendo la response "congelada" por
        # hasta 6h (TTL del GISCacheManager), y el frontend no vería la nueva
        # corrida aunque su polling de 5 min dispare un refetch. Con esta
        # invalidación, el próximo request al endpoint reconstruye el JSON
        # desde PostGIS con la corrida nueva ya persistida.
        _invalidate_gfs_cache()

        return result

    except Exception as exc:
        # === FIX === Distingue el caso "NOAA aún no publicó" para log más legible.
        # La excepción `ValidationError` con mensaje "NOAA no ha publicado..." viene
        # de `_fetch_remote_dataset` cuando el `.idx` no existe en S3 todavía.
        msg = str(exc)
        is_pending_publication = "no ha publicado" in msg.lower() or "idx" in msg.lower()
        if is_pending_publication:
            logger.warning(
                f"[Retry] NOAA aún no publica {request_code} (reintento {self.request.retries}/{self.max_retries}). "
                f"Próximo intento en {self.default_retry_delay}s."
            )
        else:
            logger.error(f"[Worker GFS Error] Falló la tarea {request_code}: {msg}")
        cache.delete(lock_id)
        raise self.retry(exc=exc)

    finally:
        # Liberación garantizada del candado distribuido
        cache.delete(lock_id)

# =========================================================================
# PURGA DIARIA DE CELDAS ACTIVAS (GFSActiveCell)
# =========================================================================
@shared_task(
    name="core_predictive.tasks.purge_daily_active_cells",
    bind=True,
    max_retries=2,
    default_retry_delay=60
)
def purge_daily_active_cells_task(self, retention_days: int = ACTIVE_CELLS_RETENTION_DAYS) -> int:
    """
    Tarea de Mantenimiento Diario:
    Elimina registros vectoriales de celdas activas con una antigüedad mayor a retention_days.
    """
    cutoff_date = timezone.now() - timedelta(days=retention_days)
    logger.info(f"[DB Maintenance] Iniciando purga de GFSActiveCell anteriores a: {cutoff_date.isoformat()}...")

    total_deleted = 0
    BATCH_SIZE = 5000

    try:
        # Paginación en lotes para evitar bloqueos exclusivos en PostgreSQL
        while True:
            cell_ids = list(
                GFSActiveCell.objects.filter(created_at__lt=cutoff_date)
                .values_list('id', flat=True)[:BATCH_SIZE]
            )
            
            if not cell_ids:
                break

            with transaction.atomic():
                deleted_count, _ = GFSActiveCell.objects.filter(id__in=cell_ids).delete()
                total_deleted += deleted_count

            logger.info(f"[DB Maintenance] Lote de {len(cell_ids)} celdas depurado...")

        logger.info(f"[DB Maintenance] Purga completada. Total de celdas eliminadas: {total_deleted}")
        return total_deleted

    except Exception as exc:
        logger.error(f"[DB Maintenance Error] Fallo al purgar GFSActiveCell: {str(exc)}")
        raise self.retry(exc=exc)
    

# =========================================================================
# PURGA SEMANAL DE CLÚSTERES HUÉRFANOS (GFSClusterSnapshot)
# =========================================================================
@shared_task(
    name="core_predictive.tasks.purge_weekly_unlinked_clusters",
    bind=True,
    max_retries=2,
    default_retry_delay=120
)
def purge_weekly_unlinked_clusters_task(self, retention_days: int = CLUSTER_SNAPSHOTS_RETENTION_DAYS) -> int:
    """
    Tarea de Mantenimiento Semanal:
    Elimina los clústeres meteorológicos de más de retention_days que NO estén asociados
    a ninguna alerta oficial de la EPS (AlertClusters).
    """
    cutoff_date = timezone.now() - timedelta(days=retention_days)
    logger.info(f"[DB Maintenance] Iniciando purga de clústeres huérfanos anteriores a: {cutoff_date.isoformat()}...")

    total_deleted = 0
    BATCH_SIZE = 1000

    try:
        while True:
            # Clústeres que NO existen en la tabla pivote de alertas activas ni históricas
            unlinked_cluster_ids = list(
                GFSClusterSnapshot.objects.filter(
                    created_at__lt=cutoff_date,
                    alerts_clusters_clusters_snapshots__isnull=True
                )
                .values_list('id', flat=True)[:BATCH_SIZE]
            )

            if not unlinked_cluster_ids:
                break

            with transaction.atomic():
                deleted_count, _ = GFSClusterSnapshot.objects.filter(id__in=unlinked_cluster_ids).delete()
                total_deleted += deleted_count

            logger.info(f"[DB Maintenance] Lote de {len(unlinked_cluster_ids)} clústeres huérfanos depurado...")

        logger.info(f"[DB Maintenance] Purga completada. Total de clústeres huérfanos eliminados: {total_deleted}")
        return total_deleted

    except Exception as exc:
        logger.error(f"[DB Maintenance Error] Fallo al purgar GFSClusterSnapshot: {str(exc)}")
        raise self.retry(exc=exc)