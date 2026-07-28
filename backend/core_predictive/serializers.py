from rest_framework.utils import representation
from places.serializers import DistrictLightSerializer
from places.models import District
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from core_predictive.models import (
    GFSRequest,
    NaturalPhenomena,
    VariableType,
    UnitsMeasurement,
    Variable,
    NaturalPhenomenasVariables,
    ThresholdsNaturalPhenomena,
    Threshold,
)
from core_shared.mixins import PrepareDataMixin
from core_shared.formatters import DataFormatter

from drf_spectacular.utils import extend_schema_field
from drf_spectacular.types import OpenApiTypes
import json
import os
from django.conf import settings


# ==============================================================================
# SERIALIZADORES DE PREDICCIÓN
# ==============================================================================
class GFSRequestSerializer(PrepareDataMixin, serializers.ModelSerializer):
    
    prepare_fields = {
        'request_id': DataFormatter.upper_case,
        'status': DataFormatter.upper_case,
        'target_variable': DataFormatter.lower_case,
    }

    geojson_url = serializers.SerializerMethodField()
    geom_bounds = serializers.SerializerMethodField()

    class Meta:
        model = GFSRequest
        fields = [
            'id',
            'request_code',
            'status',
            'target_variable',
            'date_range_start',
            'date_range_end',
            'geom_bounds',
            'file_name',
            'file_path',
            'file_size_mb',
            'download_time_seconds',
            'geojson_path',
            'geojson_url'
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        if attrs['date_range_start'] >= attrs['date_range_end']:
            raise ValidationError("La fecha de inicio debe ser menor a la fecha de fin.")
        return attrs

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_geom_bounds(self, obj):
        """
            Convierte la geometría a formato GeoJSON.
        """
        if obj.geom_bounds:
            return json.loads(obj.geom_bounds.geojson)
        return None

    @extend_schema_field(OpenApiTypes.STR)
    def get_geojson_url(self, obj):
        """
        Mapea la ruta física del archivo local a la URL de almacenamiento estático MEDIA.
        """
        if not obj.geojson_path or not os.path.exists(obj.geojson_path):
            return None
        
        request = self.context.get('request')
        relative_path = os.path.relpath(obj.geojson_path, settings.MEDIA_ROOT)
        media_url = f"{settings.MEDIA_URL}{relative_path}".replace("\\", "/")

        if request is not None:
            return request.build_absolute_uri(media_url)
        return media_url

class GFSRequestLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    
    prepare_fields = {
        'request_id': DataFormatter.upper_case,
        'status': DataFormatter.upper_case,
        'target_variable': DataFormatter.lower_case,
    }

    geojson_url = serializers.SerializerMethodField()

    class Meta:
        model = GFSRequest
        fields = [
            'id',
            'request_code',
            'status',
            'target_variable',
            'geojson_path',
            'geojson_url'
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        if attrs['date_range_start'] >= attrs['date_range_end']:
            raise ValidationError("La fecha de inicio debe ser menor a la fecha de fin.")
        return attrs
    
    @extend_schema_field(OpenApiTypes.STR)
    def get_geojson_url(self, obj):
        """
        Mapea la ruta física del archivo local a la URL de almacenamiento estático MEDIA.
        """
        if not obj.geojson_path or not os.path.exists(obj.geojson_path):
            return None
        
        request = self.context.get('request')
        relative_path = os.path.relpath(obj.geojson_path, settings.MEDIA_ROOT)
        media_url = f"{settings.MEDIA_URL}{relative_path}".replace("\\", "/")

        if request is not None:
            return request.build_absolute_uri(media_url)
        return media_url

# ==============================================================================
# SERIALIZADORES DE FENOMENOS NATURALES
# ==============================================================================
class NaturalPhenomenaSerializer(PrepareDataMixin, serializers.ModelSerializer):
    
    prepare_fields = {
        'name': DataFormatter.upper_case,
        'description': DataFormatter.trim_string,
    }

    class Meta:
        model = NaturalPhenomena
        fields = [
            'id',
            'name',
            'description',
        ]
        read_only_fields = ['id']

class NaturalPhenomenaLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    
    prepare_fields = {
        'name': DataFormatter.upper_case,
    }

    class Meta:
        model = NaturalPhenomena
        fields = [
            'id',
            'name',
        ]
        read_only_fields = ['id']

# ==============================================================================
# SERIALIZADORES DE TIPOS DE VARIABLES
# ==============================================================================
class VariableTypeSerializer(PrepareDataMixin, serializers.ModelSerializer):
    
    prepare_fields = {
        'name': DataFormatter.upper_case,
        'description': DataFormatter.trim_string,
    }

    class Meta:
        model = VariableType
        fields = [
            'id',
            'name',
            'description',
        ]
        read_only_fields = ['id']

class VariableTypeLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    
    prepare_fields = {
        'name': DataFormatter.upper_case,
    }

    class Meta:
        model = VariableType
        fields = [
            'id',
            'name',
        ]
        read_only_fields = ['id']

# ==============================================================================
# SERIALIZADORES DE UNIDADES DE MEDIDA DE VARIABLES
# ==============================================================================
class UnitsMeasurementSerializer(PrepareDataMixin, serializers.ModelSerializer):
    
    prepare_fields = {
        'name': DataFormatter.upper_case,
        'description': DataFormatter.trim_string,
    }

    class Meta:
        model = UnitsMeasurement
        fields = [
            'id',
            'name',
            'description',
        ]
        read_only_fields = ['id']

class UnitsMeasurementLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    
    prepare_fields = {
        'name': DataFormatter.upper_case,
    }

    class Meta:
        model = UnitsMeasurement
        fields = [
            'id',
            'name',
        ]
        read_only_fields = ['id']

# ==============================================================================
# SERIALIZADORES DE VARIABLES
# ==============================================================================
class VariableSerializer(PrepareDataMixin, serializers.ModelSerializer):
    
    prepare_fields = {
        'name': DataFormatter.upper_case,
        'description': DataFormatter.trim_string,
    }

    variable_type = serializers.PrimaryKeyRelatedField(
        queryset=VariableType.objects.all(),
        required=True
    )

    units_measurement = serializers.PrimaryKeyRelatedField(
        queryset=UnitsMeasurement.objects.all(),
        required=True
    )

    class Meta:
        model = Variable
        fields = [
            'id',
            'name',
            'description',
            'variable_type',
            'units_measurement'
        ]
        read_only_fields = ['id']

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if instance.variable_type:
            representation['variable_type'] = VariableTypeLightSerializer(instance.variable_type).data
        if instance.units_measurement:
            representation['units_measurement'] = UnitsMeasurementLightSerializer(instance.units_measurement).data
        return representation

class VariableLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    
    prepare_fields = {
        'name': DataFormatter.upper_case,
    }

    class Meta:
        model = Variable
        fields = [
            'id',
            'name',
        ]
        read_only_fields = ['id']

# ==============================================================================
# SERIALIZADORES DE VARIABLES DE FENÓMENOS NATURALES
# ==============================================================================
class NaturalPhenomenasVariablesSerializer(PrepareDataMixin, serializers.ModelSerializer):
    
    prepare_fields = {
        'variable': DataFormatter.upper_case,
        'natural_phenomena': DataFormatter.upper_case,
    }

    variable = serializers.PrimaryKeyRelatedField(
        queryset=Variable.objects.all(),
        required=True
    )

    natural_phenomena = serializers.PrimaryKeyRelatedField(
        queryset=NaturalPhenomena.objects.all(),
        required=True
    )

    class Meta:
        model = NaturalPhenomenasVariables
        fields = [
            'variable',
            'natural_phenomena'
        ]

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if instance.variable:
            representation['variable'] = VariableLightSerializer(instance.variable).data
        if instance.natural_phenomena:
            representation['natural_phenomena'] = NaturalPhenomenaLightSerializer(instance.natural_phenomena).data
        return representation

class NaturalPhenomenasVariablesLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    
    prepare_fields = {
        'variable': DataFormatter.upper_case,
        'natural_phenomenon': DataFormatter.upper_case,
    }

    variable = serializers.PrimaryKeyRelatedField(
        queryset=Variable.objects.all(),
        required=True
    )

    natural_phenomena = serializers.PrimaryKeyRelatedField(
        queryset=NaturalPhenomena.objects.all(),
        required=True
    )

    class Meta:
        model = NaturalPhenomenasVariables
        fields = [
            'variable',
            'natural_phenomena'
        ]

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if instance.variable:
            representation['variable'] = VariableLightSerializer(instance.variable).data
        if instance.natural_phenomena:
            representation['natural_phenomena'] = NaturalPhenomenaLightSerializer(instance.natural_phenomenon).data
        return representation


# ==============================================================================
# SERIALIZADORES DE UMBRALES
# ==============================================================================
class ThresholdSerializer(PrepareDataMixin, serializers.ModelSerializer):

    prepare_fields = {
        'name': DataFormatter.upper_case,
        'description': DataFormatter.trim_string,
    }

    class Meta:
        model = Threshold
        fields = [
            'id',
            'name',
            'description',
        ]
        read_only_fields = ['id']

class ThresholdLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    
    prepare_fields = {
        'name': DataFormatter.upper_case,
    }

    class Meta:
        model = Threshold
        fields = [
            'id',
            'name',
        ]
        read_only_fields = ['id']

# ==============================================================================
# SERIALIZADORES DE UMBRALES DE FENÓMENOS NATURALES
# ==============================================================================
class ThresholdNaturalPhenomenaSerializer(PrepareDataMixin, serializers.ModelSerializer):

    natural_phenomena = serializers.PrimaryKeyRelatedField(
        queryset=NaturalPhenomena.objects.all(),
        required=True
    )

    variable = serializers.PrimaryKeyRelatedField(
        queryset=Variable.objects.all(),
        required=True
    )

    district = serializers.PrimaryKeyRelatedField(
        queryset=District.objects.all(),
        required=True
    )

    threshold = serializers.PrimaryKeyRelatedField(
        queryset=Threshold.objects.all(),
        required=True
    )

    class Meta:
        model = ThresholdsNaturalPhenomena
        fields = [
            'id',
            'natural_phenomena',
            'variable',
            'district',
            'threshold',
            'min_value',
            'max_value'
        ]
        read_only_fields = ['id']

    def validate(self, obj):
        if obj['min_value'] > obj['max_value']:
            raise serializers.ValidationError("El valor mínimo debe ser menor al valor máximo.")

        if obj.get('min_value') is None and obj.get('max_value') is None:
            raise serializers.ValidationError("Debe indicar un valor mínimo o máximo.")
        return obj

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if instance.natural_phenomenon:
            representation['natural_phenomenon'] = NaturalPhenomenaLightSerializer(instance.natural_phenomenon).data
        if instance.variable:
            representation['variable'] = VariableLightSerializer(instance.variable).data
        if instance.district:
            representation['district'] = DistrictLightSerializer(instance.district).data
        if instance.threshold:
            representation['threshold'] = ThresholdLightSerializer(instance.threshold).data
        return representation