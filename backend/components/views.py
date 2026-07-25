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
    list=extend_schema(tags=['Components / Criticality'], summary="Listar criticidades con filtrado espacial/atributo"),
    retrieve=extend_schema(tags=['Components / Criticality'], summary="Obtener detalle de una criticidad por código"),
    create=extend_schema(tags=['Components / Criticality'], summary="Registrar una nueva criticidad"),
    update=extend_schema(tags=['Components / Criticality'], summary="Actualizar completamente una criticidad (PUT)"),
    partial_update=extend_schema(tags=['Components / Criticality'], summary="Actualizar parcialmente una criticidad (PATCH)"),
    destroy=extend_schema(tags=['Components / Criticality'], summary="Eliminar una criticidad (DELETE)")
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
    
    serializer_class = CriticalitySerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name']

@extend_schema_view(
    list=extend_schema(tags=['Components / Type'], summary="Listar tipos de componentes con filtrado espacial/atributo"),
    retrieve=extend_schema(tags=['Components / Type'], summary="Obtener detalle de un tipo de componente por código"),
    create=extend_schema(tags=['Components / Type'], summary="Registrar un nuevo tipo de componente"),
    update=extend_schema(tags=['Components / Type'], summary="Actualizar completamente un tipo de componente (PUT)"),
    partial_update=extend_schema(tags=['Components / Type'], summary="Actualizar parcialmente un tipo de componente (PATCH)"),
    destroy=extend_schema(tags=['Components / Type'], summary="Eliminar un tipo de componente (DELETE)")
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
    
    serializer_class = ComponentTypeSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name']

@extend_schema_view(
    list=extend_schema(tags=['Components / Operational Status'], summary="Listar estados operativos con filtrado espacial/atributo"),
    retrieve=extend_schema(tags=['Components / Operational Status'], summary="Obtener detalle de un estado operativo por código"),
    create=extend_schema(tags=['Components / Operational Status'], summary="Registrar un nuevo estado operativo"),
    update=extend_schema(tags=['Components / Operational Status'], summary="Actualizar completamente un estado operativo (PUT)"),
    partial_update=extend_schema(tags=['Components / Operational Status'], summary="Actualizar parcialmente un estado operativo (PATCH)"),
    destroy=extend_schema(tags=['Components / Operational Status'], summary="Eliminar un estado operativo (DELETE)")
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
    
    serializer_class = OperationalStatusSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'name']
    ordering_fields = ['code', 'name']

@extend_schema_view(
    list=extend_schema(tags=['Components / Physical Status'], summary="Listar estados físicos con filtrado espacial/atributo"),
    retrieve=extend_schema(tags=['Components / Physical Status'], summary="Obtener detalle de un estado físico por código"),
    create=extend_schema(tags=['Components / Physical Status'], summary="Registrar un nuevo estado físico"),
    update=extend_schema(tags=['Components / Physical Status'], summary="Actualizar completamente un estado físico (PUT)"),
    partial_update=extend_schema(tags=['Components / Physical Status'], summary="Actualizar parcialmente un estado físico (PATCH)"),
    destroy=extend_schema(tags=['Components / Physical Status'], summary="Eliminar un estado físico (DELETE)")
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
    
    serializer_class = PhysicalStatusSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'name']
    ordering_fields = ['code', 'name']

@extend_schema_view(
    list=extend_schema(tags=['Components / Component'], summary="Listar componentes con filtrado espacial/atributo"),
    retrieve=extend_schema(tags=['Components / Component'], summary="Obtener detalle de un componente por código"),
    create=extend_schema(tags=['Components / Component'], summary="Registrar un nuevo componente"),
    update=extend_schema(tags=['Components / Component'], summary="Actualizar completamente un componente (PUT)"),
    partial_update=extend_schema(tags=['Components / Component'], summary="Actualizar parcialmente un componente (PATCH)"),
    destroy=extend_schema(tags=['Components / Component'], summary="Eliminar un componente (DELETE)")
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
    
    serializer_class = ComponentSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'sector', 'type', 'operational_status', 'physical_status']
    ordering_fields = ['code', 'sector', 'type']

@extend_schema_view(
    list=extend_schema(tags=['Components / Coord'], summary="Listar coordenadas de componentes con filtrado espacial/atributo"),
    retrieve=extend_schema(tags=['Components / Coord'], summary="Obtener detalle de una coordenada de componente por código"),
    create=extend_schema(tags=['Components / Coord'], summary="Registrar una nueva coordenada de componente"),
    update=extend_schema(tags=['Components / Coord'], summary="Actualizar completamente una coordenada de componente (PUT)"),
    partial_update=extend_schema(tags=['Components / Coord'], summary="Actualizar parcialmente una coordenada de componente (PATCH)"),
    destroy=extend_schema(tags=['Components / Coord'], summary="Eliminar una coordenada de componente (DELETE)")
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
