# alerts_management/services/notification_service.py

from alerts_management.models import AlertClusters
import logging
from dataclasses import dataclass
from typing import List, Tuple, Optional
from django.utils import timezone

from alerts_management.models import AlertNotification, Alert, AlertClusters
from organization.models import Branch
from places.models import District
from core_shared.constants import LIMA_TZ

logger = logging.getLogger(__name__)


@dataclass
class NotificationPayloadDTO:
    """Objeto DTO para transferir datos limpios a la capa de mensajería."""
    notification_id: int
    alert_code: str
    unidades_operativas: List[str]
    max_threshold_str: str
    start_local: timezone.datetime
    end_local: Optional[timezone.datetime]
    latitude: Optional[float]
    longitude: Optional[float]


class NotificationDomainService:
    """Servicio de Dominio: Encargado del acceso a datos y geoprocesamiento relacional."""

    @classmethod
    def get_notification_payload(cls, notification_id: int) -> Optional[NotificationPayloadDTO]:
        """
            Recupera la notificación, resuelve el punto representativo en PostGIS
            y filtra las Unidades Operativas activas mediante mapeo en memoria O(1).

            `@params`:
                `notification_id` (`int`): ID de la notificación.

            `@return`:
                `Optional[NotificationPayloadDTO]`: DTO con los datos de la notificación.
                    `notification` (`AlertNotification`): Notificación.
                    `alert` (`Alert`): Alerta asociada a la notificación.
                    `active_snapshot` (`AlertClustersAlert`): Snapshot activo del clúster.
                    `unidades` (`List[str]`): Unidades operativas afectadas.
                    `max_threshold_str` (`str`): Intensidad de la alerta.
                    `start_local` (`timezone.datetime`): Fecha y hora de inicio de la alerta en formato local.
                    `end_local` (`Optional[timezone.datetime]`): Fecha y hora de fin de la alerta en formato local.
                    `latitude` (`Optional[float]`): Latitud del punto representativo.
                    `longitude` (`Optional[float]`): Longitud del punto representativo.
        """
        try:
            notification = AlertNotification.objects.select_related(
                'alert_history__alert__natural_phenomena',
                'alert_history__alert__max_threshold'
            ).get(pk=notification_id)
        except AlertNotification.DoesNotExist:
            logger.error(f"[Domain Service] Notificación #{notification_id} no existe.")
            return None

        if notification.is_sent:
            logger.info(f"[Domain Service] Notificación #{notification_id} ya enviada. Omitiendo.")
            return None

        alert = notification.alert_history.alert
        active_snapshot = alert.alerts_clusters_alerts.filter(
            is_active_forecast=True
        ).select_related('cluster').first()

        # === Resolución Espacial de Unidades Operativas (Process in Batch) ===
        unidades = cls._resolve_operational_units(active_snapshot)

        # === Conversión Geodésica de Coordenadas EPSG:4326 ===
        lat, lon = None, None
        if active_snapshot and active_snapshot.representative_point:
            lat = round(active_snapshot.representative_point.y, 6)
            lon = round(active_snapshot.representative_point.x, 6)

        start_local = alert.start_time_utc.astimezone(LIMA_TZ)
        end_local = alert.end_time_utc.astimezone(LIMA_TZ) if alert.end_time_utc else None

        return NotificationPayloadDTO(
            notification_id=notification.id,
            alert_code=alert.code,
            unidades_operativas=unidades,
            max_threshold_str=f"{alert.max_threshold} " if alert.max_threshold else "N/A",
            start_local=start_local,
            end_local=end_local,
            latitude=lat,
            longitude=lon
        )

    @staticmethod
    def _resolve_operational_units(alert_clusters: AlertClusters) -> List[str]:
        """
            Filtra los distritos impactados por el clúster conservando solo
            aquellos con Sucursales/Unidades Operativas activas.

            `@params`:
                `alert_clusters` (`AlertClusters`): Snapshot activo del clúster.

            `@return`:
                `List[str]`: Lista de Unidades Operativas afectadas.
        """
        if not alert_clusters or not alert_clusters.cluster or not alert_clusters.cluster.affected_ubigeos:
            return ["Selva Central - Cobertura EPS"]

        affected_ubigeos = alert_clusters.cluster.affected_ubigeos

        # Extraemos los branches para garantizar que no se alerte a Distritos sin unidades operativas
        operational_ubigeos_set = set(
            Branch.objects.filter(
                status=True,
                district__deleted_at__isnull=True
            ).values_list('district__ubigeo', flat=True).distinct()
        )

        valid_ubigeos = [u for u in affected_ubigeos if u in operational_ubigeos_set]

        if valid_ubigeos:
            unidades = list(
                District.objects.filter(ubigeo__in=valid_ubigeos).values_list('name', flat=True)
            )
            if unidades:
                return unidades

        return ["Selva Central - Cobertura EPS"]

    @staticmethod
    def mark_as_sent(notification_id: int) -> None:
        """Marca la notificación como entregada de forma atómica."""
        AlertNotification.objects.filter(pk=notification_id).update(
            is_sent=True,
            sent_at=timezone.now()
        )