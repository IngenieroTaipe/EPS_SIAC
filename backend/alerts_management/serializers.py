from drf_spectacular.utils import extend_schema_field
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
    AlertClusters
)

from places.models import (
    District
)

from core_shared.constants import LIMA_TZ

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

class AlertClusterPointSerializer(serializers.ModelSerializer):
    representative_point = serializers.SerializerMethodField()

    class Meta:
        model = AlertClusters
        fields = [
            'representative_point',
        ]

    def get_representative_point(self, obj):
        if not obj.representative_point:
            return None

        return {
            "type": "Point",
            "coordinates": [
                obj.representative_point.x,
                obj.representative_point.y,
            ]
        }

# ==============================================================================
# SERIALIZADORES SECUNDARIOS
# ==============================================================================
class AlertHistorySecondarySerializer(serializers.ModelSerializer):
    """ Serializador secundario: Muestra el detalle de la bitácora. """
    status_name = serializers.CharField(source='status.name', read_only=True)
    phase_name = serializers.CharField(source='phase.name', read_only=True)

    created_at = serializers.SerializerMethodField()

    class Meta:
        model = AlertHistory
        fields = ['status_name', 'phase_name', 'created_at']

    def get_created_at(self, obj: AlertHistory) -> str:
        return obj.created_at.astimezone(LIMA_TZ).isoformat()

class AlertResultSecondarySerializer(serializers.ModelSerializer):
    created_at = serializers.SerializerMethodField()

    class Meta:
        model = AlertResult
        fields = [
            'has_damage',
            'damage_report',
            'taken_actions',
            'created_at'
        ]

    def get_created_at(self, obj: AlertResult) -> str:
        return obj.created_at.astimezone(LIMA_TZ).isoformat()

# ==============================================================================
# SERIALIZADORES DE LISTA DE ALERTAS
# ==============================================================================
class AlertListSerializer(serializers.ModelSerializer):
    alert_clusters = serializers.SerializerMethodField()
    max_threshold = serializers.StringRelatedField()
    natural_phenomena_name = serializers.SlugRelatedField(
        source='natural_phenomena',
        slug_field='name', # nombre de la tabla natural_phenomena
        read_only=True
    )

    start_time_local = serializers.SerializerMethodField()
    end_time_local = serializers.SerializerMethodField()
    historic_alert = AlertHistorySecondarySerializer(many=True, read_only=True)

    class Meta:
        model = Alert
        fields = [
            'id',
            'code',
            'natural_phenomena_name',
            'max_intensity_mm_h',
            'max_threshold',
            'start_time_local',
            'end_time_local',
            'alert_clusters',
            'historic_alert'
        ]

    def _get_latest_history(self, obj: Alert):
        """
        Patrón Caché de Instancia Unificado para Serializadores (Safe for 1:1 and 1:N).
        """
        if not hasattr(self, '_history_cache'):
            self._history_cache = {}

        if obj.id not in self._history_cache:
            histories = list(obj.historic_alert.all())
            self._history_cache[obj.id] = (
                max(histories, key=lambda h: h.created_at) if histories else None
            )

        return self._history_cache[obj.id]

    def _get_district_map(self) -> dict[str, str]:
        """
            Carga el catálogo de distritos en memoria RAM una sola vez para toda la transacción HTTP.
            Evita consultas N+1 a la tabla de distritos/UBIGEOs.
        """
        if not hasattr(self, '_district_map_cache'):
            self._district_map_cache = dict(
                District.objects.values_list('ubigeo', 'name')
            )
        return self._district_map_cache

    def get_start_time_local(self, obj) -> str | None:
        if obj.start_time_utc:
            return obj.start_time_utc.astimezone(LIMA_TZ).isoformat()
        return None

    def get_end_time_local(self, obj) -> str | None:
        if obj.end_time_utc:
            return obj.end_time_utc.astimezone(LIMA_TZ).isoformat()
        return None

    def get_status(self, obj: Alert) -> str:
        """
        Extrae la Etapa (Estado) actual delegando la resolución al mapa hash en memoria O(1).
        """
        latest_history = self._get_latest_history(obj)
        if latest_history and latest_history.status:
            return latest_history.status.name
        return "Desconocido"

    def get_phase(self, obj: Alert) -> str:
        """
        Extrae la Fase Operativa actual desde el historial más reciente precargado O(1).
        """
        latest_history = self._get_latest_history(obj)
        if latest_history and latest_history.phase:
            return latest_history.phase.name
        return "Sin Fase"

    def get_alert_clusters(self, obj):
        """
            Genera el listado de centroides y UBIGEOs usando los objetos precargados en memoria RAM.
        """
        clusters_data = []

        for ac in obj.alerts_clusters_alerts.all():
            cluster = ac.cluster
            if not cluster:
                continue

            raw_ubigeos = cluster.affected_ubigeos or []
            enriched_ubigeos = self.get_reached_ubigeos(obj, raw_ubigeos)

            point_geom = ac.representative_point

            clusters_data.append({
                "representative_point": {
                    "type": "Point",
                    "coordinates": [round(point_geom.x, 5), round(point_geom.y, 5)]
                } if point_geom else None,
                "affected_ubigeos": enriched_ubigeos
            })

        return clusters_data
    
    def get_reached_ubigeos(self, obj: Alert, affected_ubigeos: list[str]):
        """
            Entrega los UBIGEOs afectados en formato compatible con el Front. 
            Incluye nombres de distritos precargados desde memoria RAM.
        """
        district_map = self._get_district_map()
            
        enriched_ubigeos = [
            {
                "ubigeo": ubigeo,
                "name": district_map.get(ubigeo)
            }
            for ubigeo in affected_ubigeos
        ]

        return enriched_ubigeos

# ==============================================================================
# SERIALIZADOR DE DETALLE DE ALERTAS
# ==============================================================================
class AlertDetailSerializer(serializers.ModelSerializer):
    alert_cluster_components = serializers.SerializerMethodField()
    clusters = serializers.SerializerMethodField()
    max_threshold = serializers.StringRelatedField()

    start_time_local = serializers.SerializerMethodField()
    end_time_local = serializers.SerializerMethodField()
    
    historic_alert = AlertHistorySecondarySerializer(many=True, read_only=True)
    result = AlertResultSecondarySerializer(read_only=True, source='alerts_results_alert')

    natural_phenomena_name = serializers.SlugRelatedField(
        source='natural_phenomena',
        slug_field='name', # nombre de la tabla natural_phenomena
        read_only=True
    )
    
    class Meta:
        model = Alert
        fields = [
            'id',
            'code',
            'natural_phenomena_name',
            'max_intensity_mm_h',
            'max_threshold',
            'start_time_local',
            'end_time_local',
            'alert_cluster_components',
            'clusters',
            'historic_alert',
            'result',
        ]

    def _get_district_map(self) -> dict[str, str]:
        """
            Carga el catálogo de distritos en memoria RAM una sola vez para toda la transacción HTTP.
            Evita consultas N+1 a la tabla de distritos/UBIGEOs.
        """
        if not hasattr(self, '_district_map_cache'):
            self._district_map_cache = dict(
                District.objects.values_list('ubigeo', 'name')
            )
        return self._district_map_cache

    def get_start_time_local(self, obj) -> str | None:
        if obj.start_time_utc:
            return obj.start_time_utc.astimezone(LIMA_TZ).isoformat()
        return None

    def get_end_time_local(self, obj) -> str | None:
        if obj.end_time_utc:
            return obj.end_time_utc.astimezone(LIMA_TZ).isoformat()
        return None
    
    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_alert_cluster_components(self, obj):
        components = []
        seen_components = set()
        
        for ac in obj.alerts_clusters_alerts.all():
            for acc in ac.alerts_clusters_components_clusters.all():
                comp = acc.component
                if comp.id not in seen_components:
                    components.append({
                        'id': comp.id,
                        "component": f"{comp.code} - {comp.name}"
                    })
                    seen_components.add(comp.id)
        return components

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_clusters(self, obj):
        clusters = []
        for ac in obj.alerts_clusters_alerts.all():
            cluster = ac.cluster
            if not cluster:
                continue

            raw_ubigeos = cluster.affected_ubigeos or []
            enriched_districts = self.get_reached_ubigeos(obj, raw_ubigeos)

            clusters.append({
                "max_intensity_mm_h": cluster.max_intensity_mm_h,
                "timestamp_str": cluster.timestamp_utc.astimezone(LIMA_TZ).isoformat(),
                "threshold": cluster.threshold.name if cluster.threshold else None,
                "affected_districts": enriched_districts
            })
        return clusters

    def get_reached_ubigeos(self, obj: Alert, affected_ubigeos: list[str]):
        """
            Entrega los UBIGEOs afectados en formato compatible con el Front. 
            Incluye nombres de distritos precargados desde memoria RAM.
        """
        district_map = self._get_district_map()
            
        enriched_ubigeos = [
            {
                "ubigeo": u_code,
                "name": district_map.get(str(u_code), f"Distrito {u_code}")
            }
                for u_code in affected_ubigeos
            ]

        return enriched_ubigeos

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

    has_damage = serializers.BooleanField(required=False, write_only=True)
    damage_report = serializers.CharField(required=False, allow_blank=True, write_only=True)
    taken_actions = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Alert
        fields = [
            'id', 'code', 
            'status_name', 'phase_name', 
            'has_damage', 'damage_report', 'taken_actions'
        ]
        read_only_fields = ['id', 'code']

    def validate(self, attrs):
        if attrs.get("has_damage") is True and not attrs.get("damage_report"):
            raise serializers.ValidationError({"damage_report": "Debe especificar el reporte si declara que existieron daños."})
        
        if attrs.get("phase_name") == "ATENDIDO" and not attrs.get("taken_actions"):
            raise serializers.ValidationError({"taken_actions": "Debe registrar las acciones tomadas para marcar la alerta como ATENDIDA."})
            
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
        fields = ['alert', 'has_damage', 'damage_report', 'taken_actions']

    def validate(self, attrs):
        alert = self.context['alert']
        latest_history = alert.history.order_by('-created_at').first()

        if not latest_history or latest_history.status.name != "CONFIRMADO":
            raise serializers.ValidationError("Solo se permite la edición directa del reporte en alertas con estado 'CONFIRMADO'.")

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
    status = serializers.PrimaryKeyRelatedField(
        queryset=AlertStatus.objects.all(),
        help_text="ID del estado de la alerta"
    )
    phase = serializers.PrimaryKeyRelatedField(
        queryset=AlertPhase.objects.all(),
        help_text="ID de la fase de la alerta"
    )

    class Meta:
        model = AlertHistory
        fields = [
            'id',
            'alert',
            'status',
            'phase',
        ]
        read_only_fields = ['id']

    def to_representation(self, instance):
        """
            Reemplaza las relaciones con la demás tablas de las FK a la información detallada del objeto para responder las peticiones HTTP
        """
        representation = super().to_representation(instance)
        if instance.alert:
            representation['alert'] = AlertListSerializer(instance.alert).data
        if instance.status:
            representation['status'] = AlertStatusLightSerializer(instance.status).data
        if instance.phase:
            representation['phase'] = AlertPhaseLightSerializer(instance.phase).data
        return representation

class AlertHistoryLightSerializer(serializers.ModelSerializer):
    alert = serializers.PrimaryKeyRelatedField(
        queryset=Alert.objects.all(),
        help_text="ID de la alerta"
    )
    status = serializers.PrimaryKeyRelatedField(
        queryset=AlertStatus.objects.all(),
        help_text="ID del estado de la alerta"
    )
    phase = serializers.PrimaryKeyRelatedField(
        queryset=AlertPhase.objects.all(),
        help_text="ID de la fase de la alerta"
    )

    class Meta:
        model = AlertHistory
        fields = [
            'id',
            'alert',
            'status',
            'phase'
        ]
        read_only_fields = ['id']

    def to_representation(self, instance):
        """
            Reemplaza las relaciones con la demás tablas de las FK a la información detallada del objeto para responder las peticiones HTTP
        """
        representation = super().to_representation(instance)
        if instance.alert:
            representation['alert'] = AlertListSerializer(instance.alert).data
        if instance.status:
            representation['status'] = AlertStatusLightSerializer(instance.status).data
        if instance.phase:
            representation['phase'] = AlertPhaseLightSerializer(instance.phase).data
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
            representation['alert_id'] = AlertListSerializer(instance.alert_id).data
        return representation
