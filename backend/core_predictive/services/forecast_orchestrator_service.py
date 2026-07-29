import os
import time
import logging
from typing import Dict, Any, Tuple, List
from django.db import transaction
from django.core.exceptions import ValidationError

from core_predictive.models import GFSRequest
from core_predictive.services.ingest_data_postgis_service import InsertDataToPostGIS
from core_predictive.services.intersection_service import GridIntersectionService
from core_predictive.services.download_data_service import GFSDataService
from core_predictive.services.cluster_service import SpatialClusteringService
from core_predictive.constants import GFS_TOTAL_HOURS_FORECAST

from alerts_management.tasks import process_forecast_and_adapt_alerts_task

logger = logging.getLogger(__name__)


class ForecastRainRequestService:
    """
        Servicio de Orquestación y Persistencia en Base de Datos:
            - Coordina la ingesta vectorial directa en PostGIS (GFSActiveCell), el Spatial Join indexado con distritos y la clasificación de umbrales en Backend.
            
        Aplica una arquitectura segregada por sub-métodos atómicos por cada servicio consumido.
    """

    def __init__(self, 
        gfs_request_instance: GFSRequest,
        target_variable_id: int,
        natural_phenomena_id: int
    ):
        """
            Inicializa el servicio de orquestación y persistencia de datos GFS.
            Args:
                gfs_request_instance: Instancia de GFSRequest.
                target_variable_id: ID de la variable objetivo.
                natural_phenomena_id: ID del fenómeno natural.
        """
        if not gfs_request_instance or not gfs_request_instance.pk:
            raise ValidationError("La instancia de GFSRequest debe estar previamente registrada en la BD.")

        self.request_obj = gfs_request_instance
        self.target_variable_id = target_variable_id
        self.natural_phenomena_id = natural_phenomena_id
        
        # Servicios de Dominio Consumidos
        self.data_service = GFSDataService()
        self.ingestion_service = InsertDataToPostGIS()

    def process_request(self, 
        total_hours: int = GFS_TOTAL_HOURS_FORECAST
    ) -> Dict[str, Any]:
        """
            Método Orquestador Principal
            - Coordina las 5 etapas end-to-end invocando sub-métodos privados especializados:
                1. `_update_status`: Cambia el estado de la solicitud en PostgreSQL de forma aislada.
                2. `_execute_data_download`: Consume GFSDataService y extrae métricas I/O del archivo descargado.
                3. `_ingest_raster_data`: Consume InsertDataToPostGIS para la vectorización en la tabla gfs_active_cells.
                4. `_evaluate_spatial_intersections`: Consume GridIntersectionService para ejecutar el Spatial Join ST_Intersects en PostGIS y clasificación de umbrales en Backend.
                5. `_finalize_success_transaction`: Persistencia transaccional final y transición a COMPLETED.
        """
        start_time = time.time()
        
        # === Transicionar al Estado PROCESSING === 
        self._update_status("PROCESSING")

        try:
            # === Descarga del Binario I/O y Cálculo de Métricas === 
            file_path, file_name, file_size_mb, download_duration = self._execute_data_download(
                total_hours=total_hours, 
                start_time=start_time
            )

            # === Ingesta Vectorial Directa a PostGIS === 
            total_active_cells = self._ingest_raster_data(file_path=file_path)

            # === Generación de Clústeres === 
            clusters = self._generate_clusters()
            

            # === Spatial Join ST_Intersects y Clasificación de Umbrales === 
            # self._evaluate_spatial_intersections()

            # === Persistencia Transaccional Final y Transición a COMPLETED === 
            self._finalize_success_transaction(
                file_name=file_name,
                file_path=file_path,
                file_size_mb=file_size_mb,
                download_duration=download_duration
            )

            # === Desencadenar el proceso de adaptación de las alertas al nuevo pronóstico ===
            process_forecast_and_adapt_alerts_task.apply_async(
                args=[self.request_obj.id],
                countdown=2  # Pequeño buffer para asegurar la visibilidad del COMMIT en BD
            )

            logger.info(
                f"[Orquestador BD] Solicitud {self.request_obj.request_code} COMPLETADA. "
                f"({total_active_cells} celdas procesadas en {download_duration}s)"
            )

            return {
                "request_id": self.request_obj.id,
                "request_code": self.request_obj.request_code,
                "status": self.request_obj.status,
                "total_active_cells": total_active_cells,
                "metrics": {
                    "file_name": file_name,
                    "file_path": file_path,
                    "file_size_mb": file_size_mb,
                    "download_time_seconds": download_duration
                }
            }

        except Exception as e:
            error_msg = f"Error durante la ingesta y persistencia en BD: {str(e)}"
            logger.error(f"[Orquestador BD Error] Request {self.request_obj.request_code}: {error_msg}")
            
            # Marcado de consistencia en BD ante fallos
            self._update_status("FAILED")
            raise ValidationError(error_msg)

    def _generate_clusters(self) -> List[Dict[str, Any]]:
        """ Sub-método especializado que consume el SpatialClusteringService. """
        logger.info(f"[Orquestador BD] Generando clústeres disueltos espacio-temporales (DBSCAN)...")
        return SpatialClusteringService.generate_and_persist_clusters(
            gfs_request_id=self.request_obj.id,
            target_variable_id=self.target_variable_id,
            natural_phenomena_id=self.natural_phenomena_id
        )

    # =========================================================================
    # MÉTODOS PRIVADOS ATÓMICOS POR SERVICIO / DOMINIO CONSUMIDO
    # =========================================================================

    def _update_status(self, new_status: str) -> None:
        """ 
            Sub-método 1: Cambia el estado de la solicitud en PostgreSQL de forma aislada. 
        """
        self.request_obj.status = new_status
        self.request_obj.save(update_fields=['status'])

    def _execute_data_download(self, total_hours: int, start_time: float) -> Tuple[str, str, float, float]:
        """ 
            Sub-método 2: Consume GFSDataService y extrae métricas I/O del archivo descargado. 
        """
        logger.info(f"[Orquestador BD] Iniciando descarga para Request Code: {self.request_obj.request_code}")

        # --- Consume GFSDataService ---
        download_result = self.data_service.execute_download_data(
            request_code=self.request_obj.request_code,
            total_hours=total_hours
        )

        # --- Métricas I/O del archivo descargado ---
        file_path = download_result["file_path"]
        file_name = download_result["file_name"]
        download_duration = round(time.time() - start_time, 2)

        file_size_bytes = os.path.getsize(file_path) if os.path.exists(file_path) else 0
        file_size_mb = round(file_size_bytes / (1024 * 1024), 2)

        return file_path, file_name, file_size_mb, download_duration

    def _ingest_raster_data(self, file_path: str) -> int:
        """ 
            Sub-método 3: Consume InsertDataToPostGIS para la vectorización en la tabla gfs_active_cells. 
        """
        logger.info(f"[Orquestador BD] Vectorizando e ingresando celdas directamente a PostGIS...")
        
        # --- Consume InsertDataToPostGIS ---
        ingest_result = self.ingestion_service.process_and_ingest_raster(
            gfs_request=self.request_obj,
            file_path=file_path
        )
        
        return ingest_result.get('total_active_cells', 0)

    def _evaluate_spatial_intersections(self) -> None:
        """ 
            Sub-método 4: Consume GridIntersectionService para ejecutar el Spatial Join ST_Intersects en PostGIS. 
        """
        logger.info(f"[Orquestador BD] Ejecutando Spatial Join ST_Intersects y mapeo de umbrales...")
        
        # --- Consume GridIntersectionService ---
        GridIntersectionService.intersect_cells_with_districts(
            gfs_request_id=self.request_obj.id,
            target_variable_id=self.target_variable_id,
            natural_phenomena_id=self.natural_phenomena_id
        )

    def _finalize_success_transaction(
        self, 
        file_name: str, 
        file_path: str, 
        file_size_mb: float, 
        download_duration: float
    ) -> None:
        """ 
            Sub-método 5: Finaliza la transacción atómica registrando metadatos y estado COMPLETED. 
        """

        # --- Transacción Atómica Final ---
        with transaction.atomic():
            self.request_obj.status = "COMPLETED"
            self.request_obj.file_name = file_name
            self.request_obj.file_path = file_path
            self.request_obj.file_size_mb = file_size_mb
            self.request_obj.download_time_seconds = download_duration
            self.request_obj.save()