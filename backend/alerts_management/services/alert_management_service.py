# alerts_management/services/alert_reconciliation_service.py

import logging
from datetime import datetime, timedelta
from typing import Tuple, List, Set, Dict, Any, Optional
from django.db import transaction
from django.utils import timezone
from django.contrib.gis.geos import GEOSGeometry

from alerts_management.models import (
    Alert, AlertClusters, AlertClustersComponents, 
    AlertHistory, AlertStatus, AlertNotification, 
    NotificationType, NotificationChannel
)
from alerts_management.constants import INERTIA_HOURS

logger = logging.getLogger(__name__)


class AlertManagementService:

    # =========================================================================
    # 1. ORQUESTADOR PRINCIPAL (Limpiado - Control de Flujo de Alto Nivel)
    # =========================================================================
    @classmethod
    def adapt_alerts_to_gfs_forecast(
        cls, 
        gfs_request_id: int, 
        natural_phenomena_id: int,
        impacted_records: list
    ) -> int:
        """
            Orquesta la adaptación de alertas frente a los clústeres del pronóstico GFS.

            @params:
                `gfs_request_id` (`int`): ID de la solicitud GFS.
                `natural_phenomena_id` (`int`): ID del fenómeno natural.
                `impacted_records` (`list`): Lista de registros de impactos GFS.

            @returns:
                `int`: Número de alertas adaptadas.
        """
        logger.info(f"Adaptando {len(impacted_records)} impactos GFS para Request #{gfs_request_id}...")

        with transaction.atomic():
            now = timezone.now()
            active_alerts = list(Alert.objects.filter(
                end_time_utc__gte=now - timedelta(hours=INERTIA_HOURS)
            ))
            
            edited_alert_ids: Set[int] = set()
            persisted_snapshots_count = 0

            for record in impacted_records:
                cluster = record["cluster_snapshot"]
                components = record["impacted_components"]
                point_impacted = record["point_impacted"]

                # === Deducir del intervalo temporal del paso [t-1, t] ===
                step_start_utc, step_end_utc = cls._parse_step_time_window(cluster)

                # === Búsqueda de coincidencia inercial con alertas activas ===
                matched_alert = cls._find_matching_active_alert(cluster.geometry, step_start_utc, active_alerts)

                if matched_alert:
                    alert = cls._extend_existing_alert(matched_alert, cluster, step_start_utc, step_end_utc)
                else:
                    alert = cls._create_new_alert_with_fsm(natural_phenomena_id, cluster, step_start_utc, step_end_utc)
                    active_alerts.append(alert)

                edited_alert_ids.add(alert.id)

                # === Guardar el clúster y sus componentes intersecados ===
                cls._persist_cluster_snapshot_and_components(alert, cluster, point_impacted, components)
                persisted_snapshots_count += 1

            # === Evaluar reprogramar o cancelar alertas ===
            cls._evaluate_reevaluations_and_cancellations(active_alerts, edited_alert_ids)

            return persisted_snapshots_count

    # =========================================================================
    # 2. SUB-MÉTODOS ESPECIALIZADOS (Descomposición del God Method)
    # =========================================================================

    @staticmethod
    def _parse_step_time_window(
        cluster: Any
    ) -> Tuple[datetime, datetime]:
        """
            Deduce la hora de inicio y fin del paso de tiempo [t-1, t] a partir del objeto clúster.

            @params:
                `cluster` (`Any`): Objeto clúster.

            @returns:
                `Tuple[datetime, datetime]`: Tupla de horas de inicio y fin.
        """
        step_end_utc = cluster.timestamp_utc
        step_start_utc = step_end_utc - timedelta(hours=1)
        return step_start_utc, step_end_utc

    @classmethod
    def _extend_existing_alert(
        cls, 
        alert: Alert, 
        cluster: Any, 
        step_start_utc: datetime, 
        step_end_utc: datetime
    ) -> Alert:
        """
            Actualiza los límites temporales e intensidades de una alerta activa existente,
            e inactiva los pronósticos solapados (Overwriting).

            @params:
                `alert` (`Alert`): Alerta activa.
                `cluster` (`Any`): Objeto clúster.
                `step_start_utc` (`datetime`): Hora de inicio del paso de tiempo.
                `step_end_utc` (`datetime`): Hora de fin del paso de tiempo.

            @returns:
                `Alert`: Alerta actualizada.
        """
        if step_end_utc > alert.end_time_utc:
            alert.end_time_utc = step_end_utc

        if step_start_utc < alert.start_time_utc:
            alert.start_time_utc = step_start_utc

        if float(cluster.max_intensity_mm_h) > float(alert.max_intensity_mm_h):
            alert.max_intensity_mm_h = cluster.max_intensity_mm_h
            alert.max_threshold_id = cluster.threshold_id

        alert.save()

        # Inactivar pronósticos anteriores en la misma ventana para esta alerta
        AlertClusters.objects.filter(
            alert=alert,
            is_active_forecast=True,
        ).update(is_active_forecast=False)

        return alert

    @classmethod
    def _create_new_alert_with_fsm(
        cls, 
        natural_phenomena_id: int, 
        cluster: Any, 
        step_start_utc: datetime, 
        step_end_utc: datetime
    ) -> Alert:
        """
            Crea una nueva alerta en base de datos, registra su estado inicial 'Predicho' 
            en AlertHistory y encola la notificación inicial para Telegram.

            @params:
                `natural_phenomena_id` (`int`): ID del fenómeno natural.
                `cluster` (`Any`): Objeto clúster.
                `step_start_utc` (`datetime`): Hora de inicio del paso de tiempo.
                `step_end_utc` (`datetime`): Hora de fin del paso de tiempo.

            @returns:
                `Alert`: Alerta creada.
        """
        new_code = Alert.generate_next_code()
        alert = Alert.objects.create(
            natural_phenomena_id=natural_phenomena_id,
            code=new_code,
            max_intensity_mm_h=cluster.max_intensity_mm_h,
            max_threshold_id=cluster.threshold_id,
            start_time_utc=step_start_utc,
            end_time_utc=step_end_utc
        )

        target_status = AlertStatus.objects.get(
            name="PREDICHO"
        )

        initial_history = AlertHistory.objects.create(
            alert=alert,
            status=target_status,
            # phase=None,
            created_by=None
        )

        notification_obj = AlertNotification.objects.create(
            alert_history=initial_history,
            channel=NotificationChannel.TELEGRAM,
            notification_type=NotificationType.NEW_ALERT,
            is_sent=False,
            notification_reason="Emisión de nueva alerta predicha por detección de hotspot meteorológico."
        )

        cls._dispatch_telegram_task(notification_obj.id)
        return alert

    @staticmethod
    def _persist_cluster_snapshot_and_components(
        alert: Alert, 
        cluster: Any, 
        point_impacted: GEOSGeometry, 
        components: list
    ) -> AlertClusters:
        """
            Crea el snapshot de AlertClusters y realiza la inserción masiva (bulk_create) 
            de los componentes afectados en esa hora.

            @params:
                `alert` (`Alert`): Alerta activa.
                `cluster` (`Any`): Objeto clúster.
                `point_impacted` (`GEOSGeometry`): Punto impactado.
                `components` (`list`): Lista de componentes afectados.

            @returns:
                `AlertClusters`: Snapshots de clúster.
        """
        alert_cluster = AlertClusters.objects.create(
            alert=alert,
            cluster=cluster,
            representative_point=point_impacted,
            is_active_forecast=True
        )

        comp_records = [
            AlertClustersComponents(
                alert_cluster=alert_cluster,
                component=comp,
                intensity_at_component=cluster.max_intensity_mm_h
            )
            for comp in components
        ]
        AlertClustersComponents.objects.bulk_create(comp_records)
        return alert_cluster

    # =========================================================================
    # EVALUACIÓN DE CLUSTERS Y NOTIFICACIONES DE ALERTAS
    # =========================================================================

    @classmethod
    def _find_matching_active_alert(
        cls,
        geometry: GEOSGeometry,
        timestamp_utc: datetime,
        active_alerts: list[Alert]
    ) -> Optional[Alert]:
        """
            Busca intersección espacial directa contra los clústeres activos de alertas en estado 'Predicho'.

            @params:
                `geometry` (`GEOSGeometry`): Geometría del clúster.
                `timestamp_utc` (`datetime`): Marca de tiempo UTC.
                `active_alerts` (`list[Alert]`): Lista de alertas activas.

            @returns:
                `Optional[Alert]`: Alerta coincidente.
        """
        cutoff_start = timestamp_utc - timedelta(hours=INERTIA_HOURS)

        matching_cluster = AlertClusters.objects.filter(
            alert__in=active_alerts,
            alert__history__status__name="Predicho",
            is_active_forecast=True,
            alert__end_time_utc__gte=cutoff_start,
            cluster__geometry__intersects=geometry
        ).select_related('alert').first()

        return matching_cluster.alert if matching_cluster else None

    @classmethod
    def _evaluate_reevaluations_and_cancellations(
        cls,
        active_alerts: list[Alert],
        edited_alert_ids: Set[int]
    ) -> None:
        """
            Evalúa reprogramaciones (RESCHEDULED) y cancelaciones (CANCELLED) por disipación hídrica.

            @params:
                `active_alerts` (`list[Alert]`): Lista de alertas activas.
                `edited_alert_ids` (`Set[int]`): Conjunto de IDs de alertas editadas.

            @returns:
                `None`
        """
        now = timezone.now()

        for alert in active_alerts:
            if alert.id not in edited_alert_ids and alert.start_time_utc > now:
                future_step = AlertClusters.objects.filter(
                    alert=alert,
                    is_active_forecast=True,
                    timestamp_utc__gt=now
                ).order_by('timestamp_utc').first()

                latest_history = AlertHistory.objects.filter(alert=alert).order_by('-created_at').first()

                if future_step:
                    new_start_time = future_step.timestamp_utc
                    if new_start_time != alert.start_time_utc:
                        alert.start_time_utc = new_start_time
                        alert.save()

                        if latest_history:
                            notification_obj = AlertNotification.objects.create(
                                alert_history=latest_history,
                                channel=NotificationChannel.TELEGRAM,
                                notification_type=NotificationType.RESCHEDULED,
                                is_sent=False,
                                notification_reason=f"Reprogramación por desplazamiento hídrico. Nueva hora: {new_start_time.strftime('%H:%M UTC')}"
                            )
                            cls._dispatch_telegram_task(notification_obj.id)
                else:
                    AlertClusters.objects.filter(alert=alert).update(is_active_forecast=False)
                    if latest_history:
                        notification_obj = AlertNotification.objects.create(
                            alert_history=latest_history,
                            channel=NotificationChannel.TELEGRAM,
                            notification_type=NotificationType.CANCELLED,
                            is_sent=False,
                            notification_reason="Cancelación: La actualización del modelo GFS indica la disipación del fenómeno."
                        )
                        cls._dispatch_telegram_task(notification_obj.id)

    @staticmethod
    def _dispatch_telegram_task(notification_id: int) -> None:
        """
        Dispara la tarea de Celery asegurando el evento 'on_commit' de la transacción SQL.
        """
        from alerts_management.tasks import send_telegram_notification_task
        transaction.on_commit(
            lambda: send_telegram_notification_task.apply_async(
                args=[notification_id],
                countdown=1
            )
        )