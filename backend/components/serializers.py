from rest_framework import serializers
from components.models import Criticalities, ComponentTypes, OperationalStatuses, PhysicalStatuses, Components, ComponentsCoords
from places.serializers import SectorSerializer
from core_shared.mixins import PrepareDataMixin
from core_shared.formatters import DataFormatter

import json

# ==============================================================================
# SERIALIZADORES DE CRITICIDADES
# ==============================================================================

class CriticalityListSerializer(PrepareDataMixin, serializers.ListSerializer):
    """
        Serializador para listar las criticidades de los componentes.
    """
    prepare_fields = {
        'name': DataFormatter.upper_case,
        'description': DataFormatter.trim_string
    }

    class Meta:
        model = Criticalities
        fields = ['name', 'description']

class CriticalitySerializer(PrepareDataMixin, serializers.ModelSerializer):
    """
        Serializador para listar las criticidades de los componentes.
    """
    prepare_fields = {
        'name': DataFormatter.upper_case,
        'description': DataFormatter.trim_string
    }

    class Meta:
        model = Criticalities
        fields = ['name', 'description', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
           
# ==============================================================================
# SERIALIZADORES DE TIPOS DE COMPONENTES
# ==============================================================================
class ComponentTypeListSerializer(PrepareDataMixin, serializers.ListSerializer):
    prepare_fields = {
        'name': DataFormatter.upper_case,
        'description': DataFormatter.trim_string
    }
    class Meta:
        model = ComponentTypes
        fields = ['name', 'description']

class ComponentTypeSerializer(PrepareDataMixin, serializers.ModelSerializer):
    prepare_fields = {
        'name': DataFormatter.upper_case,
        'description': DataFormatter.trim_string
    }
    class Meta:
        model = ComponentTypes
        fields = ['name', 'description', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
# ==============================================================================
# SERIALIZADORES DE ESTADO OPERATIVO
# ==============================================================================
class OperationalStatusListSerializer(PrepareDataMixin, serializers.ListSerializer):
    prepare_fields = {
        'name': DataFormatter.upper_case,
        'description': DataFormatter.trim_string
    }
    class Meta:
        model = OperationalStatuses
        fields = ['code', 'name', 'description']
    
class OperationalStatusSerializer(PrepareDataMixin, serializers.ModelSerializer):
    prepare_fields = {
        'name': DataFormatter.upper_case,
        'description': DataFormatter.trim_string
    }
    class Meta:
        model = OperationalStatuses
        fields = ['code', 'name', 'description', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

# ==============================================================================
# SERIALIZADORES DE ESTADO FISICO
# ==============================================================================
class PhysicalStatusListSerializer(PrepareDataMixin, serializers.ListSerializer):
    prepare_fields = {
        'name': DataFormatter.upper_case,
        'description': DataFormatter.trim_string
    }
    class Meta:
        model = PhysicalStatuses
        fields = ['code', 'name', 'description']

class PhysicalStatusSerializer(PrepareDataMixin, serializers.ListSerializer):
    prepare_fields = {
        'name': DataFormatter.upper_case,
        'description': DataFormatter.trim_string
    }
    class Meta:
        model = PhysicalStatuses
        fields = ['code', 'name', 'description', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


# ==============================================================================
# SERIALIZADORES DE COMPONENTES
# ==============================================================================
class ComponentListSerializer(PrepareDataMixin, serializers.ListSerializer):
    prepare_fields = {
        'code': DataFormatter.zfill(4),
        'specification': DataFormatter.trim_string
    }

    sector_name = serializers.CharField(source="sector.name", read_only=True)
    type_name = serializers.CharField(source="type.name", read_only=True)
    criticality_name = serializers.CharField(source="criticality.name", read_only=True)
    operational_status_name = serializers.CharField(source="operational_status.name", read_only=True)
    physical_status_name = serializers.CharField(source="physical_status.name", read_only=True)

    class Meta:
        model = Components
        fields = ['sector', 'sector_name', 'type', 'type_name', 'name', 'specification', 'criticality', 'criticality_name', 'operational_status', 'operational_status_name', 'physical_status', 'physical_status_name']

class ComponentSerializer(PrepareDataMixin, serializers.ModelSerializer):
    prepare_fields = {
        'code': DataFormatter.zfill(3),
        'observations': DataFormatter.trim_string
    }

    sector = SectorSerializer()
    type = ComponentTypeSerializer()
    criticality = CriticalitySerializer()
    operational_status = OperationalStatusSerializer()
    physical_status = PhysicalStatusSerializer()

    class Meta:
        model = Components
        fields = [
            'id',
            'code',
            'sector',
            'type',
            'name',
            'specification',
            'criticality',
            'operational_status',
            'physical_status',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

class ComponentCoordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComponentsCoords
        fields = '__all__'