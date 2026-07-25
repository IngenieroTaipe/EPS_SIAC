from rest_framework import serializers
from places.models import Department, Province, District, Sector

from core_shared.mixins import PrepareDataMixin
from core_shared.formatters import DataFormatter

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
    department = DepartmentLightSerializer(read_only=True)
    geojson = serializers.SerializerMethodField()

    class Meta:
        model = Province
        fields = ["ubigeo", "department", "name", "geojson"]
        read_only_fields = ["ubigeo"]

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
    province = ProvinceLightSerializer(read_only=True)
    geojson = serializers.SerializerMethodField()

    class Meta:
        model = District
        fields = ["ubigeo", "department", "province", "name", "geojson"]
        read_only_fields = ["ubigeo"]
    
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
    district = DistrictLightSerializer(read_only=True)
    
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