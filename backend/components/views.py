from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
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
    ComponentCoordSerializer
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
    search_fields = ['code', 'sector', 'name', 'type', 'operational_status', 'physical_status']
    ordering_fields = ['code', 'sector', 'name', 'type']

    ordering = ['id'] # Default

    def get_queryset(self):
        return Component.objects.select_related(
            'sector',
            'operational_status',
            'physical_status'
        ).filter(is_deleted=False).order_by('id')

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
    search_fields = ['component', 'type', 'criticality']
    ordering_fields = ['component', 'type']

    ordering = ['id'] # Default

    def get_queryset(self):
        return ComponentCoord.objects.select_related(
            'component'
        ).filter(is_deleted=False).order_by('id')
