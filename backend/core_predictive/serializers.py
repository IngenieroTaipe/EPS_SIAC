from rest_framework.utils import representation
from places.serializers import DistrictLightSerializer
from places.models import District
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from core_predictive.models import (
    GFSRequest,
    GFSActiveCell,
    GFSClusterSnapshot,
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

class GFSClusterSnapshotGeoJSONSerializer(serializers.ModelSerializer):
    """
    Serializador GeoJSON para Clústeres Espacio-Temporales (Etapa 2).
    Prepara la carga útil para el renderizado vectorial en Leaflet.
    """
    type = serializers.SerializerMethodField()
    geometry = serializers.SerializerMethodField()
    properties = serializers.SerializerMethodField()

    class Meta:
        model = GFSClusterSnapshot
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
            "time_step": obj.time_step,
            "timestamp_utc": obj.timestamp_utc,
            "cluster_index": obj.cluster_index,
            "total_cells": obj.total_cells,
            "max_intensity_mm_h": obj.max_intensity_mm_h,
            "avg_intensity_mm_h": obj.avg_intensity_mm_h,
            "threshold_name": obj.threshold_name,
            "threshold_id": obj.threshold_id,
            "affected_ubigeos": obj.affected_ubigeos
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

    unit_measurement = serializers.PrimaryKeyRelatedField(
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
            'unit_measurement'
        ]
        read_only_fields = ['id']

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if instance.variable_type:
            representation['variable_type'] = VariableTypeLightSerializer(instance.variable_type).data
        if instance.unit_measurement:
            representation['unit_measurement'] = UnitsMeasurementLightSerializer(instance.unit_measurement).data
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
            if min_val > max_val:
                raise serializers.ValidationError("El valor mínimo no puede ser mayor que el valor máximo.")

        # === Validación de escalera (continuidad estricta) ===
        # El contexto `force=True` (enviado por el @action bulk/) indica
        # que el caller reescribe todo el ladder atómicamente y la
        # validación del grupo completo ya se hizo en el viewset, así
        # que aquí sólo validamos la coherencia individual del row.
        if not self.context.get('force'):
            instance_id = self.instance.id if self.instance else None
            np = attrs.get('natural_phenomena') or (self.instance.natural_phenomena if self.instance else None)
            var = attrs.get('variable') or (self.instance.variable if self.instance else None)
            dist = attrs.get('district') or (self.instance.district if self.instance else None)
            if np is not None and var is not None and dist is not None:
                siblings = list(
                    ThresholdsNaturalPhenomena.objects.filter(
                        natural_phenomena=np,
                        variable=var,
                        district=dist,
                    ).exclude(id=instance_id)
                )
                # Proyectar el row candidato sobre los hermanos y validar
                # la escalera resultante como un todo.
                candidate = _RowProxy(
                    threshold=attrs.get('threshold') or (self.instance.threshold if self.instance else None),
                    min_value=min_val if min_val is not None else (self.instance.min_value if self.instance else None),
                    max_value=max_val if max_val is not None else (self.instance.max_value if self.instance else None),
                )
                errores = _validar_escalera(siblings, candidate)
                if errores:
                    raise serializers.ValidationError(errores)

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


# ==============================================================================
# HELPERS DE VALIDACIÓN DE ESCALERA
# ==============================================================================
# Una "escalera" es el conjunto de umbrales (ThresholdsNaturalPhenomena) que
# comparten (district, natural_phenomena, variable). Debe cumplir:
#
#   1. Orden implícito por min_value asc (NULL tratado como -inf).
#   2. max_value de cada nivel == min_value del siguiente (continuidad estricta,
#      sin solapes ni huecos).
#   3. El nivel superior (último) lleva max_value = NULL (sin techo).
#   4. El nivel inferior (primero) lleva min_value >= 0 (piso libre del distrito).
#
# `_RowProxy` permite inyectar el row candidato (en edición/creación) dentro
# del grupo de hermanos sin persistirlo, para validar el estado resultante
# antes de escribir.

class _RowProxy:
    """Proxy ligero para simular un ThresholdsNaturalPhenomena en validación."""

    def __init__(self, threshold, min_value, max_value):
        self.id = -1  # sentinel para filtrar vía .exclude(id=...)
        self.threshold = threshold
        self.min_value = min_value
        self.max_value = max_value


def _validar_escalera(rows, candidate=None):
    """
    Valida un conjunto de umbrales + (opcional) un candidato, proyectándolos
    como escalera de (district, np, var).

    Devuelve una lista de mensajes de error (vacía = OK).
    """
    # Únicos por threshold.id (puede haber duplicados en BD si el candidato
    # coincide con uno existente).
    plana = list(rows)
    if candidate is not None:
        plana.append(candidate)

    # Descartar rows incompletos (sin threshold o sin min/max ambos).
    plana = [r for r in plana if r.threshold is not None and (r.min_value is not None or r.max_value is not None)]
    if not plana:
        return []

    # Eliminar duplicados por threshold_id (gana el candidato).
    vistos = {}
    for r in plana:
        tid = getattr(r.threshold, 'id', None) or r.threshold
        vistos[tid] = r
    unicos = list(vistos.values())

    # Ordenar por min_value (NULL → -inf para que queden abajo).
    def _min_key(r):
        return r.min_value if r.min_value is not None else float('-inf')
    unicos.sort(key=_min_key)

    errores = []
    for i, r in enumerate(unicos):
        # Piso del primero
        if i == 0:
            if r.min_value is None:
                errores.append("El umbral inferior debe tener un valor mínimo (piso) definido.")
            elif r.min_value < 0:
                errores.append(f"El valor mínimo del umbral inferior ({r.min_value}) no puede ser negativo.")
        # Techo del último
        if i == len(unicos) - 1:
            if r.max_value is not None:
                # Permitimos techo numérico sólo si hay un único nivel; si hay
                # más, el último debe ser NULL (sin techo) para que la escalera
                # sea abierta por arriba.
                if len(unicos) > 1:
                    errores.append(
                        f"El umbral superior no debe tener valor máximo (debe ser NULL / sin techo). "
                        f"Actualmente está en {r.max_value}."
                    )
        else:
            nxt = unicos[i + 1]
            if r.max_value is None:
                errores.append(
                    f"El umbral '{getattr(r.threshold, 'name', r.threshold)}' no tiene valor máximo, "
                    f"pero existe un umbral superior ('{getattr(nxt.threshold, 'name', nxt.threshold)}'); "
                    f"el máximo debe igualar el mínimo del siguiente ({nxt.min_value})."
                )
                continue
            if nxt.min_value is None:
                errores.append(
                    f"El umbral '{getattr(nxt.threshold, 'name', nxt.threshold)}' no tiene valor mínimo, "
                    f"pero existe un umbral inferior; el mínimo debe igualar el máximo del anterior ({r.max_value})."
                )
                continue
            if abs(r.max_value - nxt.min_value) > 1e-9:
                errores.append(
                    f"Discontinuidad entre '{getattr(r.threshold, 'name', r.threshold)}' "
                    f"(máx {r.max_value}) y '{getattr(nxt.threshold, 'name', nxt.threshold)}' "
                    f"(mín {nxt.min_value}). Los rangos deben ser continuos: máximo == mínimo del siguiente."
                )
            if r.max_value <= (r.min_value if r.min_value is not None else float('-inf')):
                errores.append(
                    f"El umbral '{getattr(r.threshold, 'name', r.threshold)}' tiene mínimo >= máximo "
                    f"({r.min_value} / {r.max_value})."
                )
    return errores