from rest_framework import serializers
from places.models import Department, Province, District, Sector
from core_shared.mixins import PrepareDataMixin
from core_shared.formatters import DataFormatter

from drf_spectacular.utils import extend_schema_field
from drf_spectacular.types import OpenApiTypes

import json

# ==============================================================================
# SERIALIZADORES DE DEPARTAMENTOS
# ==============================================================================
class DepartmentSerializer(PrepareDataMixin, serializers.ModelSerializer):
    """
        Serializador base para el primer nivel territorial (Departamentos).
    """
    prepare_fields = {
        'ubigeo': DataFormatter.zfill(2),
        'name': DataFormatter.upper_case
    }
    ubigeo = serializers.CharField(max_length=2)
    geojson = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = ["ubigeo", "name", "geojson"]

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_geojson(self, obj):
        if obj.geometry:
            return json.loads(obj.geometry.geojson)
        return None

class DepartmentLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    """
        Serializador liviano para listados masivos de Departamentos.
    """
    prepare_fields = {
        'ubigeo': DataFormatter.zfill(2),
        'name': DataFormatter.upper_case
    }

    class Meta:
        model = Department
        fields = ["ubigeo", "name"]
        
# ==============================================================================
# SERIALIZADORES DE PROVINCIAS
# ==============================================================================
class ProvinceSerializer(PrepareDataMixin, serializers.ModelSerializer):
    """
        Serializador liviano para listados masivos de Provincias.
    """
    prepare_fields = {
        'ubigeo': DataFormatter.zfill(4),
        'name': DataFormatter.upper_case
    }
    ubigeo = serializers.CharField(max_length=4)
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(),
        help_text="UBIGEO del Departamento preexistente (2 dígitos, ej: '12')"
    )
    geojson = serializers.SerializerMethodField()

    class Meta:
        model = Province
        fields = ["ubigeo", "department", "name", "geojson"]
        read_only_fields = ["ubigeo"]

    def to_representation(self, instance):
        """
            Transformación de salida: Reemplaza el UBIGEO numérico del departamento 
            por el objeto detallado al responder peticiones HTTP.
        """
        representation = super().to_representation(instance)
        if instance.department:
            representation['department'] = DepartmentLightSerializer(instance.department).data
        return representation

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_geojson(self, obj):
        if obj.geometry:
            return json.loads(obj.geometry.geojson)
        return None

class ProvinceLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    """
        Serializador detallado para vistas unitarias de Provincias.
    """
    prepare_fields = {
        'ubigeo': DataFormatter.zfill(4),
        'name': DataFormatter.upper_case
    }

    class Meta:
        model = Province
        fields = ["ubigeo", "name"]

# ==============================================================================
# SERIALIZADORES DE DISTRITOS
# ==============================================================================
class DistrictSerializer(PrepareDataMixin, serializers.ModelSerializer):
    """
        Serializador liviano para listados masivos de Distritos.
    """
    prepare_fields = {
        'ubigeo': DataFormatter.zfill(6),
        'name': DataFormatter.upper_case
    }
    ubigeo = serializers.CharField(max_length=6)
    department = DepartmentLightSerializer(source="province.department", read_only=True)
    province = serializers.PrimaryKeyRelatedField(
        queryset=Province.objects.all(),
        help_text="UBIGEO de la Provincia preexistente (4 dígitos, ej: '1203')"
    )
    geojson = serializers.SerializerMethodField()

    class Meta:
        model = District
        fields = ["ubigeo", "department", "province", "name", "geojson"]
    
    def to_representation(self, instance):
        """
            Transformación de salida: Reemplaza el UBIGEO numérico de la provincia 
            por el objeto detallado al responder peticiones HTTP.
        """
        representation = super().to_representation(instance)
        if instance.province:
            representation['province'] = ProvinceLightSerializer(instance.province).data
        return representation

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_geojson(self, obj):
        if obj.geometry:
            return json.loads(obj.geometry.geojson)
        return None

class DistrictLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    """
        Serializador detallado para vistas unitarias de Distritos.
    """
    prepare_fields = {
        'ubigeo': DataFormatter.zfill(6),
        'name': DataFormatter.upper_case
    }

    class Meta:
        model = District
        fields = ["ubigeo", "name"]
    
# ==============================================================================
# SERIALIZADORES DE SECTORES
# ==============================================================================
class SectorSerializer(PrepareDataMixin, serializers.ModelSerializer):
    """
    Serializador para sectores operativos dentro de un distrito.
    """
    prepare_fields = {
        'code': DataFormatter.zfill(3),
        'name': DataFormatter.upper_case,
        'observations': DataFormatter.trim_string
    }
    department = DepartmentLightSerializer(source="province.department", read_only=True)
    province = ProvinceLightSerializer(read_only=True)
    district = serializers.PrimaryKeyRelatedField(
        queryset=District.objects.all(),
        help_text="UBIGEO del Distrito preexistente (6 dígitos, ej: '1203')"
    )
    
    class Meta:
        model = Sector
        fields = [
            'code',
            'department',
            'province',
            'district',
            'name',
            'status',
            'observations'
        ]

        read_only_fields = ["id"]

    def to_representation(self, instance):
        """
            Transformación de salida: Reemplaza el UBIGEO numérico del distrito 
            por el objeto detallado al responder peticiones HTTP.
        """
        representation = super().to_representation(instance)
        if instance.district:
            representation['district'] = DistrictLightSerializer(instance.district).data
        return representation

class SectorLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    """
        Serializador para sectores operativos dentro de un distrito.
    """
    prepare_fields = {
        'code' : DataFormatter.zfill(3),
        'name' : DataFormatter.upper_case,
        'observations' : DataFormatter.trim_string
    }

    class Meta:
        model = Sector
        fields = [
            'code',
            'name',
            'status',
            'observations',
        ]
        read_only_fields = ["id"]