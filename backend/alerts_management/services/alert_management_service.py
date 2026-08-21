# alerts_management/services/alert_reconciliation_service.py

import logging
from datetime import datetime, timedelta
from typing import Tuple, List, Set, Dict, Any, Optional
from django.db import transaction
from django.utils import timezone
from django.contrib.gis.geos import GEOSGeometry

from alerts_management.services.infrastructure_intersection_service import (
    ConsolidatedAlertEvent
)
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
            ).select_related('max_threshold'))
            
            edited_alert_ids: Set[int] = set()
            alerts_processed_count = 0

            for event in impacted_records:
                matched_alert = cls._find_matching_active_alert(
                    geometry=event.unified_geometry,
                    start_time_utc=event.start_time_utc,
                    active_alerts=active_alerts,
                    impacted_component_ids=event.impacted_component_ids
                )
                
                if matched_alert:
                    alert = cls._extend_existing_alert(matched_alert, event)
                    logger.info(f"🔄 Alerta histórica #{alert.code} extendida con nuevo horizonte.")
                else:
                    alert = cls._create_new_alert_with_fsm(natural_phenomena_id, event)
                    logger.info(f"✨ Nueva Alerta #{alert.code} creada para cuenca/infraestructura independiente.")

                edited_alert_ids.add(alert.id)
                alerts_processed_count += 1

                cls._persist_cluster_snapshot_and_components(alert, event)

            # === Evaluar reprogramar o cancelar alertas ===
            cls._evaluate_reevaluations_and_cancellations(active_alerts, edited_alert_ids)

            return alerts_processed_count

    # =========================================================================
    # SUB-MÉTODOS ESPECIALIZADOS
    # =========================================================================
    @classmethod
    def _extend_existing_alert(
        cls, 
        alert: Alert, 
        event: ConsolidatedAlertEvent
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
        updated_fields = []

        # === Extender el rango temporal (Hora Final) del pronóstico ===
        if event.end_time_utc > alert.end_time_utc:
            alert.end_time_utc = event.end_time_utc
            updated_fields.append("end_time_utc")

        # === Actualizar el rango temporal (Hora Inicial) del pronóstico ===
        if event.start_time_utc < alert.start_time_utc:
            alert.start_time_utc = event.start_time_utc
            updated_fields.append("start_time_utc")

        # === Intensidad máxima y Umbral Máximo ===
        if float(event.max_intensity_mm_h) > float(alert.max_intensity_mm_h):
            alert.max_intensity_mm_h = event.max_intensity_mm_h
            alert.max_threshold_id = event.highest_threshold

            updated_fields.append("max_intensity_mm_h")
            updated_fields.append("max_threshold_id")

        if updated_fields:
            alert.save(update_fields=updated_fields)

        return alert

    @classmethod
    def _create_new_alert_with_fsm(
        cls, 
        natural_phenomena_id: int, 
        event: ConsolidatedAlertEvent
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
            max_intensity_mm_h=event.max_intensity_mm_h,
            max_threshold=event.highest_threshold,
            start_time_utc=event.start_time_utc,
            end_time_utc=event.end_time_utc
        )

        target_status = AlertStatus.objects.get(
            name="PREDICHO"
        )

        initial_history = AlertHistory.objects.create(
            alert=alert,
            status=target_status,
            phase=None,
            created_by=None
        )

        notification_obj = AlertNotification.objects.create(
            alert_history=initial_history,
            channel=NotificationChannel.TELEGRAM,
            notification_type=NotificationType.INITIAL,
            is_sent=False,
            notification_reason="Emisión de nueva alerta predicha por detección de hotspot meteorológico."
        )

        cls._dispatch_telegram_task(notification_obj.id)
        return alert

    @staticmethod
    def _persist_cluster_snapshot_and_components(
        alert: Alert, 
        event: ConsolidatedAlertEvent
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
        components_to_create = []
        created_count = 0

        for cluster in event.snapshots:
            alert_cluster, created = AlertClusters.objects.get_or_create(
                alert=alert,
                cluster=cluster,
                defaults= {
                    'representative_point': event.representative_point,
                    'is_active_forecast': True
                }
            )

            if not created and not alert_cluster.is_active_forecast:
                alert_cluster.is_active_forecast = True
                alert_cluster.save(update_fields=['is_active_forecast'])

            created_count += 1

            # Preparar inserción de componentes en lote
            for comp in event.impacted_components:
                components_to_create.append(
                    AlertClustersComponents(
                        alert_cluster=alert_cluster,
                        component=comp,
                        intensity_at_component=event.max_intensity_mm_h
                    )
                )
        
        if components_to_create:
            AlertClustersComponents.objects.bulk_create(
                components_to_create,
            )
        
        return created_count

    # =========================================================================
    # EVALUACIÓN DE CLUSTERS Y NOTIFICACIONES DE ALERTAS
    # =========================================================================

    @classmethod
    def _find_matching_active_alert(
        cls,
        geometry: GEOSGeometry,
        start_time_utc: datetime,
        active_alerts: list[Alert],
        impacted_component_ids: Set[int]
    ) -> Optional[Alert]:
        """
            Busca intersección espacial directa contra los clústeres activos de alertas en estado 'Predicho'.

            Identifica si el evento espacial corresponde a una alerta activa evaluando:
                1. Estado PREDICHO en el historial.
                2. Ventana de inercia temporal.
                3. Intersección espacial topológica O impacto en los mismos componentes de la EPS.

            @params:
                `geometry` (`GEOSGeometry`): Geometría del clúster.
                `start_time_utc` (`datetime`): Marca de tiempo UTC.
                `active_alerts` (`list[Alert]`): Lista de alertas activas.

            @returns:
                `Optional[Alert]`: Alerta coincidente.
        """
        if not active_alerts:
            return None
        
        cutoff_start = start_time_utc - timedelta(hours=INERTIA_HOURS)

        ELIGIBLE_STATUSES = ["PREDICHO", "EN ESPERA DE CONFIRMACIÓN", "CONFIRMADO"]
        
        # === Coincidencia por geometría (intersección) ===
        matching_cluster = AlertClusters.objects.filter(
            alert__in=active_alerts,
            alert__historic_alert__status__name__in=ELIGIBLE_STATUSES,
            is_active_forecast=True,
            alert__end_time_utc__gte=cutoff_start # Similar o menor a la hora de inicio del paso
        ).exclude(
            # Se excluyen alertas cerradas definitivamente
            alert__historic_alert__phase__name="ATENDIDO"
        ).filter(
            # === Intersección geométrica ===
            cluster__geometry__intersects=geometry
        ).select_related('alert').first()
        
        if matching_cluster:
            return matching_cluster.alert
        
        # === Coincidencia por componentes ===
        if impacted_component_ids:
            matching_cluster_components = AlertClustersComponents.objects.filter(
                alert_cluster__alert__in=active_alerts,
                alert_cluster__alert__historic_alert__status__name__in=ELIGIBLE_STATUSES,
                alert_cluster__is_active_forecast=True,
                # === Intersección por componentes ===
                component_id__in=impacted_component_ids
            ).exclude(
                # Se excluyen alertas cerradas definitivamente
                alert_cluster__alert__historic_alert__phase__name="ATENDIDO"
            ).select_related('alert_cluster__alert').first()
            
            if matching_cluster_components:
                return matching_cluster_components.alert_cluster.alert
        
        return None

    @classmethod
    def _evaluate_reevaluations_and_cancellations(
        cls,
        active_alerts: list[Alert],
        edited_alert_ids: Set[int]
    ) -> None:
        """
            Evalúa reprogramaciones (RESCHEDULED) y cancelaciones (CANCELLED) por disipación hídrica.

            La nueva ejecución del NOAA debería mostrar que los componentes que anteriormente eran afectados por una precipitación deban seguir presentes (ya que la nueva ejecución contiene partes de la predicción anterior - dada la ventana de 16h en el futuro), pero si no existen significa que esta precipitación se disipó o cambió su hora de inicio. Este caso es el que es manejado por el presente método.

            Cabe resaltar que en algunos casos no habrán actualizaciones y tampoco se cambiará la hora de fin u inicio de la precipitación. 

            @params:
                `active_alerts` (`list[Alert]`): Lista de alertas activas.
                `edited_alert_ids` (`Set[int]`): Conjunto de IDs de alertas editadas.

            @returns:
                `None`
        """
        now = timezone.now()

        for alert in active_alerts:
            # Alertas que no recibieron nuevos snapshots y cuyo inicio sigue en el futuro
            if alert.id not in edited_alert_ids and alert.start_time_utc > now:
                
                future_step = AlertClusters.objects.filter(
                    alert=alert,
                    is_active_forecast=True,
                    timestamp_utc__gt=now
                ).order_by('timestamp_utc').first()

                latest_history = AlertHistory.objects.filter(alert=alert).order_by('-created_at').first()

                # === En caso de que la alerta aún exista debemos analizar si su inicio horario cambio ===
                if future_step and future_step.cluster:
                    new_start_time = future_step.timestamp_utc
                    
                    # === Ajuste de tiempo ===
                    if new_start_time != alert.start_time_utc:
                        alert.start_time_utc = new_start_time
                        alert.save(update_fields=['start_time_utc'])

                        if latest_history:
                            notification_obj = AlertNotification.objects.create(
                                alert_history=latest_history,
                                channel=NotificationChannel.TELEGRAM,
                                notification_type=NotificationType.RESCHEDULED,
                                is_sent=False,
                                notification_reason=(
                                    f"Reprogramación por desplazamiento del foco de precipitación. "
                                    f"Nueva hora: {new_start_time.strftime('%H:%M UTC')}"
                                )
                            )
                            cls._dispatch_telegram_task(notification_obj.id)
                else:
                    # === Inactivar pronóstico y emitir cancelación por disipación de precipitación ===
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