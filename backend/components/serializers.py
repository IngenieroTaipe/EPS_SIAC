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
from django.contrib.gis.geos import Point
from django.db import transaction

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
# SERIALIZADORES DE COORDENADAS DE COMPONENTES
# ==============================================================================
    # ==============================================================================
    # SERIALIZADOR LIGERO PARA LECTURA / REPRESENTACIÓN ESPACIAL
    # ==============================================================================
class ComponentCoordLightSerializer(serializers.ModelSerializer):
    """
        Serializador de salida: Transforma la geometría PostGIS (EPSG:4326) 
        a representaciones UTM Zona 18S y GeoJSON para el cliente WebGIS.
        Este serializer está pensado para funcionar como serializer para los métodos GET (Para los Components - ComponentSerializer).
    """
    utm_coords = serializers.SerializerMethodField()

    class Meta:
        model = ComponentCoord
        fields = ['utm_coords']

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_utm_coords(self, obj) -> dict | None:
        """ Usa el Helper para convertir WGS84 a UTM Zona 18S (Selva Central). """
        if obj.coords:
            return SpatialHelper.wgs84_to_utm(obj.coords)
        return None
    
class ComponentCoordDetailSerializer(serializers.ModelSerializer):
    """
        Serializador de salida: Transforma la geometría PostGIS (EPSG:4326) 
        a representaciones UTM Zona 18S y GeoJSON para el cliente WebGIS.
        Este serializer está pensado para funcionar como serializer para los métodos GET (Para los Components - ComponentSerializer).
    """
    criticality = CriticalityLightSerializer(read_only=True)
    utm_coords = serializers.SerializerMethodField()
    geojson = serializers.SerializerMethodField()

    class Meta:
        model = ComponentCoord
        fields = ['id', 'criticality', 'utm_coords', 'geojson']

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_utm_coords(self, obj) -> dict | None:
        """ Usa el Helper para convertir WGS84 a UTM Zona 18S (Selva Central). """
        if obj.coords:
            return SpatialHelper.wgs84_to_utm(obj.coords)
        return None

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_geojson(self, obj) -> dict | None:
        """ Convierte la geometría PostGIS a formato GeoJSON nativo. """
        if obj.coords:
            return {
                "type": "Point",
                "coordinates": [round(obj.coords.x, 6), round(obj.coords.y, 6)]
            }
        return None
    # ==============================================================================
    # SERIALIZADOR DE INGESTA ANIDADA (ESCRITURA)
    # ==============================================================================
class ComponentCoordItemSerializer(serializers.ModelSerializer):
    """
        Serializador anidado de entrada: Valida e ingesta coordenadas UTM o WGS84.
        Está pensado para funcionar como serializer para los métodos POST y PUT (usado por medio de los Components - ComponentSerializer).
    """
    criticality = serializers.PrimaryKeyRelatedField(
        queryset=Criticality.objects.all(),
        help_text="ID de la criticidad preexistente (ej. 1)"
    )
    easting = serializers.FloatField(write_only=True, required=False, help_text="Este en metros (UTM)")
    northing = serializers.FloatField(write_only=True, required=False, help_text="Norte en metros (UTM)")
    srid_origin = serializers.IntegerField(write_only=True, required=False, default=18, help_text="Zona UTM (Default: 18)")
    latitude = serializers.FloatField(write_only=True, required=False, help_text="Latitud WGS84")
    longitude = serializers.FloatField(write_only=True, required=False, help_text="Longitud WGS84")

    class Meta:
        model = ComponentCoord
        fields = ['criticality', 'easting', 'northing', 'srid_origin', 'latitude', 'longitude']

    def validate(self, attrs):
        """
        Geotransformación en Ingesta: Convierte UTM a WGS84 o instancia Point(lon, lat).
        """
        easting = attrs.pop('easting', None)
        northing = attrs.pop('northing', None)
        srid_origin = attrs.pop('srid_origin', 18)
        latitude = attrs.pop('latitude', None)
        longitude = attrs.pop('longitude', None)

        if easting is not None and northing is not None:
            attrs['coords'] = SpatialHelper.utm_to_wgs84(easting, northing, srid_origin)
        elif latitude is not None and longitude is not None:
            attrs['coords'] = Point(float(longitude), float(latitude), srid=4326)
        else:
            raise serializers.ValidationError(
                "Se deben especificar las coordenadas UTM (easting+northing) o WGS84 (latitude+longitude)."
            )
        return attrs

    # ==============================================================================
    # SERIALIZADOR MAESTRO DE COORDENADA INDIVIDUAL
    # ==============================================================================
class ComponentCoordSerializer(serializers.ModelSerializer):
    """
        Serializador Maestro de Coordenada Individual:
        Soporta operaciones CRUD sobre instancias de ComponentCoord.
        Maneja ingesta en UTM (Zona 18S) / WGS84 y respuesta enriquecida en GeoJSON.

        Este serializer es un todo en uno, pensado para el endpoint directo sobre las coordenadas
    """
    component = serializers.PrimaryKeyRelatedField(
        queryset=Component.objects.all(),
        help_text="ID del componente preexistente (ej. 12)"
    )
    criticality = serializers.PrimaryKeyRelatedField(
        queryset=Criticality.objects.all(),
        help_text="ID de la criticidad preexistente (ej. 1)"
    )
    
    # Campos de Ingesta Proyectada / Geográfica (Write-Only)
    easting = serializers.FloatField(write_only=True, required=False, help_text="Este UTM en metros")
    northing = serializers.FloatField(write_only=True, required=False, help_text="Norte UTM en metros")
    srid_origin = serializers.IntegerField(write_only=True, required=False, default=18, help_text="Zona UTM (17, 18 o 19)")
    latitude = serializers.FloatField(write_only=True, required=False, help_text="Latitud WGS84")
    longitude = serializers.FloatField(write_only=True, required=False, help_text="Longitud WGS84")

    # Campos de Salida Espacial (Read-Only)
    utm_coords = serializers.SerializerMethodField(read_only=True)
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
        read_only_fields = ['id', 'coords']

    def validate(self, attrs):
        """
        Geotransformación en Ingesta: Convierte las entradas UTM/WGS84 
        a la geometría Point (EPSG:4326) para persistencia en PostGIS.
        """
        easting = attrs.pop('easting', None)
        northing = attrs.pop('northing', None)
        srid_origin = attrs.pop('srid_origin')
        latitude = attrs.pop('latitude', None)
        longitude = attrs.pop('longitude', None)

        if easting is not None and northing is not None:
            attrs['coords'] = SpatialHelper.utm_to_wgs84(easting, northing, srid_origin)
        elif latitude is not None and longitude is not None:
            attrs['coords'] = Point(float(longitude), float(latitude), srid=4326)
        elif 'coords' not in attrs:
            raise serializers.ValidationError(
                "Se deben especificar las coordenadas UTM (easting/northing) o WGS84 (latitude/longitude)."
            )
        return attrs

    def to_representation(self, instance):
        """
        Transformación de Salida: Enriquece la respuesta HTTP reemplazando 
        las claves numéricas por los objetos detallados de Componente y Criticidad.
        """
        representation = super().to_representation(instance)
        if instance.component:
            representation['component'] = ComponentLightSerializer(instance.component).data
        if instance.criticality:
            representation['criticality'] = CriticalityLightSerializer(instance.criticality).data
        return representation

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_utm_coords(self, obj) -> dict | None:
        """ Reproyecta la geometría PostGIS a UTM Zona 18S para la respuesta HTTP. """
        if obj.coords:
            return SpatialHelper.wgs84_to_utm(obj.coords)
        return None

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_geojson(self, obj) -> dict | None:
        """ Exporta la geometría PostGIS a formato GeoJSON estándar. """
        if obj.coords:
            return {
                "type": "Point",
                "coordinates": [round(obj.coords.x, 6), round(obj.coords.y, 6)]
            }
        return None

# ==============================================================================
# SERIALIZADORES DE COMPONENTES
# ==============================================================================
class ComponentListSerializer(PrepareDataMixin, serializers.ModelSerializer):
    type = serializers.StringRelatedField()
    district = serializers.StringRelatedField()
    coords = ComponentCoordLightSerializer(many=True, read_only=True, source='coords_relation')
    operational_status = OperationalStatusLightSerializer(read_only=True)
    physical_status = PhysicalStatusLightSerializer(read_only=True)

    class Meta: 
        model = Component
        fields = [
            'id',
            'code', 
            'name',
            'type', 
            'district', 
            'coords',
            'specification',
            'operational_status',
            'physical_status'
        ]

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
    operational_status = serializers.SlugRelatedField(
        queryset=OperationalStatus.objects.all(),
        slug_field='code',
        help_text="Codigo del estado operativo preexistente (ej: '001')",
        required=False,
        allow_null=True
    )
    physical_status = serializers.SlugRelatedField(
        queryset=PhysicalStatus.objects.all(),
        slug_field='code',
        help_text="Codigo del estado fisico preexistente (ej: 'A')",
        required=False,
        allow_null=True
    )

    coords = ComponentCoordItemSerializer(
        many=True,
        write_only=True,
        required=False,
        source='coords_relation'
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
            'physical_status',
            'coords'
        ]
        read_only_fields = ['id']
    
    @transaction.atomic
    def create(self, validated_data):
        # DRF coloca el listado de coords bajo el campo `source`
        # ('coords_relation'), no bajo el nombre declarado ('coords').
        coords_data = validated_data.pop('coords_relation', [])

        # === Creación de la entidad principal Component ===
        component = Component.objects.create(**validated_data)

        # === Inserción en lote de coordenadas ===
        coords_instances = [
            ComponentCoord(
                component=component,
                criticality=coord_item['criticality'],
                coords=coord_item['coords']
            )
            for coord_item in coords_data
        ]

        if coords_instances:
            ComponentCoord.objects.bulk_create(coords_instances)

        return component

    @transaction.atomic
    def update(self, instance, validated_data):
        """
            Actualiza el componente y reemplaza completamente el conjunto
            de coordenadas asociadas (`coords_relation`). El frontend envia
            la lista completa de puntos finales bajo `coords[]`; cualquier
            coordenada previa que no este en esa lista se elimina.
        """
        # DRF coloca el listado de coords bajo el campo `source`
        # ('coords_relation'), no bajo el nombre declarado ('coords').
        coords_data = validated_data.pop('coords_relation', None)

        # Actualizar campos escalares del componente
        for attr in ('code', 'name', 'specification', 'district',
                     'type', 'operational_status', 'physical_status'):
            if attr in validated_data:
                setattr(instance, attr, validated_data[attr])
        instance.save()

        # Reemplazo completo de coords solo si el cliente envio `coords[]`.
        # En PATCH sin `coords`, se preservan las coordenadas existentes.
        if coords_data is not None:
            instance.coords_relation.all().delete()
            coords_instances = [
                ComponentCoord(
                    component=instance,
                    criticality=item['criticality'],
                    coords=item['coords']
                )
                for item in coords_data
            ]
            if coords_instances:
                ComponentCoord.objects.bulk_create(coords_instances)

        return instance

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
        
        representation['coords'] = ComponentCoordDetailSerializer(
            instance.coords_relation.select_related('criticality').all(),
            many=True
        ).data

        return representation

class ComponentLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    prepare_fields = {
        'code': DataFormatter.zfill(3),
        'name' : DataFormatter.upper_case,
        'specification': DataFormatter.trim_string
    }
    district = serializers.PrimaryKeyRelatedField(
        queryset=District.objects.all(),
        help_text="ID (Ubigeo) del distrito preexistente (ej: '120606')"
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
            'district',
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