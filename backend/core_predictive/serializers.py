from rest_framework.utils import representation
from places.serializers import DistrictLightSerializer
from places.models import District
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from core_predictive.models import (
    GFSRequest,
    GFSActiveCell,
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
            'download_time_seconds'
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

class GFSRequestLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    
    prepare_fields = {
        'request_id': DataFormatter.upper_case,
        'status': DataFormatter.upper_case,
        'target_variable': DataFormatter.lower_case,
    }

    class Meta:
        model = GFSRequest
        fields = [
            'id',
            'request_code',
            'status',
            'target_variable'
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        if attrs['date_range_start'] >= attrs['date_range_end']:
            raise ValidationError("La fecha de inicio debe ser menor a la fecha de fin.")
        return attrs

# ==============================================================================
# SERIALIZADORES DE CELULAS ACTIVAS DE GFS
# ==============================================================================
class GFSActiveLightCellSerializer(serializers.ModelSerializer):
    
    geometry = serializers.SerializerMethodField()

    class Meta:
        model = GFSActiveCell
        fields = [
            'id',
            'gfs_request',
            'geometry',
            'max_intensity_mm_h',
            'intensity_series',
            'threshold_names',
        ]
        read_only_fields = ['id']
    
    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_geometry(self, obj):
        if obj.geometry:
            return json.loads(obj.geometry.geojson)
        return None

class GFSActiveCellGeoJSONSerializer(serializers.ModelSerializer):
    """
    Serializador que transforma el modelo PostGIS GFSActiveCell 
    en un objeto Feature GeoJSON estricto (RFC 7946) para Leaflet / Mapbox.
    """
    type = serializers.SerializerMethodField()
    geometry = serializers.SerializerMethodField()
    properties = serializers.SerializerMethodField()

    class Meta:
        model = GFSActiveCell
        fields = ['type', 'id', 'geometry', 'properties']

    @extend_schema_field(OpenApiTypes.STR)
    def get_type(self, obj):
        return "Feature"

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_geometry(self, obj):
        if obj.geometry:
            return json.loads(obj.geometry.geojson)
        return None

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_properties(self, obj):
        return {
            "gfs_request_id": obj.gfs_request_id,
            "max_intensity_mm_h": obj.max_intensity_mm_h,
            "timestamps": obj.timestamps,
            "intensity_series": obj.intensity_series,
            "threshold_names": obj.threshold_names,
        }

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

    def validate(self, attrs):
        min_val = attrs.get('min_value')
        max_val = attrs.get('max_value')

        if min_val is None and max_val is None:
            raise serializers.ValidationError("Debe indicar al menos un valor límite (mínimo o máximo).")

        # === Validación para ambos campos presentes ===
        if min_val is not None and max_val is not None:
            if min_val > max_val: # No se valida directamente porque el mínimo y el máximo umbral tendrán uno de los 2 valores en None
                raise serializers.ValidationError("El valor mínimo no puede ser mayor que el valor máximo.")

        return attrs

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if instance.natural_phenomena:
            representation['natural_phenomena'] = NaturalPhenomenaLightSerializer(instance.natural_phenomena).data
        if instance.variable:
            representation['variable'] = VariableLightSerializer(instance.variable).data
        if instance.district:
            representation['district'] = DistrictLightSerializer(instance.district).data
        if instance.threshold:
            representation['threshold'] = ThresholdLightSerializer(instance.threshold).data
        return representation