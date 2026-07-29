from django.contrib.gis.db import models
from core_shared.models import AuditCreateModel, AuditCompleteModel

from core_shared.validators import alpha_name_validator
from alerts_management.validators import code_alert_validator
# Create your models here.

class AlertStatus(AuditCompleteModel):
    '''
        Modelo para representar los estados de las alertas.
    '''
    # Django crea internamente el campo 'id' de forma automática
    name = models.CharField(max_length=100, unique=True, validators=[alpha_name_validator])
    description = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'alerts_statuses'
        verbose_name = 'Estado de la Alerta'
        verbose_name_plural = 'Estados de las Alertas'

    def __str__(self):
        return self.name

class AlertPhase(AuditCompleteModel):
    '''
        Modelo para representar las fases de las alertas.
    '''
    # Django crea internamente el campo 'id' de forma automática
    name = models.CharField(max_length=100, unique=True, validators=[alpha_name_validator])
    description = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'alerts_phases'
        verbose_name = 'Fase de la Alerta'
        verbose_name_plural = 'Fases de las Alertas'

    def __str__(self):
        return self.name
    
class AlertStatusPhase(AuditCompleteModel):
    '''
        Modelo para representar la relación entre los estados y fases de las alertas.
    '''
    # Django crea internamente el campo 'id' de forma automática
    alert_status = models.ForeignKey(
        'AlertStatus', 
        on_delete=models.CASCADE,
        related_name='alert_statuses_phases_status'
    )
    alert_phase = models.ForeignKey(
        'AlertPhase', 
        on_delete=models.CASCADE,
        related_name='alert_statuses_phases_phase'
    )

    class Meta:
        db_table = 'alerts_statuses_phases'
        verbose_name = 'Estado y Fase de la Alerta'
        verbose_name_plural = 'Estados y Fases de las Alertas'
        unique_together = ('alert_status', 'alert_phase')

    def __str__(self):
        return f"{self.alert_status.name} - {self.alert_phase.name}"

class Alert(AuditCreateModel):
    '''
        Modelo para representar las alertas.
    '''
    # Django crea internamente el campo 'id' de forma automática
    natural_phenomena = models.ForeignKey(
        'core_predictive.NaturalPhenomena',
        on_delete=models.PROTECT,
        related_name='alerts_natural_phenomena'
    )
    code = models.CharField(max_length=9, unique=True, validators=[code_alert_validator])
    peak_intensity_mm_h = models.DecimalField(max_digits=6, decimal_places=2)
    max_threshold = models.ForeignKey(
        'core_predictive.ThresholdsNaturalPhenomena',
        on_delete=models.PROTECT,
        related_name='alerts_max_threshold'
    )
    start_time_utc = models.DateTimeField()
    end_time_utc = models.DateTimeField()

    class Meta:
        db_table = 'alerts'
        verbose_name = 'Alerta'
        verbose_name_plural = 'Alertas'

    def __str__(self):
        return self.code

class AlertClusters(AuditCompleteModel):
    '''
        Modelo para representar los clusters de las alertas.
    '''
    # Django crea internamente el campo 'id' de forma automática
    alert = models.ForeignKey(
        'Alert',
        on_delete=models.PROTECT,
        related_name='alerts_clusters_alerts'
    )

    cluster = models.ForeignKey(
        'core_predictive.GFSClusterSnapshot',
        on_delete=models.PROTECT,
        related_name='alerts_clusters_clusters_snapshots'
    )

    class Meta:
        db_table = 'alerts_clusters'
        verbose_name = 'Cluster de Alerta'
        verbose_name_plural = 'Clusters de Alertas'
        unique_together = ('alert', 'cluster')
        # indices optimizan las consultas
        indexes = [
            models.Index(fields=['alert', 'cluster']),
        ]

    def __str__(self):
        return f"{self.alert.code} - {self.cluster.cluster_id}"

class AlertClustersComponents(AuditCompleteModel):
    '''
        Modelo para representar los componentes de los clusters de las alertas.
    '''
    alert_cluster = models.ForeignKey(
        'AlertClusters',
        on_delete=models.PROTECT,
        related_name='alerts_clusters_components_clusters'
    )
    component = models.ForeignKey(
        'components.Component',
        on_delete=models.PROTECT,
        related_name='alerts_clusters_components_components'
    )

    class Meta:
        db_table = 'alerts_clusters_components'
        verbose_name = 'Componente de Cluster de Alerta'
        verbose_name_plural = 'Componentes de Clusters de Alertas'
        unique_together = ('alert_cluster', 'component')
        indexes = [
            models.Index(fields=['alert_cluster', 'component']),
        ]

    def __str__(self):
        return f"Componente: {self.component.name} - del Cluster: {self.alert_cluster.alert.code}"

class AlertHistory(AuditCreateModel):
    '''
        Modelo para representar el histórico de alertas.
    '''
    # Django crea internamente el campo 'id' de forma transparente
    alert = models.ForeignKey(
        'Alert', 
        on_delete=models.PROTECT,
        related_name='alerts_historic_alert'
    )
    alert_status_phase = models.ForeignKey(
        'AlertStatusPhase', 
        on_delete=models.PROTECT,
        related_name='alerts_historic_status_phase'
    )

    class Meta:
        db_table = 'alerts_historic'
        verbose_name = 'Histórico de Alertas'
        verbose_name_plural = 'Históricos de Alertas'

    def __str__(self):
        return f"{self.alert.code} - {self.alert_status_phase.alert_status.name}"

class AlertNotification(AuditCreateModel):
    '''
        Modelo para representar las notificaciones de alertas.
    '''
    # Django crea internamente el campo 'id' de forma transparente
    alert_history = models.ForeignKey(
        'AlertHistory', 
        on_delete=models.PROTECT,
        related_name='alerts_notifications_alerts_history'
    )

    class Meta:
        db_table = 'alert_notifications'
        verbose_name = 'Notificación de Alerta'
        verbose_name_plural = 'Notificaciones de Alerta'

    def __str__(self):
        return f"{self.alert_notification_id} - {self.alert_history.alert.code}"

class AlertResult(AuditCompleteModel):
    '''
        Modelo para representar los resultados de las alertas.
    '''
    alert = models.OneToOneField(
        'Alert',
        on_delete=models.PROTECT,
        primary_key=True,
        related_name='alerts_results_alert'
    )
    has_damage = models.BooleanField(default=False)
    damage_report = models.TextField(blank=True, null=True)
    taken_actions = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'alerts_result'
        verbose_name = 'Resultado de Alerta'
        verbose_name_plural = 'Resultados de Alertas'

    def __str__(self):
        return f"{self.alert.code} - {'Damage' if self.has_damage else 'No Damage'}"