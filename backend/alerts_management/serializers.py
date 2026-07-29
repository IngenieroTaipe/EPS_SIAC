from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta

from core_shared.mixins import PrepareDataMixin
from core_shared.formatters import DataFormatter

from alerts_management.models import (
    AlertStatus,
    AlertPhase,
    AlertStatusPhase,
    Alert,
    AlertHistory,
    AlertNotification,
    AlertResult,
)

from core_predictive.models import (
    NaturalPhenomena, 
    GFSRequest
)

from core_predictive.serializers import (
    NaturalPhenomenaLightSerializer, 
    GFSRequestSerializer
)

# ==============================================================================
# SERIALIZADORES DE ESTADOS
# ==============================================================================
class AlertStatusSerializer(PrepareDataMixin, serializers.ModelSerializer):
    """
        Serializador para listar los estados de las alertas.
    """
    prepare_fields = {
        'name': DataFormatter.upper_case,
        'description': DataFormatter.trim_string
    }

    class Meta:
        model = AlertStatus
        fields = ['id','name', 'description']
        read_only_fields = ['id']

class AlertStatusLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    """
        Serializador para listar los estados de las alertas.
    """
    prepare_fields = {
        'name': DataFormatter.upper_case,
    }

    class Meta:
        model = AlertStatus
        fields = ['id','name']
        read_only_fields = ['id']


# ==============================================================================
# SERIALIZADORES DE FASES
# ==============================================================================
class AlertPhaseSerializer(PrepareDataMixin, serializers.ModelSerializer):
    """
        Serializador para listar las fases de las alertas.
    """
    prepare_fields = {
        'name': DataFormatter.upper_case,
        'description': DataFormatter.trim_string
    }
    class Meta:
        model = AlertPhase
        fields = ['id', 'name', 'description']
        read_only_fields = ['id']

class AlertPhaseLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    """
        Serializador para listar las fases de las alertas.
    """
    prepare_fields = {
        'name': DataFormatter.upper_case,
    }

    class Meta:
        model = AlertPhase
        fields = ['id','name']
        read_only_fields = ['id']

# ==============================================================================
# SERIALIZADORES DE ESTADOS
# ==============================================================================
class AlertStatusPhaseSerializer(serializers.ModelSerializer):
    
    alert_status = serializers.PrimaryKeyRelatedField(
        queryset=AlertStatus.objects.all(),
        help_text="ID del estado de la alerta"
    )
    alert_phase = serializers.PrimaryKeyRelatedField(
        queryset=AlertPhase.objects.all(),
        help_text="ID de la fase de la alerta"
    )
    
    class Meta:
        model = AlertStatusPhase
        fields = ['id', 'alert_status', 'alert_phase']
        read_only_fields = ['id']

    def to_representation(self, instance):
        """
            Reemplaza las relaciones con la demás tablas de las FK a la información detallada del objeto para responder las peticiones HTTP
        """
        representation = super().to_representation(instance)
        if instance.alert_status:
            representation['alert_status'] = AlertStatusLightSerializer(instance.alert_status).data
        if instance.alert_phase:
            representation['alert_phase'] = AlertPhaseLightSerializer(instance.alert_phase).data
        return representation

class AlertStatusPhaseLightSerializer(serializers.ModelSerializer):
    """
        Serializador para listar las fases de las alertas.
    """
    alert_status = serializers.PrimaryKeyRelatedField(
        queryset=AlertStatus.objects.all(),
        help_text="ID del estado de la alerta"
    )
    alert_phase = serializers.PrimaryKeyRelatedField(
        queryset=AlertPhase.objects.all(),
        help_text="ID de la fase de la alerta"
    )

    class Meta:
        model = AlertStatusPhase
        fields = ['id', 'alert_status', 'alert_phase']
        read_only_fields = ['id']


# ==============================================================================
# SERIALIZADORES DE ALERTAS
# ==============================================================================
class AlertSerializer(serializers.ModelSerializer):

    natural_phenomena = serializers.PrimaryKeyRelatedField(
        queryset=NaturalPhenomena.objects.all(),
        help_text="ID del fenómeno natural"
    )

    class Meta:
        model = Alert
        fields = [
            'id',
            'natural_phenomena',
            'code'
        ]
        read_only_fields = ['id']

# ==============================================================================
# SERIALIZADOR DE TRANSICIÓN DE ESTADOS DE LA ALERTA
# ==============================================================================
class AlertTransitionSerializer(serializers.ModelSerializer):
    """
    Serializador para la actualización de estado, fase y resultados sobre una Alerta existente.
    """
    status_name = serializers.ChoiceField(
        choices=["Confirmado", "No Confirmado"],
        required=False,
        write_only=True
    )
    phase_name = serializers.ChoiceField(
        choices=["En Espera de Reporte", "En Proceso de Atención", "Atendido"],
        required=False,
        write_only=True
    )
    
    # === CAMPOS DE DOMINIO PARA ALERTRESULT / ALERT ===
    real_start_time = serializers.DateTimeField(required=False, allow_null=True, write_only=True)
    has_damage = serializers.BooleanField(required=False, write_only=True)
    damage_report = serializers.CharField(required=False, allow_blank=True, write_only=True)
    taken_actions = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Alert
        fields = [
            'id', 'code', 'start_time_utc', 'end_time_utc',
            'status_name', 'phase_name', 'real_start_time', 
            'has_damage', 'damage_report', 'taken_actions'
        ]
        read_only_fields = ['id', 'code', 'start_time_utc', 'end_time_utc']

    def validate(self, attrs):
        if attrs.get("has_damage") is True and not attrs.get("damage_report"):
            raise serializers.ValidationError({"damage_report": "Debe especificar el reporte si declara que existieron daños."})
        
        if attrs.get("phase_name") == "Atendido" and not attrs.get("taken_actions"):
            raise serializers.ValidationError({"taken_actions": "Debe registrar las acciones tomadas para marcar la alerta como Atendida."})
            
        return attrs

# ==============================================================================
# SERIALIZADOR DE ACTUALIZACIÓN DE RESULTADOS DE LA ALERTA
# ==============================================================================
class AlertResultUpdateSerializer(serializers.ModelSerializer):
    """
    Serializador de entrada para actualizar exclusivamente los campos de AlertResult 
    dentro de la ventana de gracia de 2 días (Caso 6).
    """

    alert = serializers.PrimaryKeyRelatedField(
        queryset=Alert.objects.all(),
        help_text="ID de la alerta"
    )

    class Meta:
        model = AlertResult
        fields = ['has_damage', 'damage_report', 'taken_actions']

    def validate(self, attrs):
        alert = self.context['alert']
        latest_history = alert.history.order_by('-created_at').first()

        if not latest_history or latest_history.alert_status_phase.alert_phase.name != "Atendido":
            raise serializers.ValidationError("Solo se permite la edición directa del reporte en alertas con fase 'Atendido'.")

        # RESTRICCIÓN DE 2 DÍAS DE GRACIA
        time_since_attended = timezone.now() - latest_history.created_at
        if time_since_attended > timedelta(days=2):
            raise serializers.ValidationError("Se superó el plazo máximo de 2 días para modificar las acciones o reportes de esta alerta.")

        return attrs

# ==============================================================================
# SERIALIZADORES DE HISTÓRICO DE ALERTAS
# ==============================================================================
class AlertHistorySerializer(serializers.ModelSerializer):
    alert = serializers.PrimaryKeyRelatedField(
        queryset=Alert.objects.all(),
        help_text="ID de la alerta"
    )
    alert_status_phase = serializers.PrimaryKeyRelatedField(
        queryset=AlertStatusPhase.objects.all(),
        help_text="ID del estado y fase de la alerta"
    )

    class Meta:
        model = AlertHistory
        fields = [
            'id',
            'alert',
            'alert_status_phase',
        ]
        read_only_fields = ['id']

    def to_representation(self, instance):
        """
            Reemplaza las relaciones con la demás tablas de las FK a la información detallada del objeto para responder las peticiones HTTP
        """
        representation = super().to_representation(instance)
        if instance.alert:
            representation['alert'] = AlertSerializer(instance.alert).data
        if instance.alert_status_phase:
            representation['alert_status_phase'] = AlertStatusPhaseSerializer(instance.alert_status_phase).data
        return representation

class AlertHistoryLightSerializer(serializers.ModelSerializer):
    alert = serializers.PrimaryKeyRelatedField(
        queryset=Alert.objects.all(),
        help_text="ID de la alerta"
    )
    alert_status_phase = serializers.PrimaryKeyRelatedField(
        queryset=AlertStatusPhase.objects.all(),
        help_text="ID del estado y fase de la alerta"
    )
    class Meta:
        model = AlertHistory
        fields = [
            'id',
            'alert',
            'alert_status_phase',
            'natural_phenomena_value',
            'date_predicted_start'
        ]
        read_only_fields = ['id']

    def to_representation(self, instance):
        """
            Reemplaza las relaciones con la demás tablas de las FK a la información detallada del objeto para responder las peticiones HTTP
        """
        representation = super().to_representation(instance)
        if instance.alert:
            representation['alert'] = AlertSerializer(instance.alert).data
        if instance.alert_status_phase:
            representation['alert_status_phase'] = AlertStatusPhaseSerializer(instance.alert_status_phase).data
        return representation


# ==============================================================================
# SERIALIZADORES DE NOTIFICACIÓN DE ALERTAS
# ==============================================================================
class AlertNotificationSerializer(serializers.ModelSerializer):
    alert_history = serializers.PrimaryKeyRelatedField(
        queryset=AlertHistory.objects.all(),
        help_text="ID del histórico de la alerta"
    )
    
    class Meta:
        model = AlertNotification
        fields = [
            'id',
            'alert_history',
        ]
        read_only_fields = ['id']

    def to_representation(self, instance):
        """
            Reemplaza las relaciones con la demás tablas de las FK a la información detallada del objeto para responder las peticiones HTTP
        """
        representation = super().to_representation(instance)
        if instance.alert_history:
            representation['alert_history'] = AlertHistorySerializer(instance.alert_history).data
        return representation

class AlertNotificationLightSerializer(serializers.ModelSerializer):
    alert_history = serializers.PrimaryKeyRelatedField(
        queryset=AlertHistory.objects.all(),
        help_text="ID del histórico de la alerta"
    )
    
    class Meta:
        model = AlertNotification
        fields = [
            'id',
            'alert_history'
        ]
        read_only_fields = ['id']

# ==============================================================================
# SERIALIZADORES DE RESULTADOS DE ALERTAS
# ==============================================================================
class AlertResultSerializer(serializers.ModelSerializer):
    alert = serializers.PrimaryKeyRelatedField(
        queryset=Alert.objects.all(),
        help_text="ID de la alerta"
    )
    class Meta:
        model = AlertResult
        fields = [
            'alert',
            'has_damage',
            'damage_report',
            'taken_actions',
        ]
        read_only_fields = ['alert']

    def to_representation(self, instance):
        """
            Reemplaza las relaciones con la demás tablas de las FK a la información detallada del objeto para responder las peticiones HTTP
        """
        representation = super().to_representation(instance)
        if instance.alert_id:
            representation['alert_id'] = AlertSerializer(instance.alert_id).data
        return representation