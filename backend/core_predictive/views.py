from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema_view, extend_schema
from core_predictive.models import (
    NaturalPhenomena,
    EMCWFRequest,
    VariableType,
    UnitsMeasurement,
    Variable,
    NaturalPhenomenasVariables,
    Threshold,
    ThresholdsNaturalPhenomena
)
from core_predictive.serializers import (
    EMCWFRequestSerializer,
    NaturalPhenomenaSerializer,
    NaturalPhenomenasVariablesSerializer,
    VariableSerializer,
    VariableTypeSerializer,
    UnitsMeasurementSerializer,
    ThresholdNaturalPhenomenaSerializer,
    ThresholdSerializer
)

@extend_schema_view(
    list=extend_schema(tags=['Predictive / EMCWF'], summary="Listar Solicitudes EMCWF"),
    retrieve=extend_schema(tags=['Predictive / EMCWF'], summary="Obtener detalle de una Solicitud EMCWF"),
)
class EMCWFRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """
        Controlador de Lectura para las Solicitudes EMCWF.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Nombre.
        - Permite el ordenamiento en base a campos como: Nombre    
    """
    permission_classes = [IsAuthenticated]
    queryset = EMCWFRequest.objects.all()
    serializer_class = EMCWFRequestSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        'request_code',
        'status',
        'target_variable',
        'date_range_start',
        'date_range_end'
    ]
    ordering_fields = [
        'request_code',
        'status',
        'target_variable',
        'date_range_start',
        'date_range_end'
    ]

@extend_schema_view(
    list=extend_schema(tags=['Predictive / Natural Phenomena'], summary="Listar Fenómenos Naturales"),
    retrieve=extend_schema(tags=['Predictive / Natural Phenomena'], summary="Obtener detalle de un Fenómeno Natural"),
    create=extend_schema(tags=['Predictive / Natural Phenomena'], summary="Registrar un nuevo Fenómeno Natural"),
    update=extend_schema(tags=['Predictive / Natural Phenomena'], summary="Actualizar un Fenómeno Natural"),
    partial_update=extend_schema(tags=['Predictive / Natural Phenomena'], summary="Actualizar parcialmente un Fenómeno Natural"),
    destroy=extend_schema(tags=['Predictive / Natural Phenomena'], summary="Eliminar un Fenómeno Natural")
)

class NaturalPhenomenaViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura para los Fenómenos Naturales.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Nombre.
        - Permite el ordenamiento en base a campos como: Nombre    
    """
    permission_classes = [IsAuthenticated]
    queryset = VariableType.objects.all()
    serializer_class = VariableTypeSerializer
    filter_backends = [
        filters.SearchFilter, 
        filters.OrderingFilter,
        DjangoFilterBackend,
    ]
    filterset_fields = [
        'name',
    ]
    search_fields = [
        'name',
    ]
    ordering_fields = [
        'name',
    ]

@extend_schema_view(
    list=extend_schema(tags=['Predictive / Variable Type'], summary="Listar Tipos de Variables"),
    retrieve=extend_schema(tags=['Predictive / Variable Type'], summary="Obtener detalle de un Tipo de Variable"),
    create=extend_schema(tags=['Predictive / Variable Type'], summary="Registrar un nuevo Tipo de Variable"),
    update=extend_schema(tags=['Predictive / Variable Type'], summary="Actualizar un Tipo de Variable"),
    partial_update=extend_schema(tags=['Predictive / Variable Type'], summary="Actualizar parcialmente un Tipo de Variable"),
    destroy=extend_schema(tags=['Predictive / Variable Type'], summary="Eliminar un Tipo de Variable")
)
class VariableTypeViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura para los Tipos de Variables.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Nombre.
        - Permite el ordenamiento en base a campos como: Nombre    
    """
    permission_classes = [IsAuthenticated]
    queryset = UnitsMeasurement.objects.all()
    serializer_class = UnitsMeasurementSerializer
    filter_backends = [
        filters.SearchFilter, 
        filters.OrderingFilter,
        DjangoFilterBackend,
    ]
    filterset_fields = [
        'name',
    ]
    search_fields = [
        'name',
    ]
    ordering_fields = [
        'name',
    ]

@extend_schema_view(
    list=extend_schema(tags=['Predictive / Units Measurement'], summary="Listar Unidades de Medida"),
    retrieve=extend_schema(tags=['Predictive / Units Measurement'], summary="Obtener detalle de una Unidad de Medida"),
    create=extend_schema(tags=['Predictive / Units Measurement'], summary="Registrar una nueva Unidad de Medida"),
    update=extend_schema(tags=['Predictive / Units Measurement'], summary="Actualizar una Unidad de Medida"),
    partial_update=extend_schema(tags=['Predictive / Units Measurement'], summary="Actualizar parcialmente una Unidad de Medida"),
    destroy=extend_schema(tags=['Predictive / Units Measurement'], summary="Eliminar una Unidad de Medida")
)
class UnitsMeasurementViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura/Escritura para las Unidades de Medida.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Nombre.
        - Permite el ordenamiento en base a campos como: Nombre    
    """
    permission_classes = [IsAuthenticated]
    queryset = UnitsMeasurement.objects.all()
    serializer_class = UnitsMeasurementSerializer
    filter_backends = [
        filters.SearchFilter, 
        filters.OrderingFilter,
        DjangoFilterBackend,
    ]
    filterset_fields = [
        'name',
    ]
    search_fields = [
        'name',
    ]
    ordering_fields = [
        'name',
    ]

@extend_schema_view(
    list=extend_schema(tags=['Predictive / Variables'], summary="Listar Variables"),
    retrieve=extend_schema(tags=['Predictive / Variables'], summary="Obtener detalle de una Variable"),
    create=extend_schema(tags=['Predictive / Variables'], summary="Registrar una nueva Variable"),
    update=extend_schema(tags=['Predictive / Variables'], summary="Actualizar una Variable"),
    partial_update=extend_schema(tags=['Predictive / Variables'], summary="Actualizar parcialmente una Variable"),
    destroy=extend_schema(tags=['Predictive / Variables'], summary="Eliminar una Variable")
)
class VariableViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura/Escritura para las Variables.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Nombre, Variable Type (name).
        - Permite el ordenamiento en base a campos como: Nombre, Variable Type (name)    
    """
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]

    filtered_fields = [
        'variable_type',
    ]

    search_fields = [
        'variale_type__name',

        'name'
    ]

    ordering_fields = [
        'id',
        'name'
    ]

    def get_queryset(self):
        return Variable.objects.select_related(
            'variable_type'
        ).filter()

@extend_schema_view(
    list=extend_schema(tags=['Predictive / Natural Phenomena Variables'], summary="Listar Variables de Fenómenos Naturales"),
    retrieve=extend_schema(tags=['Predictive / Natural Phenomena Variables'], summary="Obtener detalle de una Variable de Fenómeno Natural"),
    create=extend_schema(tags=['Predictive / Natural Phenomena Variables'], summary="Registrar una nueva Variable de Fenómeno Natural"),
    update=extend_schema(tags=['Predictive / Natural Phenomena Variables'], summary="Actualizar una Variable de Fenómeno Natural"),
    partial_update=extend_schema(tags=['Predictive / Natural Phenomena Variables'], summary="Actualizar parcialmente una Variable de Fenómeno Natural"),
    destroy=extend_schema(tags=['Predictive / Natural Phenomena Variables'], summary="Eliminar una Variable de Fenómeno Natural")
)
class NaturalPhenomenasVariablesViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura/Escritura para las Variables de Fenómenos Naturales.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Nombre, Fenómeno Natural (name).
        - Permite el ordenamiento en base a campos como: Nombre, Fenómeno Natural (name)    
    """
    permission_classes = [IsAuthenticated]
    serializer_class = NaturalPhenomenasVariablesSerializer
    filter_backends = [
        filters.SearchFilter, 
        DjangoFilterBackend,
    ]
    filterset_fields = [
        'natural_phenomena',
        'variable',
        'natural_phenomena__name',
        'variable__name'
    ]
    search_fields = [
        'variable__name',
        'natural_phenomena__name',
    ]

    def get_queryset(self):
        return NaturalPhenomenasVariables.objects.select_related(
            'natural_phenomena', 'variable'
        ).filter()

@extend_schema_view(
    list=extend_schema(tags=['Predictive / Thresholds'], summary="Listar Umbrales"),
    retrieve=extend_schema(tags=['Predictive / Thresholds'], summary="Obtener detalle de un Umbral"),
    create=extend_schema(tags=['Predictive / Thresholds'], summary="Registrar un nuevo Umbral"),
    update=extend_schema(tags=['Predictive / Thresholds'], summary="Actualizar un Umbral"),
    partial_update=extend_schema(tags=['Predictive / Thresholds'], summary="Actualizar parcialmente un Umbral"),
    destroy=extend_schema(tags=['Predictive / Thresholds'], summary="Eliminar un Umbral")
)
class ThresholdViewSet(viewsets.ModelViewSet):
    """
    Controlador de Lectura/Escritura para los Umbrales.
    - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
    - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
    - Permite la búsqueda en base a campos como: Nombre.
    - Permite el ordenamiento en base a campos como: Nombre    
    """

    serializer_class = ThresholdSerializer
    filter_backends = [
        filters.SearchFilter, 
        DjangoFilterBackend,
    ]
    filterset_fields = [
        'name',
    ]
    search_fields = [
        'name',
    ]

    def get_queryset(self):
        return Threshold.objects.all()

@extend_schema_view(
    list=extend_schema(tags=['Predictive / Thresholds of Natural Phenomena'], summary="Listar Umbrales de Fenómenos Naturales"),
    retrieve=extend_schema(tags=['Predictive / Thresholds of Natural Phenomena'], summary="Obtener detalle de un Umbral de Fenómeno Natural"),
    create=extend_schema(tags=['Predictive / Thresholds of Natural Phenomena'], summary="Registrar un nuevo Umbral de Fenómeno Natural"),
    update=extend_schema(tags=['Predictive / Thresholds of Natural Phenomena'], summary="Actualizar un Umbral de Fenómeno Natural"),
    partial_update=extend_schema(tags=['Predictive / Thresholds of Natural Phenomena'], summary="Actualizar parcialmente un Umbral de Fenómeno Natural"),
    destroy=extend_schema(tags=['Predictive / Thresholds of Natural Phenomena'], summary="Eliminar un Umbral de Fenómeno Natural")
)
class ThresholdsNaturalPhenomenaViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura/Escritura para los Umbrales de Fenómenos Naturales.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Umbral, Fenómeno Natural (name).
        - Permite el ordenamiento en base a campos como: Umbral, Fenómeno Natural (name)    
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ThresholdNaturalPhenomenaSerializer
    filter_backends = [
        filters.SearchFilter, 
        filters.OrderingFilter,
        DjangoFilterBackend,
    ]
    filterset_fields = [
        'natural_phenomena',
        'variable',
        'district',
        'variable__name',
        'natural_phenomena__name',
        'district__name',
        'district__ubigeo'
    ]
    search_fields = [
        'variable__name',
        'natural_phenomena__name',
        'district__name',
        'district__ubigeo'
    ]
    ordering_fields = [
        'natural_phenomena__name',
        'variable__name',
        'district__name',
        'district__ubigeo',
    ]

    def get_queryset(self):
        return ThresholdsNaturalPhenomena.objects.select_related(
            'natural_phenomena', 'variable', 'district'
        ).filter()