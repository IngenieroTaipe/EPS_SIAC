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
    geojson = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = ["ubigeo", "name", "geojson", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def get_geojson(self, obj):
        if obj.geometry:
            return json.loads(obj.geometry.geojson)
        return None
        
# ==============================================================================
# SERIALIZADORES DE PROVINCIAS
# ==============================================================================
class ProvinceListSerializer(PrepareDataMixin, serializers.ModelSerializer):
    """
        Serializador liviano para listados masivos de Provincias.
    """
    prepare_fields = {
        'ubigeo': DataFormatter.zfill(4),
        'name': DataFormatter.upper_case
    }
    department_name = serializers.CharField(source="department.name", read_only=True)
    geojson = serializers.SerializerMethodField()

    class Meta:
        model = Province
        fields = ["ubigeo", "department", "department_name", "name", "geojson"]
        read_only_fields = ["ubigeo"]

    def get_geojson(self, obj):
        if obj.geometry:
            return json.loads(obj.geometry.geojson)
        return None

class ProvinceSerializer(PrepareDataMixin, serializers.ModelSerializer):
    """
        Serializador detallado para vistas unitarias de Provincias.
    """
    prepare_fields = {
        'ubigeo': DataFormatter.zfill(4),
        'name': DataFormatter.upper_case
    }
    department = DepartmentSerializer(read_only=True)
    geojson = serializers.SerializerMethodField()

    class Meta:
        model = Province
        fields = ["ubigeo", "department", "name", "geojson", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]
    
    def get_geojson(self, obj):
        if obj.geometry:
            return json.loads(obj.geometry.geojson)
        return None

# ==============================================================================
# SERIALIZADORES DE DISTRITOS
# ==============================================================================
class DistrictListSerializer(PrepareDataMixin, serializers.ModelSerializer):
    """
        Serializador liviano para listados masivos de Distritos.
    """
    prepare_fields = {
        'ubigeo': DataFormatter.zfill(6),
        'name': DataFormatter.upper_case
    }
    province_name = serializers.CharField(source="province.name", read_only=True)
    department_ubigeo = serializers.CharField(source="province.department.ubigeo", read_only=True)
    geojson = serializers.SerializerMethodField()

    class Meta:
        model = District
        fields = ["ubigeo", "province", "province_name", "department_ubigeo",  "name", "geojson"]
        read_only_fields = ["ubigeo"]
    
    def get_geojson(self, obj):
        if obj.geometry:
            return json.loads(obj.geometry.geojson)
        return None

class DistrictSerializer(PrepareDataMixin, serializers.ModelSerializer):
    """
        Serializador detallado para vistas unitarias de Distritos.
    """
    province = ProvinceSerializer(read_only=True)
    geojson = serializers.SerializerMethodField()

    class Meta:
        model = District
        fields = ["ubigeo", "province", "name", "geojson", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]
    
    def get_geojson(self, obj):
        if obj.geometry:
            return json.loads(obj.geometry.geojson)
        return None

# ==============================================================================
# SERIALIZADORES DE SECTORES
# ==============================================================================
class SectorListSerializer(PrepareDataMixin, serializers.ModelSerializer):
    """
    Serializador para sectores operativos dentro de un distrito.
    """
    prepare_fields = {
        'code': DataFormatter.zfill(3),
        'name': DataFormatter.upper_case,
        'observations': DataFormatter.trim_string
    }
    district_name = serializers.CharField(source="district.name", read_only=True)
    
    class Meta:
        model = Sector
        fields = [
            'code',
            'district',
            'district_name',
            'name',
            'status',
            'observations'
        ]

        read_only_fields = ["id"]

class SectorSerializer(PrepareDataMixin, serializers.ModelSerializer):
    """
        Serializador para sectores operativos dentro de un distrito.
    """
    prepare_fields = {
        'code' : DataFormatter.zfill(3),
        'name' : DataFormatter.upper_case,
        'observations' : DataFormatter.trim_string
    }

    district_name = serializers.CharField(source="district.name", read_only=True)

    class Meta:
        model = Sector
        fields = [
            'code',
            'district',
            'district_name',
            'name',
            'status',
            'observations',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ["id", "created_at", "updated_at"]