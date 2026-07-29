# alerts_management/services/alert_reconciliation_service.py

from datetime import datetime
import logging
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from django.contrib.gis.geos import GEOSGeometry

from alerts_management.models import (
    Alert, AlertClusters, AlertClustersComponents, 
    AlertHistory, AlertNotification, NotificationType, NotificationChannel
)

from alerts_management.constants import (
    INERTIA_HOURS
)

logger = logging.getLogger(__name__)


class AlertManagementService:

    @classmethod
    def adapt_alerts_to_gfs_forecast(
        cls, 
        gfs_request_id: int, 
        impacted_records: list
    ) -> int:
        """
            El método se encarga de gestionar y estabilizar las alertas generadas a partir de la información de los clústeres GFS.
            Esta fase se centra en los requerimientos de negocio en las alertas:
                - Si una alerta coincide con otro cluster en el mismo intervalo horario, se mantiene la alerta y se actualizan los parámetros de máximo de intensidad y de tiempo final.
                - Si una alerta coincide con otro cluster en un intervalo horario posterior al de la alerta, se actualiza el tiempo final de la alerta.
                - Si los cluster de una alerta pierden su precipitación por un intervalo mayor al de "INERTIA_HOURS" (alert_management.constants.INERTIA_HOURS), se cierra la alerta.

            `@params:`
                `gfs_request_id (int):` ID de la solicitud GFS.
                `impacted_records (list)[cluster_snapshot, impacted_components]:` Lista de clústeres que intersecan con infraestructura, así como los componentes afectados.

            `@return:`
                `int:` Número de snapshots persistidos.
        """
        logger.info(f"Adaptando {len(impacted_records)} impactos de clústeres GFS con componentes para Request #{gfs_request_id}...")

        with transaction.atomic():
            now = timezone.now()
            
            # === Obtener alertas activas/pendientes no finalizadas ===
            active_alerts = list(Alert.objects.filter(
                end_time_utc__gte=now - timedelta(hours=INERTIA_HOURS)
                )
            )
            
            edited_alert_ids = set()
            persisted_snapshots_count = 0

            for record in impacted_records:
                cluster = record["cluster_snapshot"]
                components = record["impacted_components"]

                # === Deducimos la hora final del fenómeno [t-1, t] (el timestamp a secas representa la hora final del fenómeno) ===
                if isinstance(cluster.timestamp_utc, str):
                    step_end_utc = datetime.fromisoformat(cluster.timestamp_utc.replace("Z", "+00:00"))
                else:
                    step_end_utc = cluster.timestamp_utc

                # === Deducimos la hora de inicio del fenómeno [t-1, t] ===
                step_start_utc = step_end_utc - timedelta(hours=1)

                # === Buscar clústeres nuevos que se solapan (misma posición) con los clústeres de alertas activas ===
                matched_alert = cls._find_matching_active_alert(cluster.geometry, step_start_utc, active_alerts)

                if matched_alert:
                    alert = matched_alert
                    edited_alert_ids.add(alert.id)

                    # === Extender la fecha final si el fenómeno actual termina más tarde ===
                    if step_end_utc > alert.end_time_utc:
                        alert.end_time_utc = step_end_utc

                    # === Extender la fecha inicial si el fenómeno actual comenzó antes (menos común) ===
                    if step_start_utc < alert.start_time_utc:
                        alert.start_time_utc = step_start_utc
            
                    # === Actualizar intensidad máxima y umbral ===
                    if float(cluster.max_intensity_mm_h) > float(alert.max_intensity_mm_h):
                        alert.max_intensity_mm_h = cluster.max_intensity_mm_h
                        alert.max_threshold_id = cluster.threshold_id

                    alert.save()

                    # === Inactivar pronósticos anteriores que se solapen en la misma hora (Overwriting) ===
                    AlertClusters.objects.filter(
                        alert=alert,
                        is_active_forecast=True,
                    ).update(is_active_forecast=False)

                else:
                    # === Crear nueva Alerta ===
                    new_code = Alert.generate_next_code()
                    alert = Alert.objects.create(
                        natural_phenomena_id=cluster.natural_phenomena_id,
                        code=new_code,
                        max_intensity_mm_h=cluster.max_intensity_mm_h,
                        max_threshold_id=cluster.threshold_id,
                        start_time_utc=step_start_utc,
                        end_time_utc=step_end_utc
                    )
                    edited_alert_ids.add(alert.id)
                    active_alerts.append(alert)

                # === Actualizar los cluster asociados a la alerta (AlertClusters) ===
                alert_cluster = AlertClusters.objects.create(
                    alert=alert,
                    cluster=cluster,
                    representative_point=cluster.representative_point,
                    is_active_forecast=True
                )

                # === Registrar componentes intersecados en esta hora ===
                comp_records = [
                    AlertClustersComponents(
                        alert_cluster=alert_cluster,
                        component=comp,
                        intensity_at_component=cluster.max_intensity_mm_h
                    )
                    for comp in components
                ]
                AlertClustersComponents.objects.bulk_create(comp_records)
                persisted_snapshots_count += 1

            # === Evaluar Reprogramaciones y Cancelaciones ===
            cls._evaluate_reevaluations_and_degradations(active_alerts, edited_alert_ids)

            return persisted_snapshots_count

    @classmethod
    def _find_matching_active_alert(
        cls,
        geometry: GEOSGeometry,
        timestamp_utc: datetime,
        active_alerts: list[Alert]
    ) -> Alert:
        """
        Intersección directa contra los clústeres activos de las alertas.

            @params:
                `geometry (GEOSGeometry):` Geometría del clúster.
                `timestamp_utc (datetime):` Marca de tiempo del clúster.
                `active_alerts (list):` Lista de alertas activas.

            @return:
                `Alert:` Alerta que coincide con el clúster.
        """
        # === Calcular ventana de búsqueda (Inercia) ===
        cutoff_start = timestamp_utc - timedelta(hours=INERTIA_HOURS)

        # === Intersección espacial directa contra los clústeres activos de las alertas ===
            # === Solo se solapa con alertas en estado "Predicho" (no canceladas, no confirmadas) ===
        matching_cluster = AlertClusters.objects.filter(
            alert__in=active_alerts,
            alert__history__alert_status_phase__alert_status__name="Predicho",
            is_active_forecast=True,
            alert__end_time_utc__gte=cutoff_start,
            cluster__geometry__intersects=geometry
        ).select_related('alert').first()

        # === Retornar la alerta coincidente ===
        return matching_cluster.alert if matching_cluster else None

    @classmethod
    def _evaluate_reevaluations_and_degradations(
        cls,
        active_alerts: list[Alert],
        edited_alert_ids: set[int]
    ):
        """
        Ajusta la hora de inicio (RESCHEDULED) o genera Cancelaciones (CANCELLED).

            @params:
                `active_alerts (list):` Lista de alertas activas.
                `edited_alert_ids (set):` Conjunto de IDs de alertas que fueron editadas con la nueva ingesta de datos (clústeres) desde el modelo de pronóstico GFS.
        """
        now = timezone.now()

        for alert in active_alerts:
            if alert.id not in edited_alert_ids and alert.start_time_utc > now:
                # === Verificar si la alerta aún tiene eventos en pasajes futuros (t2..t12) ===
                future_step = AlertClusters.objects.filter(
                    alert=alert,
                    is_active_forecast=True,
                    timestamp_utc__gt=now
                ).order_by('timestamp_utc').first()

                latest_history = AlertHistory.objects.filter(alert=alert).order_by('-created_at').first()

                if future_step:
                    # === Reprogramación de la alerta (Se retrasó la hora de inicio) ===
                    new_start_time = future_step.timestamp_utc
                    
                    if new_start_time != alert.start_time_utc:
                        alert.start_time_utc = new_start_time
                        alert.save()

                        if latest_history:
                            AlertNotification.objects.create(
                                alert_history=latest_history,
                                channel=NotificationChannel.TELEGRAM,
                                notification_type=NotificationType.RESCHEDULED,
                                is_sent=False,
                                notification_reason=f"Reprogramación por desplazamiento hídrico. Nueva hora de inicio: {new_start_time.strftime('%H:%M UTC')}"
                            )
                else:
                    AlertClusters.objects.filter(alert=alert).update(is_active_forecast=False)
                
                    # === Cancelación de la alerta (Se disipó por completo la precipitación) ===
                    if latest_history:
                        AlertNotification.objects.create(
                            alert_history=latest_history,
                            channel=NotificationChannel.TELEGRAM,
                            notification_type=NotificationType.CANCELLED,
                            is_sent=False,
                            notification_reason="Cancelación: La actualización del modelo GFS indica la disipación del fenómeno."
                        )