from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from components.models import (
    Criticality,
    ComponentType,
    OperationalStatus,
    PhysicalStatus,
    Component,
    ComponentCoord
)
from places.serializers import DistrictLightSerializer
from places.models import District
from core_shared.mixins import PrepareDataMixin
from core_shared.formatters import DataFormatter

from drf_spectacular.utils import extend_schema_field
from drf_spectacular.types import OpenApiTypes

from core_shared.helpers import SpatialHelper
import json

# ==============================================================================
# SERIALIZADORES DE CRITICIDADES
# ==============================================================================

class CriticalitySerializer(PrepareDataMixin, serializers.ModelSerializer):
    """
        Serializador para listar las criticidades de los componentes.
    """
    prepare_fields = {
        'name': DataFormatter.upper_case,
        'description': DataFormatter.trim_string
    }

    class Meta:
        model = Criticality
        fields = ['id','name', 'description']
        read_only_fields = ['id']
           
class CriticalityLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    """
        Serializador para listar las criticidades de los componentes.
    """
    prepare_fields = {
        'name': DataFormatter.upper_case,
    }

    class Meta:
        model = Criticality
        fields = ['id', 'name']
        read_only_fields = ['id']
           
# ==============================================================================
# SERIALIZADORES DE TIPOS DE COMPONENTES
# ==============================================================================
class ComponentTypeSerializer(PrepareDataMixin, serializers.ModelSerializer):
    prepare_fields = {
        'name': DataFormatter.upper_case,
        'description': DataFormatter.trim_string
    }
    class Meta:
        model = ComponentType
        fields = ['id','name', 'description']
        read_only_fields = ['id']

class ComponentTypeLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    prepare_fields = {
        'name': DataFormatter.upper_case,
    }
    class Meta:
        model = ComponentType
        fields = ['id', 'name']
        read_only_fields = ['id']

# ==============================================================================
# SERIALIZADORES DE ESTADO OPERATIVO
# ==============================================================================
class OperationalStatusSerializer(PrepareDataMixin, serializers.ModelSerializer):
    prepare_fields = {
        'name': DataFormatter.upper_case,
        'description': DataFormatter.trim_string
    }
    class Meta:
        model = OperationalStatus
        fields = ['code', 'name', 'description']
        read_only_fields = ['code']

class OperationalStatusLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    prepare_fields = {
        'name': DataFormatter.upper_case,
    }
    class Meta:
        model = OperationalStatus
        fields = ['code', 'name']
        read_only_fields = ['code']

# ==============================================================================
# SERIALIZADORES DE ESTADO FISICO
# ==============================================================================
class PhysicalStatusSerializer(PrepareDataMixin, serializers.ModelSerializer):
    prepare_fields = {
        'name': DataFormatter.upper_case,
        'description': DataFormatter.trim_string
    }
    class Meta:
        model = PhysicalStatus
        fields = ['code', 'name', 'description']
        read_only_fields = ['code']

class PhysicalStatusLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    prepare_fields = {
        'name': DataFormatter.upper_case,
    }
    class Meta:
        model = PhysicalStatus
        fields = ['code', 'name']
        read_only_fields = ['code']

# ==============================================================================
# SERIALIZADORES DE COMPONENTES
# ==============================================================================
class ComponentSerializer(PrepareDataMixin, serializers.ModelSerializer):
    prepare_fields = {
        'code': DataFormatter.zfill(4),
        'name': DataFormatter.upper_case,
        'specification': DataFormatter.trim_string
    }

    district = serializers.PrimaryKeyRelatedField(
        queryset=District.objects.all(),
        help_text="Ubigeo del distrito preexistente (ej: '120301')"
    )
    type = serializers.PrimaryKeyRelatedField(
        queryset=ComponentType.objects.all(),
        help_text="ID del tipo de componente preexistente (ej: '1')"
    )
    operational_status = serializers.PrimaryKeyRelatedField(
        queryset=OperationalStatus.objects.all(),
        help_text="ID del estado operativo preexistente (ej: '1')",
        required=False,
        allow_null=True
    )
    physical_status = serializers.PrimaryKeyRelatedField(
        queryset=PhysicalStatus.objects.all(),
        help_text="ID del estado físico preexistente (ej: '1')",
        required=False,
        allow_null=True
    )

    class Meta: 
        model = Component
        fields = [
            'id', 
            'code', 
            'name',
            'type', 
            'district', 
            'specification', 
            'operational_status', 
            'physical_status'
        ]
        read_only_fields = ['id']
    
    def to_representation(self, instance):
        """
            Reemplaza las relaciones con la demás tablas de las FK a la información detallada del objeto para responder las peticiones HTTP
        """
        representation = super().to_representation(instance)
        if instance.district:
            representation['district'] = DistrictLightSerializer(instance.district).data

        if instance.type:
            representation['type'] = ComponentTypeLightSerializer(instance.type).data
        
        if instance.operational_status:
            representation['operational_status'] = OperationalStatusLightSerializer(instance.operational_status).data
        
        if instance.physical_status:
            representation['physical_status'] = PhysicalStatusLightSerializer(instance.physical_status).data
        
        return representation

class ComponentLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    prepare_fields = {
        'code': DataFormatter.zfill(3),
        'name' : DataFormatter.upper_case,
        'specification': DataFormatter.trim_string
    }
    district = serializers.PrimaryKeyRelatedField(
        queryset=District.objects.all(),
        help_text="ID del distrito preexistente (ej: '1')"
    )
    type = serializers.PrimaryKeyRelatedField(
        queryset=ComponentType.objects.all(),
        help_text="ID del tipo de componente preexistente (ej: '1')"
    )

    class Meta:
        model = Component
        fields = [
            'id',
            'code',
            'sector',
            'type',
            'name',
            'specification'
        ]
        read_only_fields = ['id', 'code']
    
    def to_representation(self, instance):
        """
            Transformación de salida: Reemplaza el UBIGEO numérico del departamento 
            por el objeto detallado al responder peticiones HTTP.
        """
        representation = super().to_representation(instance)
        if instance.district:
            representation['district'] = DistrictLightSerializer(instance.district).data

        if instance.type:
            representation['type'] = ComponentTypeLightSerializer(instance.type).data
        
        return representation
        

# ==============================================================================
# SERIALIZADORES DE COORDENADAS DE COMPONENTES
# ==============================================================================
class ComponentCoordSerializer(serializers.ModelSerializer):
    """
        Serializador flexible para la ingesta de infraestructura sanitaria.
        Permite el ingreso de coordenadas en WGS84 (Lat/Lon) o UTM (Easting/Northing + SRID).
        Convierte y persiste automáticamente en PostGIS bajo EPSG:4326.
    """

    component = serializers.PrimaryKeyRelatedField(
        queryset=Component.objects.all(),
        help_text="ID del componente preexistente (ej: '12')"
    )
    criticality = serializers.PrimaryKeyRelatedField(
        queryset=Criticality.objects.all(),
        help_text="ID de la criticidad preexistente (ej: '12')"
    )
    
    easting = serializers.FloatField(write_only=True, required=False, help_text="Coordenada Este en metros (UTM)")
    northing = serializers.FloatField(write_only=True, required=False, help_text="Coordenada Norte en metros (UTM)")
    srid_origin = serializers.IntegerField(
        write_only=True, 
        required=False, 
        default=32718, 
        help_text="SRID de Origen (ej: 32718 para UTM Zona 18S, 32717 para UTM Zona 17S, 32719 para UTM Zona 19S)"
    )

    latitude = serializers.FloatField(write_only=True, required=False, help_text="Latitud WGS84 (-90 a 90)")
    longitude = serializers.FloatField(write_only=True, required=False, help_text="Longitud WGS84 (-180 a 180)")

    utm_coords = serializers.CharField(
        write_only=True, 
        required=False, 
        help_text="Coordenadas en formato UTM (Easting, Northing, SRID)"
    )
    
    geojson = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = ComponentCoord
        fields = [
            'id',
            'component',
            'criticality',
            'easting',
            'northing',
            'srid_origin',
            'latitude',
            'longitude',
            'coords',    
            'utm_coords',
            'geojson',
        ]
        read_only_fields = ['id']

        extra_kwargs = {
            'coords' : {'required': False} # Establecemos el campo de coords para WGS84 como opcional
        }
    def to_representation(self, instance):
        """
            Transformación de salida: Reemplaza el UBIGEO numérico del departamento 
            por el objeto detallado al responder peticiones HTTP.
        """
        representation = super().to_representation(instance)
        if instance.component:
            representation['component'] = ComponentLightSerializer(instance.component).data
        
        if instance.criticality:
            representation['criticality'] = CriticalityLightSerializer(instance.criticality).data
        
        return representation


    def validate(self, attrs):
        easting = attrs.pop('easting', None)
        northing = attrs.pop('northing', None)
        srid_origin = attrs.pop('srid_origin', 32718)
        coords = attrs.get('coords', None)

        if easting is not None and northing is not None:
            attrs['coords'] = SpatialHelper.utm_to_wgs84(easting, northing, srid_origin)

        elif coords is None:
            raise ValidationError(
                "Se deben especificar las coordenadas UTM (ej: 32718 para UTM Zona 18S, 32717 para UTM Zona 17S, 32719 para UTM Zona 19S) o las Coordenadas WGS84 (Lat, Lon)."
            )
        
        return attrs

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_utm_coords(self, obj):
        """
            Usa el Helper para convertir la geometría WGS84 de PostGIS a UTM Zona 18S para la respuesta HTTP.
        """
        if obj.coords:
            return SpatialHelper.wgs84_to_utm(obj.coords, target_zone=None)
        return None

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_geojson(self, obj):
        """
            Convierte la geometría a formato GeoJSON.
        """
        if obj.coords:
            return json.loads(obj.coords.geojson)
        return None