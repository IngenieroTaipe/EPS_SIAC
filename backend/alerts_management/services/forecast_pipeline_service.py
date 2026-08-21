# alerts_management/services/forecast_pipeline_service.py

import logging
from typing import Tuple
from core_predictive.models import GFSRequest, NaturalPhenomena
from alerts_management.services.infrastructure_intersection_service import InfrastructureIntersectionService
from alerts_management.services.alert_management_service import AlertManagementService

logger = logging.getLogger(__name__)


class ForecastPipelineDomainService:
    """
    Servicio de Dominio: Orquesta el procesamiento espacial del pronóstico GFS
    y la adaptación de alertas sobre la infraestructura de la EPS.
    """

    @classmethod
    def execute_forecast_adaptation(cls, gfs_request_id: int) -> Tuple[bool, int, str]:
        """
        Ejecuta de forma atómica las Etapas 3, 4 y 5 del Pipeline de Alertas.

        Returns:
            Tuple[success, count_of_alerts, message]
        """
        natural_phenomena = NaturalPhenomena.objects.filter(name="LLUVIAS INTENSAS").first()

        if not natural_phenomena:
            msg = "Fenómeno natural 'LLUVIAS INTENSAS' no configurado en la base de datos."
            logger.error(f"[Pipeline Domain] {msg}")
            return False, 0, msg

        # === Validar existencia ===
        gfs_request = GFSRequest.objects.filter(pk=gfs_request_id, status='COMPLETED').first()
        if not gfs_request:
            msg = f"GFSRequest #{gfs_request_id} no existe o no está en estado COMPLETED."
            logger.warning(f"[Pipeline Domain] {msg}")
            return True, 0, msg

        # === Intersectar clústeres espacialmente con componentes EPS (PostGIS ST_Intersects) ===
        impacted_clusters = InfrastructureIntersectionService.get_impacted_components_by_clusters(gfs_request_id)
        if not impacted_clusters:
            msg = f"No se detectó impacto en infraestructura para GFSRequest #{gfs_request_id}."
            logger.info(f"[Pipeline Domain] {msg}")
            return True, 0, msg

        # === Adaptar alertas al nuevo pronóstico ===
        count_of_alerts = AlertManagementService.adapt_alerts_to_gfs_forecast(
            gfs_request_id, 
            natural_phenomena.id, 
            impacted_clusters
        )

        msg = f"Adaptación finalizada. Alertas generadas: {count_of_alerts}"
        logger.info(f"[Pipeline Domain] {msg}")
        return True, count_of_alerts, msg