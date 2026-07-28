from rest_framework import serializers
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