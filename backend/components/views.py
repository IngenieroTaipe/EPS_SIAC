from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser

from django.db import transaction
from django.contrib.gis.geos import Point
from drf_spectacular.utils import extend_schema_view, extend_schema
from components.models import (
    Criticality,
    ComponentType,
    OperationalStatus,
    PhysicalStatus,
    Component,
    ComponentCoord
)
from components.serializers import (
    CriticalitySerializer,
    ComponentTypeSerializer,
    OperationalStatusSerializer,
    PhysicalStatusSerializer,
    ComponentSerializer,
    ComponentListSerializer,
    ComponentCoordSerializer,
    ComponentSerializer
)
from components.importer import (
    parse_csv,
    parse_geojson,
    persist_components,
    ImportError as ImportFileError,
)

@extend_schema_view(
    list=extend_schema(tags=['Components / Criticality'], summary="Listar criticidades"),
    retrieve=extend_schema(tags=['Components / Criticality'], summary="Obtener detalle de una criticidad"),
    create=extend_schema(tags=['Components / Criticality'], summary="Registrar una nueva criticidad"),
    update=extend_schema(tags=['Components / Criticality'], summary="Actualizar una criticidad"),
    partial_update=extend_schema(tags=['Components / Criticality'], summary="Actualizar parcialmente una criticidad"),
    destroy=extend_schema(tags=['Components / Criticality'], summary="Eliminar una criticidad")
)
class CriticalityViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura para la Criticidad.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Nombre.
        - Permite el ordenamiento en base a campos como: Nombre    
    """
    permission_classes = [IsAuthenticated]
    queryset = Criticality.objects.all()
    serializer_class = CriticalitySerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name']

@extend_schema_view(
    list=extend_schema(tags=['Components / Type'], summary="Listar tipos de componentes"),
    retrieve=extend_schema(tags=['Components / Type'], summary="Obtener detalle de un tipo de componente"),
    create=extend_schema(tags=['Components / Type'], summary="Registrar un nuevo tipo de componente"),
    update=extend_schema(tags=['Components / Type'], summary="Actualizar un tipo de componente"),
    partial_update=extend_schema(tags=['Components / Type'], summary="Actualizar parcialmente un tipo de componente"),
    destroy=extend_schema(tags=['Components / Type'], summary="Eliminar un tipo de componente")
)
class ComponentTypeViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura para el Tipo de Componente.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Nombre.
        - Permite el ordenamiento en base a campos como: Nombre    
    """
    permission_classes = [IsAuthenticated]
    queryset = ComponentType.objects.all()
    serializer_class = ComponentTypeSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name']

@extend_schema_view(
    list=extend_schema(tags=['Components / Operational Status'], summary="Listar estados operativos"),
    retrieve=extend_schema(tags=['Components / Operational Status'], summary="Obtener detalle de un estado operativo"),
    create=extend_schema(tags=['Components / Operational Status'], summary="Registrar un nuevo estado operativo"),
    update=extend_schema(tags=['Components / Operational Status'], summary="Actualizar un estado operativo"),
    partial_update=extend_schema(tags=['Components / Operational Status'], summary="Actualizar parcialmente un estado operativo"),
    destroy=extend_schema(tags=['Components / Operational Status'], summary="Eliminar un estado operativo")
)
class OperationalStatusViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura para el Estado Operativo.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite el filtrado en base a los Sectores, Distritos, Provincias y Departamentos.
        - Permite la búsqueda en base a campos como: Codigo, Nombre.
        - Permite el ordenamiento en base a campos como: Codigo, Nombre    
    """
    permission_classes = [IsAuthenticated]
    queryset = OperationalStatus.objects.all()
    serializer_class = OperationalStatusSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'name']
    ordering_fields = ['code', 'name']

@extend_schema_view(
    list=extend_schema(tags=['Components / Physical Status'], summary="Listar estados físicos"),
    retrieve=extend_schema(tags=['Components / Physical Status'], summary="Obtener detalle de un estado físico"),
    create=extend_schema(tags=['Components / Physical Status'], summary="Registrar un nuevo estado físico"),
    update=extend_schema(tags=['Components / Physical Status'], summary="Actualizar un estado físico"),
    partial_update=extend_schema(tags=['Components / Physical Status'], summary="Actualizar parcialmente un estado físico"),
    destroy=extend_schema(tags=['Components / Physical Status'], summary="Eliminar un estado físico")
)
class PhysicalStatusViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura para el Estado Físico.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Codigo, Nombre.
        - Permite el ordenamiento en base a campos como: Codigo, Nombre    
    """
    permission_classes = [IsAuthenticated]
    queryset = PhysicalStatus.objects.all()
    serializer_class = PhysicalStatusSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'name']
    ordering_fields = ['code', 'name']

@extend_schema_view(
    list=extend_schema(tags=['Components / Component'], summary="Listar componentes"),
    retrieve=extend_schema(tags=['Components / Component'], summary="Obtener detalle de un componente"),
    create=extend_schema(tags=['Components / Component'], summary="Registrar un nuevo componente"),
    update=extend_schema(tags=['Components / Component'], summary="Actualizar un componente"),
    partial_update=extend_schema(tags=['Components / Component'], summary="Actualizar parcialmente un componente"),
    destroy=extend_schema(tags=['Components / Component'], summary="Eliminar un componente")
)
class ComponentViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura para el Componente.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite el filtrado en base a los Sectores, Distritos, Provincias y Departamentos.
        - Permite la búsqueda en base a campos como: Codigo, Sector, Tipo, Estado Operativo, Estado Físico.
        - Permite el ordenamiento en base a campos como: Codigo, Sector, Tipo.
    """
    permission_classes = [IsAuthenticated]
    queryset = Component.objects.all()
    serializer_class = ComponentSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'district', 'name', 'type', 'operational_status', 'physical_status']
    ordering_fields = ['code', 'district', 'name', 'type']

    ordering = ['id'] # Default

    def get_queryset(self):
        return Component.objects.select_related(
            'district',
            'type',
            'operational_status',
            'physical_status'
        ).prefetch_related(
            'coords_relation__criticality'
        ).order_by('id')

    def get_serializer_class(self):
        # `ComponentListSerializer` usa `StringRelatedField` (solo lectura)
        # para `type` y `district`, por lo que no sirve para escribir ni para
        # retrievet detallado (no envia id/ubigeo, solo el string del __str__).
        # Por eso recuperamos con `ComponentSerializer` tambien, que expone
        # los FK como objetos ligeros {id, name} / {ubigeo, name} en la salida
        # (to_representation) y ademas acepta PrimaryKeyRelatedField en escritura.
        if self.action in ('create', 'update', 'partial_update', 'retrieve'):
            return ComponentSerializer
        return ComponentListSerializer

    # ── Carga masiva desde CSV / GeoJSON ─────────────────────────────
    # Acciones custom. Reciben multipart/form-data con `file` (archivo
    # subido) y un query param `dry_run=true|false`. Cuando dry_run=true
    # sólo se parsea y se valida (no persiste) — útil para preview. Si
    # dry_run=false (default) persiste transaccional. En caso de error
    # (duplicado, FK inexistente, etc.) aborta todo y NO persiste nada.
    #
    # Estrategia: ver `components/importer.py` para los detalles de
    # parseo/validación. Respuesta JSON:
    #   { created: int, errors: [{row, code, message}, ...] }
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=['Components / Component'],
        summary="Importar componentes desde CSV (dry_run para preview)",
        request=None,  # multipart con campo 'file'
    )
    @action(detail=False, methods=['post'], url_path='import-csv')
    def import_csv(self, request):
        return self._handle_import(request, parse_csv)

    @extend_schema(
        tags=['Components / Component'],
        summary="Importar componentes desde GeoJSON (dry_run para preview)",
        request=None,  # multipart con campo 'file'
    )
    @action(detail=False, methods=['post'], url_path='import-geojson')
    def import_geojson(self, request):
        return self._handle_import(request, parse_geojson)

    def _handle_import(self, request, parser_fn):
        """
            Helper común para `import_csv` e `import_geojson`. Lee el
            archivo del multipart, lo parsea con parser_fn y (según
            `dry_run`) persiste o sólo valida.
        """
        file = request.FILES.get('file')
        if not file:
            return Response(
                {"error": "Falta el parámetro 'file' (multipart)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        file_bytes = file.read()
        dry_run = request.query_params.get('dry_run', 'false').lower() in ('true', '1', 'yes')

        componentes, parse_errors = parser_fn(file_bytes)
        if parse_errors:
            # Errores de parseo (header mal, FK inexistente, etc.) — NO
            # se persiste NADA; reportamos. No usamos dry_run porque ya
            # son inválidos.
            return Response(
                {
                    "created": 0,
                    "errors": [e.__dict__ for e in parse_errors],
                },
                status=status.HTTP_200_OK,  # 200 para que el frontend lo procese
            )

        # Si el parseo sale OK, validar duplicados y (si dry_run false)
        # persistir transaccionalmente.
        creados, persist_errors = persist_components(componentes, dry_run=dry_run)
        return Response(
            {
                "created": creados,
                "errors": [e.__dict__ for e in persist_errors],
                "dry_run": dry_run,
                "preview_count": len(componentes),
            },
            status=status.HTTP_200_OK,
        )

@extend_schema_view(
    list=extend_schema(tags=['Components / Coord'], summary="Listar coordenadas"),
    retrieve=extend_schema(tags=['Components / Coord'], summary="Obtener detalle de una coordenada"),
    create=extend_schema(tags=['Components / Coord'], summary="Registrar una nueva coordenada"),
    update=extend_schema(tags=['Components / Coord'], summary="Actualizar una coordenada"),
    partial_update=extend_schema(tags=['Components / Coord'], summary="Actualizar parcialmente una coordenada"),
    destroy=extend_schema(tags=['Components / Coord'], summary="Eliminar una coordenada")
)
class ComponentCoordViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura para la Coordenada del Componente.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Componente, Tipo, Criticidad.
        - Permite el ordenamiento en base a campos como: Componente, Tipo, Criticidad.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ComponentCoordSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['component__code', 'component__name', 'criticality__name']
    ordering_fields = ['component', 'criticality']
    ordering = ['id']
    
    def get_queryset(self):
        return ComponentCoord.objects.select_related(
            'component',
            'criticality'
        ).order_by('id')

    @extend_schema(
        request=ComponentSerializer,
        responses={201: ComponentCoordSerializer(many=True)},
        summary="Carga masiva de coordenadas para un componente"
    )
    @action(detail=False, methods=['post'], url_path='bulk-upload')
    def bulk_upload(self, request):
        """
            Acción de Carga Masiva Optimizada:
            Valida e inserta N coordenadas en una sola instrucción SQL transaccional.
        """
        serializer = ComponentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        component = serializer.validated_data['component']
        coordinates_data = serializer.validated_data['coordinates']

        coords_to_create = []

        # === Procesar datos (validación y geotransformación ya hechas en el serializador) ===
        for coord_item in coordinates_data:
            # La geotransformación (UTM->WGS84 o Point) se ejecuta dentro del 'CoordinateItemSerializer.validate()'
            coords_to_create.append(
                ComponentCoord(
                    component=component,
                    criticality=coord_item['criticality'],
                    coords=coord_item['coords']
                )
            )

        # === Inserción transaccional ===
        with transaction.atomic():
            created_instances = ComponentCoord.objects.bulk_create(coords_to_create)

        response_serializer = self.get_serializer(created_instances, many=True)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)