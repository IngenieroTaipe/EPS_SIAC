from django.db import models
from core_shared.models import AuditCreateModel, AuditCompleteModel

# Create your models here.

class AlertsStatuses(AuditCompleteModel):
    '''
        Modelo para representar los estados de las alertas.
    '''
    # Django crea internamente el campo 'id' de forma transparente
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'alerts_statuses'
        verbose_name = 'Estado de la Alerta'
        verbose_name_plural = 'Estados de las Alertas'

    def __str__(self):
        return self.name

class AlertsPhases(AuditCompleteModel):
    '''
        Modelo para representar las fases de las alertas.
    '''
    # Django crea internamente el campo 'id' de forma transparente
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'alerts_phases'
        verbose_name = 'Fase de la Alerta'
        verbose_name_plural = 'Fases de las Alertas'

    def __str__(self):
        return self.name
    
class AlertsStatusesPhases(AuditCompleteModel):
    '''
        Modelo para representar la relación entre los estados y fases de las alertas.
    '''
    # Django crea internamente el campo 'id' de forma transparente
    alert_status = models.ForeignKey(
        'AlertsStatuses', 
        on_delete=models.CASCADE,
        related_name='alert_statuses_phases_status'
    )
    alert_phase = models.ForeignKey(
        'AlertsPhases', 
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

class Alerts(AuditCreateModel):
    '''
        Modelo para representar las alertas.
    '''
    # Django crea internamente el campo 'id' de forma transparente
    natural_phenomena = models.ForeignKey(
        'core_predictive.NaturalPhenomenas',
        on_delete=models.PROTECT,
        related_name='alerts_natural_phenomena'
    )
    branch = models.ForeignKey(
        'organization.Branch',
        on_delete=models.PROTECT,
        related_name='alerts_branches'
    )
    code = models.CharField(max_length=9, unique=True)

    class Meta:
        db_table = 'alerts'
        verbose_name = 'Alerta'
        verbose_name_plural = 'Alertas'

    def __str__(self):
        return self.code

class AlertsHistoric(AuditCreateModel):
    '''
        Modelo para representar el histórico de alertas.
    '''
    # Django crea internamente el campo 'id' de forma transparente
    alert = models.ForeignKey(
        'Alerts', 
        on_delete=models.PROTECT,
        related_name='alerts_historic_alert'
    )
    alert_status_phase = models.ForeignKey(
        'AlertsStatusesPhases', 
        on_delete=models.PROTECT,
        related_name='alerts_historic_status_phase'
    )
    emcwf_request = models.ForeignKey(
        'core_predictive.EMCWFRequests', # Referenciamos a otro módulo (core_predictive)
        on_delete=models.PROTECT,
        related_name='alerts_historic_emcwf_request'
    )
    natural_phenomena_value = models.FloatField()
    date_predicted_start = models.DateTimeField()

    class Meta:
        db_table = 'alerts_historic'
        verbose_name = 'Histórico de Alertas'
        verbose_name_plural = 'Históricos de Alertas'

    def __str__(self):
        return f"{self.alert.code} - {self.alert_status_phase.alert_status.name}"

class AlertNotifications(AuditCreateModel):
    '''
        Modelo para representar las notificaciones de alertas.
    '''
    # Django crea internamente el campo 'id' de forma transparente
    alert_historic = models.ForeignKey(
        'AlertsHistoric', 
        on_delete=models.PROTECT,
        related_name='alerts_notifications_alerts_historic'
    )

    class Meta:
        db_table = 'alert_notifications'
        verbose_name = 'Notificación de Alerta'
        verbose_name_plural = 'Notificaciones de Alertas'

    def __str__(self):
        return f"{self.alert_notification_id} - {self.alert_historic.alert.code}"

class AlertsResult(AuditCompleteModel):
    '''
        Modelo para representar los resultados de las alertas.
    '''
    alert_id = models.OneToOneField(
        'Alerts',
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
        return f"{self.alert_id.code} - {'Damage' if self.has_damage else 'No Damage'}"