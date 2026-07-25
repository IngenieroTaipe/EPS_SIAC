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
from places.serializers import SectorLightSerializer
from core_shared.mixins import PrepareDataMixin
from core_shared.formatters import DataFormatter

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
        'specification': DataFormatter.trim_string
    }

    sector = SectorLightSerializer()
    type = ComponentTypeLightSerializer()
    operational_status = OperationalStatusLightSerializer()
    physical_status = PhysicalStatusLightSerializer()

    class Meta: 
        model = Component
        fields = [
            'id', 
            'code', 
            'type', 
            'sector', 
            'specification', 
            'operational_status', 
            'physical_status'
        ]
        read_only_fields = ['id', 'code']

class ComponentLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    prepare_fields = {
        'code': DataFormatter.zfill(3),
        'observations': DataFormatter.trim_string
    }
    sector = SectorLightSerializer()
    type = ComponentTypeSerializer()
    operational_status = OperationalStatusSerializer()
    physical_status = PhysicalStatusSerializer()

    class Meta:
        model = Component
        fields = [
            'id',
            'code',
            'sector',
            'type',
            'specification',
            'operational_status',
            'physical_status'
        ]
        read_only_fields = ['id', 'code']

# ==============================================================================
# SERIALIZADORES DE COORDENADAS DE COMPONENTES
# ==============================================================================
class ComponentCoordSerializer(serializers.ModelSerializer):
    """
        Serializador flexible para la ingesta de infraestructura sanitaria.
        Permite el ingreso de coordenadas en WGS84 (Lat/Lon) o UTM (Easting/Northing + SRID).
        Convierte y persiste automáticamente en PostGIS bajo EPSG:4326.
    """
    easting = serializers.FloatField(write_only=True, required=False, help_text="Coordenada Este (UTM)")
    northing = serializers.FloatField(write_only=True, required=False, help_text="Coordenada Norte (UTM)")
    srid_origin = serializers.IntegerField(
        write_only=True, 
        required=False, 
        default=4326, 
        help_text="SRID de Origen (ej: 32718 para UTM Zona 18S, 32717 para Zona 17S, 4326 para WGS84)"
    )

    component = ComponentLightSerializer()
    criticality = CriticalityLightSerializer()
    
    class Meta:
        model = ComponentCoord
        fields = [
            'id',
            'component',
            'criticality',
            'easting',
            'northing',
            'srid_origin',
            'coords',
        ]
        read_only_fields = ['id']

        extra_kwargs = {
            'coords' : {'required': False} # Establecemos el campo de coords para WGS84 como opcional
        }

    def validate(self, attrs):
        easting = attrs.pop('easting', None)
        northing = attrs.pop('northing', None)
        srid_origin = attrs.pop('srid_origin', 4326)
        coords = attrs.get('coords', None)

        if easting is not None and northing is not None:
            attrs['coords'] = SpatialHelper.utm_to_wgs84(easting, northing, srid_origin)

        elif coords is None:
            raise ValidationError(
                "Se deben especificar las coordenadas UTM 32718 (East, North) o las Coordenadas WGS84 (Lat, Lon)."
            )
        
        return attrs

    def get_utm_coordinates(self, obj, target_zone=18):
        """
            Usa el Helper para convertir la geometría WGS84 de PostGIS a UTM Zona 18S para la respuesta HTTP.
        """
        if obj.coords:
            return SpatialHelper.wgs84_to_utm(obj.coords, target_zone=target_zone)
        return None

    def get_geojson(self, obj):
        """
            Convierte la geometría a formato GeoJSON.
        """
        if obj.coords:
            return json.loads(obj.coords.geojson)
        return None