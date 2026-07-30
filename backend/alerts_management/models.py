from django.conf import settings
from django.contrib.gis.db import models
from django.db import connection
from core_shared.models import AuditCreateModel, AuditCompleteModel

from core_shared.validators import alpha_name_validator
from alerts_management.validators import code_alert_validator

class AlertStatus(AuditCompleteModel):
    '''
        Modelo para representar los estados de las alertas.
    '''
    # Django crea internamente el campo 'id' de forma automática
    name = models.CharField(max_length=100, unique=True, validators=[alpha_name_validator])
    description = models.TextField(blank=True, null=True)


    phases = models.ManyToManyField(
        'AlertPhase',
        through='AlertStatusPhase',
        related_name='statuses'
    )

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
    alert_status = models.ForeignKey(
        'AlertStatus', 
        on_delete=models.CASCADE,
        related_name='alert_status_phases'
    )
    alert_phase = models.ForeignKey(
        'AlertPhase', 
        on_delete=models.CASCADE,
        related_name='alert_phase_statuses'
    )

    class Meta:
        db_table = 'alerts_statuses_phases'
        verbose_name = 'Estado y Fase de la Alerta'
        verbose_name_plural = 'Estados y Fases de las Alertas'

        constraints = [
            models.UniqueConstraint(
                fields=['alert_status', 'alert_phase'],
                name='unique_alert_status_phase'
            )
        ]

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
    code = models.CharField(
        max_length=9, 
        unique=True, 
        validators=[code_alert_validator], 
        verbose_name="Código Único de Alerta (000000001)"
    )
    
    max_intensity_mm_h = models.DecimalField(max_digits=6, decimal_places=2, default=0.0)
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
    
    @classmethod
    def generate_next_code(cls) -> str:
        """
            Generador Atómico de Códigos Secuenciales en PostgreSQL.
        """
        with connection.cursor() as cursor:
            cursor.execute("CREATE SEQUENCE IF NOT EXISTS alert_code_seq START 1;")
            cursor.execute("SELECT nextval('alert_code_seq');")
            next_val = cursor.fetchone()[0]

        # Formatea el entero a 9 dígitos rellenados con ceros a la izquierda
        return f"{next_val:09d}"

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

    representative_point = models.PointField(
        srid=4326, 
        null=True, 
        blank=True, 
        verbose_name="Punto Representativo de Impacto"
    )

    is_active_forecast = models.BooleanField(default=True)

    class Meta:
        db_table = 'alerts_clusters'
        verbose_name = 'Cluster de Alerta'
        verbose_name_plural = 'Clusters de Alertas'
        unique_together = ('alert', 'cluster')
        # indices optimizan las consultas
        indexes = [
            models.Index(fields=['alert', 'cluster', 'is_active_forecast']),
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

    intensity_at_component = models.FloatField(default=0.0, verbose_name="Intensidad estimada en la infraestructura (mm/h)")

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
        related_name='historic_alert'
    )
    status = models.ForeignKey(
        'AlertStatus', 
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='historic_status'
    )

    phase = models.ForeignKey(
        'AlertPhase', 
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='historic_phase'
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,  
        on_delete=models.PROTECT,
        related_name='historic_created_by',
        null=True,                 
        blank=True
    )

    class Meta:
        db_table = 'alerts_historic'
        verbose_name = 'Histórico de Alertas'
        verbose_name_plural = 'Históricos de Alertas'
        indexes = [
            models.Index(fields=['alert', 'created_at']),
        ]

    def __str__(self):
        user_str = self.created_by.get_full_name() if self.created_by else "SISTEMA (AUTOMÁTICO)"
        return f"{self.alert.code} - {self.alert_status_phase.alert_status.name} [{user_str}]"

class NotificationChannel(models.TextChoices):
    TELEGRAM = 'TELEGRAM', 'Telegram'
    WHATSAPP = 'WHATSAPP', 'WhatsApp'
    EMAIL = 'EMAIL', 'Correo Electrónico'


class NotificationType(models.TextChoices):
    INITIAL = 'INITIAL', 'Alerta Inicial'
    RESCHEDULED = 'RESCHEDULED', 'Reprogramación Horaria'
    CANCELLED = 'CANCELLED', 'Cancelación / Rectificación'
    EXPIRED = 'EXPIRED', 'Cierre Nominal'

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

    channel = models.CharField(
        max_length=20, 
        choices=NotificationChannel.choices, 
        default=NotificationChannel.TELEGRAM
    )
    
    notification_type = models.CharField(
        max_length=20, 
        choices=NotificationType.choices,
        default=NotificationType.INITIAL
    )
    is_sent = models.BooleanField(default=False, verbose_name="¿Fue despachado con éxito?")
    sent_at = models.DateTimeField(null=True, blank=True, verbose_name="Fecha/Hora de Envío Real")
    
    notification_reason = models.TextField(null=True, blank=True, verbose_name="Motivo de Cancelación o Reajuste")

    class Meta:
        db_table = 'alert_notifications'
        verbose_name = 'Notificación de Alerta'
        verbose_name_plural = 'Notificaciones de Alerta'
        indexes = [
            models.Index(fields=['alert_history', 'is_sent', 'notification_type']),
        ]

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