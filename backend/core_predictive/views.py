from rest_framework import viewsets, filters, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import action
from rest_framework.response import Response

from datetime import datetime
from django_filters.rest_framework import DjangoFilterBackend
from django.core.cache import cache
from django.db import transaction
from drf_spectacular.utils import extend_schema_view, extend_schema, OpenApiParameter, OpenApiTypes

from core_shared.permissions import IsAdminUserOrReadOnly

from core_predictive.models import (
    NaturalPhenomena,
    GFSRequest,
    GFSActiveCell,
    GFSClusterSnapshot,
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
    GFSClusterSnapshotGeoJSONSerializer,
    NaturalPhenomenaSerializer,
    NaturalPhenomenasVariablesSerializer,
    VariableSerializer,
    VariableTypeSerializer,
    UnitsMeasurementSerializer,
    ThresholdNaturalPhenomenaSerializer,
    ThresholdSerializer,
)

from core_predictive.utils.geojson_builder import GeoJSONResponseService

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
    list=extend_schema(tags=['Predictive / GFS Active Cells'], summary="Listar Celdas Activas de GFS"),
    retrieve=extend_schema(tags=['Predictive / GFS Active Cells'], summary="Obtener detalle de una Celda Activa de GFS"),
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
        tags=['Predictive / GFS Active Cells'],
        summary="Obtener las celdas activas de la ÚLTIMA ejecución GFS completada",
        responses={200: GFSActiveCellGeoJSONSerializer(many=True)}
    )

    @action(detail=False, methods=['get'], url_path='latest')
    def get_latest_geojson(self, request):
        return GeoJSONResponseService.build_latest_response(
            model_class=GFSActiveCell,
            properties_fields=['gfs_request_id', 'max_intensity_mm_h', 'timestamps', 'intensity_series'],
            cache_key="gfs_latest_cells_geojson"
        )

    @extend_schema(
        tags=['Predictive / GFS Active Cells'],
        summary="Obtener las celdas activas de la ventana extendida de 18 horas de GFS (T-6h a T+12h)",
        responses={200: GFSActiveCellGeoJSONSerializer(many=True)}
    )
    @action(detail=False, methods=['get'], url_path='window-18h')
    def get_18h_window_cells(self, request):
        return GeoJSONResponseService.build_18h_window_cells_response(
            model_class=GFSActiveCell,
            properties_fields=[
                'gfs_request_id', 'max_intensity_mm_h', 'timestamps',
                'intensity_series', 'threshold_names', 'district_ubigeos'
            ],
            cache_key="gfs_window_18h_cells_geojson"
        )

@extend_schema_view(
    list=extend_schema(tags=['Predictive / GFS Clusters'], summary="Listar Clústeres Espacio-Temporales Disueltos de GFS"),
    retrieve=extend_schema(tags=['Predictive / GFS Clusters'], summary="Obtener detalle de un Clúster Espacio-Temporal Disuelto de GFS"),
)
class GFSClusterSnapshotViewSet(viewsets.ReadOnlyModelViewSet):
    """ ViewSet para los Clústeres Espacio-Temporales Disueltos (~300 polígonos) """
    permission_classes = [AllowAny]
    queryset = GFSClusterSnapshot.objects.all()
    serializer_class = GFSClusterSnapshotGeoJSONSerializer

    @extend_schema(
        tags=['Predictive / GFS Clusters'],
        summary="Obtener los clústeres activos de la última ejecución GFS completada",
        responses={200: GFSClusterSnapshotGeoJSONSerializer(many=True)}
    )
    @action(detail=False, methods=['get'], url_path='latest')
    def get_latest_clusters(self, request):
        return GeoJSONResponseService.build_latest_response(
            model_class=GFSClusterSnapshot,
            properties_fields=[
                'gfs_request_id', 'time_step', 'timestamp_utc', 'cluster_index',
                'total_cells', 'max_intensity_mm_h', 'avg_intensity_mm_h',
                'threshold_id', 'affected_ubigeos'
            ],
            cache_key="gfs_latest_clusters_geojson"
        )
    
    @extend_schema(
        tags=['Predictive / GFS Clusters'],
        summary="Obtener los clústeres activos de la ventana extendida de 18 horas de GFS (T-6h a T+12h)",
        responses={200: GFSClusterSnapshotGeoJSONSerializer(many=True)}
    )
    @action(detail=False, methods=['get'], url_path='window-18h')
    def get_18h_window_clusters(self, request):
        return GeoJSONResponseService.build_18h_window_response(
            model_class=GFSClusterSnapshot,
            properties_fields=[
                'gfs_request_id', 'time_step', 'timestamp_utc', 'cluster_index',
                'total_cells', 'max_intensity_mm_h', 'avg_intensity_mm_h',
                'threshold_id', 'affected_ubigeos'
            ],
            cache_key="gfs_window_18h_clusters_geojson"
        )

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
        )

    @extend_schema(
        tags=['Predictive / Thresholds of Natural Phenomena'],
        summary="Guardar la escalera completa de umbrales de un (distrito + fenómeno + variable)",
        request=OpenApiTypes.OBJECT,
        responses={200: ThresholdNaturalPhenomenaSerializer(many=True)},
    )
    @action(detail=False, methods=['post', 'patch'], url_path='bulk')
    def bulk(self, request):
        """
            Reescribe ATÓMICAMENTE la escalera completa de umbrales para un
            (district, natural_phenomena, variable).

            Body:
              {
                "natural_phenomena": <id>,
                "variable": <id>,
                "district": <ubigeo>,
                "force": <bool, opcional — si true salta la validación del
                          estado previo y simplemente reescribe>,
                "items": [
                  {"id": <int|null>, "threshold": <id>,
                   "min_value": <number|null>, "max_value": <number|null>},
                  ...
                ]
              }

            Semántica:
              - Los items con `id` se actualizan (PATCH) en su fila existente.
              - Los items sin `id` se CREAN (POST).
              - Las filas existentes en (district, np, var) cuyos ids NO
                figuren en `items` se ELIMINAN (DELETE).
              - Toda la operación se hace dentro de transaction.atomic().
              - Se valida la escalera resultante (continuidad estricta). Si
                `force=true` sólo se salta la verificación del estado previo,
                NO la coherencia del resultado final.
        """
        np_id = request.data.get('natural_phenomena')
        var_id = request.data.get('variable')
        dist_ubigeo = request.data.get('district')
        items = request.data.get('items')
        force = bool(request.data.get('force', False))

        if np_id is None or var_id is None or dist_ubigeo is None:
            raise ValidationError(
                "Debe indicar natural_phenomena, variable y district (ubigeo)."
            )
        if not isinstance(items, list) or not items:
            raise ValidationError("'items' debe ser una lista no vacía.")

        # Resolver el distrito por ubigeo (PK string) — fallar temprano si no existe.
        from places.models import District
        try:
            district = District.objects.get(ubigeo=dist_ubigeo)
        except District.DoesNotExist:
            raise ValidationError(f"No existe el distrito con ubigeo '{dist_ubigeo}'.")

        # Validar unicidad de threshold por item (no pueden repetirse categorías).
        seen_thresholds = set()
        for it in items:
            tid = it.get('threshold')
            if tid in seen_thresholds:
                raise ValidationError(
                    f"La categoría (threshold) {tid} aparece más de una vez en 'items'."
                )
            seen_thresholds.add(tid)

        # Resolver MTM relacionados una vez (fail-fast si alguno no existe).
        try:
            np_obj = NaturalPhenomena.objects.get(pk=np_id)
            var_obj = Variable.objects.get(pk=var_id)
            thresholds_map = {t.pk: t for t in Threshold.objects.filter(pk__in=seen_thresholds)}
            if len(thresholds_map) != len(seen_thresholds):
                missing = set(seen_thresholds) - set(thresholds_map.keys())
                raise ValidationError(f"Threshold(s) inexistente(s): {sorted(missing)}.")
        except (NaturalPhenomena.DoesNotExist, Variable.DoesNotExist) as e:
            raise ValidationError(str(e))

        with transaction.atomic():
            qs = ThresholdsNaturalPhenomena.objects.filter(
                natural_phenomena_id=np_obj.pk,
                variable_id=var_obj.pk,
                district_id=district.pk,
            )
            sent_ids = {it.get('id') for it in items if it.get('id') is not None}
            if not force:
                existentes_ids = set(qs.values_list('id', flat=True))
                huérfanos_ids = existentes_ids - sent_ids
                if huérfanos_ids:
                    raise ValidationError(
                        "El estado previo de la escalera no coincide con el enviado "
                        f"(ids no presentes: {sorted(huérfanos_ids)}). Use force=true "
                        "para sobrescribir de todos modos."
                    )

            # Eliminar huérfanos.
            qs.exclude(id__in=sent_ids).delete()

            filas = []
            for it in items:
                tid = it['threshold']
                thr = thresholds_map[tid]
                mn = it.get('min_value')
                mx = it.get('max_value')
                if mn is None and mx is None:
                    raise ValidationError(
                        f"El umbral '{thr.name}' no define ni mínimo ni máximo; "
                        "al menos uno debe estar presente."
                    )
                if mn is not None and mx is not None and float(mn) > float(mx):
                    raise ValidationError(
                        f"El umbral '{thr.name}' tiene min ({mn}) > max ({mx})."
                    )

                if it.get('id') is not None:
                    try:
                        inst = qs.get(pk=it['id'])
                    except ThresholdsNaturalPhenomena.DoesNotExist:
                        raise ValidationError(
                            f"No existe el umbral con id {it['id']} para este "
                            "(district, natural_phenomena, variable)."
                        )
                    inst.threshold = thr
                    inst.min_value = mn
                    inst.max_value = mx
                    inst.save(update_fields=['threshold', 'min_value', 'max_value'])
                    filas.append(inst)
                else:
                    inst = ThresholdsNaturalPhenomena.objects.create(
                        natural_phenomena=np_obj,
                        variable=var_obj,
                        district=district,
                        threshold=thr,
                        min_value=mn,
                        max_value=mx,
                    )
                    filas.append(inst)

            # Validar la escalera resultante en memoria.
            from core_predictive.serializers import _validar_escalera
            errores = _validar_escalera(list(qs))
            if errores:
                # transaction.atomic() propagará el rollback al salir del with.
                raise ValidationError(errores)

        srl = ThresholdNaturalPhenomenaSerializer(
            filas, many=True, context={'request': request, 'force': True}
        )
        return Response(srl.data, status=status.HTTP_200_OK)