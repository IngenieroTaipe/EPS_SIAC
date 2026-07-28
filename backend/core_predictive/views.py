from rest_framework import viewsets, filters, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import action
from rest_framework.response import Response

from datetime import datetime
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema_view, extend_schema, OpenApiParameter, OpenApiTypes

from core_shared.permissions import IsAdminUserOrReadOnly

from core_predictive.models import (
    NaturalPhenomena,
    GFSRequest,
    GFSActiveCell,
    VariableType,
    UnitsMeasurement,
    Variable,
    NaturalPhenomenasVariables,
    Threshold,
    ThresholdsNaturalPhenomena
)
from core_predictive.serializers import (
    GFSRequestSerializer,
    GFSRequestLightSerializer,
    GFSActiveCellGeoJSONSerializer,
    NaturalPhenomenaSerializer,
    NaturalPhenomenasVariablesSerializer,
    VariableSerializer,
    VariableTypeSerializer,
    UnitsMeasurementSerializer,
    ThresholdNaturalPhenomenaSerializer,
    ThresholdSerializer,
)

@extend_schema_view(
    list=extend_schema(tags=['Predictive / GFS'], summary="Listar Solicitudes GFS"),
    retrieve=extend_schema(tags=['Predictive / GFS'], summary="Obtener detalle de una Solicitud GFS"),
)
class GFSRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """
        Controlador de Lectura para las Solicitudes GFS.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Nombre.
        - Permite el ordenamiento en base a campos como: Nombre    
    """
    permission_classes = [AllowAny]
    queryset = GFSRequest.objects.all().order_by('-created_at')
    serializer_class = GFSRequestSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        'request_code',
        'status',
        'target_variable'
    ]
    ordering_fields = [
        'request_code',
        'status',
        'date_range_start',
        'created_at'
    ]

    def get_serializer_class(self):
        """
        Intercepta la acción solicitada y asigna la clase serializadora correspondiente:
        - Acciones de Lista ('list'): Serializador Liviano.
        - Acciones de Detalle ('retrieve', 'create', 'update'): Serializador Completo.
        """
        if self.action == 'retrieve':
            return GFSRequestSerializer
        
        return GFSRequestLightSerializer

@extend_schema_view(
    list=extend_schema(tags=['Predictive / GFS'], summary="Listar Células Activas de GFS"),
    retrieve=extend_schema(tags=['Predictive / GFS'], summary="Obtener detalle de una Célula Activa de GFS"),
)
class GFSActiveCellViewSet(viewsets.ReadOnlyModelViewSet):
    """
        Controlador de Lectura para las Celdas Activas de GFS.
        - Permite el uso de los métodos HTTP de Lectura (GET). Los métodos de Lectura no requieren de autenticación.
    """
    permission_classes = [AllowAny]
    queryset = GFSActiveCell.objects.all().select_related('gfs_request')
    serializer_class = GFSActiveCellGeoJSONSerializer

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = ['gfs_request__request_code']
    ordering_fields = ['max_intensity_mm_h', 'created_at']


    @extend_schema(
        tags=['Predictive / GFS'],
        summary="Obtener las celdas activas de la ÚLTIMA ejecución GFS completada",
        responses={200: GFSActiveCellGeoJSONSerializer(many=True)}
    )
    @action(detail=False, methods=['get'], url_path='latest')
    def get_latest_geojson(self, request):
        """
        Endpoint: /api/gfs-active-cells/latest/
        Retorna el FeatureCollection de celdas vectoriales de la ejecución más reciente (COMPLETED).
        Resuelve el traslape seleccionando únicamente los datos de la última ejecución procesada.
        """
        latest_request = GFSRequest.objects.filter(
            status='COMPLETED'
        ).order_by('-date_range_start', '-created_at').first()

        if not latest_request:
            return Response({
                "type": "FeatureCollection",
                "features": [],
                "metadata": {
                    "message": "No existen solicitudes GFS procesadas en estado COMPLETED."
                }
            }, status=status.HTTP_200_OK)

        # Consulta acelerada de celdas asociadas a la última solicitud
        active_cells_qs = GFSActiveCell.objects.filter(
            gfs_request=latest_request
        )

        serializer = self.get_serializer(active_cells_qs, many=True)
        
        geojson_response = {
            "type": "FeatureCollection",
            "metadata": {
                "request_code": latest_request.request_code,
                "target_variable": latest_request.target_variable,
                "run_start_utc": latest_request.date_range_start,
                "run_end_utc": latest_request.date_range_end,
                "total_features": active_cells_qs.count()
            },
            "features": serializer.data
        }
        return Response(geojson_response, status=status.HTTP_200_OK)

    @extend_schema(
        tags=['Predictive / GFS'],
        summary="Obtener FeatureCollection GeoJSON por fecha (YYYY-MM-DD)",
        description="Devuelve la malla vectorial (FeatureCollection) correspondiente a la ÚLTIMA ejecución completada para la fecha consultada, lista para ser renderizada en Leaflet.",
        parameters=[
            OpenApiParameter(
                name='date',
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description="Fecha de consulta en formato YYYY-MM-DD",
                required=True
            )
        ]
    )
    @action(detail=False, methods=['get'], url_path='by-date')
    def get_geojson_by_date(self, request):
        """
        Endpoint: /api/gfs-active-cells/by-date/?date=YYYY-MM-DD

        Resuelve el traslape temporal seleccionando la ejecución 'COMPLETED' más reciente
        que cubre la fecha consultada y retorna una estructura GeoJSON FeatureCollection.
        """
        date_str = request.query_params.get('date')
        if not date_str:
            raise ValidationError({"date": "El parámetro de fecha 'date' es obligatorio (Formato YYYY-MM-DD)."})

        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            raise ValidationError({"date": "Formato de fecha inválido. Utilice YYYY-MM-DD."})

        # === Lógica para obtener la última solicitud ===
        latest_request_for_date = GFSRequest.objects.filter(
            date_range_start__date__lte=target_date,
            date_range_end__date__gte=target_date,
            status='COMPLETED'
        ).order_by('-date_range_start', '-created_at').first()

        if not latest_request_for_date:
            return Response({
                "type": "FeatureCollection",
                "features": [],
                "metadata": {
                    "message": f"No se encontraron pronósticos completados para la fecha {date_str}."
                }
            }, status=status.HTTP_200_OK)

        # === Obtener celdas vectoriales en PostGIS ===
        active_cells_qs = GFSActiveCell.objects.filter(gfs_request=latest_request_for_date)
        serializer = GFSActiveCellGeoJSONSerializer(active_cells_qs, many=True)

        # === Construcción de la respuesta en formato GeoJSON FeatureCollection (RFC 7946) ===
        geojson_response = {
            "type": "FeatureCollection",
            "metadata": {
                "request_code": latest_request_for_date.request_code,
                "target_variable": latest_request_for_date.target_variable,
                "run_start_utc": latest_request_for_date.date_range_start,
                "run_end_utc": latest_request_for_date.date_range_end,
                "total_features": active_cells_qs.count()
            },
            "features": serializer.data
        }

        return Response(geojson_response, status=status.HTTP_200_OK)

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
    queryset = NaturalPhenomena.objects.all()
    serializer_class = NaturalPhenomenaSerializer
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
    serializer_class = VariableSerializer
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
    permission_classes = [IsAdminUserOrReadOnly]

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
        'threshold',
        'variable__name',
        'natural_phenomena__name',
        'district__name',
        'district__ubigeo'
    ]
    search_fields = [
        'variable__name',
        'natural_phenomena__name',
        'district__name',
        'district__ubigeo',
        'threshold__name'
    ]
    ordering_fields = [
        'natural_phenomena__name',
        'variable__name',
        'district__name',
        'district__ubigeo',
        'threshold__name'
    ]

    def get_queryset(self):
        return ThresholdsNaturalPhenomena.objects.select_related(
            'natural_phenomena', 'variable', 'district', 'threshold'
        ).filter(is_deleted=False)