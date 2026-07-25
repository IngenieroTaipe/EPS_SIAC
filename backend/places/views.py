from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from django_filters.rest_framework import DjangoFilterBackend
from places.models import Department, Province, District, Sector
from drf_spectacular.utils import extend_schema, extend_schema_view
from places.serializers import (
    DepartmentSerializer, 
    ProvinceSerializer,
    DistrictSerializer,
    SectorSerializer
)

@extend_schema_view(
    list=extend_schema(tags=['Places / Department'], summary="Listar departamentos con filtrado espacial/atributo"),
    retrieve=extend_schema(tags=['Places / Department'], summary="Obtener detalle de un departamento por UBIGEO"),
    create=extend_schema(tags=['Places / Department'], summary="Registrar un nuevo departamento"),
    update=extend_schema(tags=['Places / Department'], summary="Actualizar completamente un departamento (PUT)"),
    partial_update=extend_schema(tags=['Places / Department'], summary="Actualizar parcialmente un departamento (PATCH)"),
    destroy=extend_schema(tags=['Places / Department'], summary="Eliminar un departamento (DELETE)")
)
class DepartmentViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura/Escritura para Departamentos.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Nombre, Ubigeo.
        - Permite el ordenamiento en base a campos como: Nombre, Ubigeo    
    """
    permission_classes = [IsAuthenticatedOrReadOnly]

    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    lookup_field = 'ubigeo'
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['ubigeo', 'name']
    ordering_fields = ['ubigeo', 'name']


@extend_schema_view(
    list=extend_schema(tags=['Places / Province'], summary="Listar provincias con filtrado espacial/atributo"),
    retrieve=extend_schema(tags=['Places / Province'], summary="Obtener detalle de una provincia por UBIGEO"),
    create=extend_schema(tags=['Places / Province'], summary="Registrar una nueva provincia"),
    update=extend_schema(tags=['Places / Province'], summary="Actualizar completamente una provincia (PUT)"),
    partial_update=extend_schema(tags=['Places / Province'], summary="Actualizar parcialmente una provincia (PATCH)"),
    destroy=extend_schema(tags=['Places / Province'], summary="Eliminar una provincia (DELETE)")
)
class ProvinceViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura/Escritura para Provincias.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite el filtrado en base a las Provincias y Departamentos.
        - Permite la búsqueda en base a campos como: Nombre, Ubigeo.
        - Permite el ordenamiento en base a campos como: Nombre, Ubigeo    
    """
    permission_classes = [IsAuthenticatedOrReadOnly]

    serializer_class = ProvinceSerializer
    lookup_field = 'ubigeo'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['department']
    search_fields = ['ubigeo', 'name']
    ordering_fields = ['ubigeo', 'name']

    def get_queryset(self):
        return Province.objects.select_related('department').all()

@extend_schema_view(
    list=extend_schema(tags=['Places / District'], summary="Listar distritos con filtrado espacial/atributo"),
    retrieve=extend_schema(tags=['Places / District'], summary="Obtener detalle de un distrito por UBIGEO"),
    create=extend_schema(tags=['Places / District'], summary="Registrar un nuevo distrito"),
    update=extend_schema(tags=['Places / District'], summary="Actualizar completamente un distrito (PUT)"),
    partial_update=extend_schema(tags=['Places / District'], summary="Actualizar parcialmente un distrito (PATCH)"),
    destroy=extend_schema(tags=['Places / District'], summary="Eliminar un distrito (DELETE)")
)
class DistrictViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura/Escritura para Distritos.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite el filtrado en base a los Distritos, Provincias y Departamentos.
        - Permite la búsqueda en base a campos como: Nombre, Ubigeo.
        - Permite el ordenamiento en base a campos como: Nombre, Ubigeo    
    """
    permission_classes = [IsAuthenticatedOrReadOnly]

    serializer_class = DistrictSerializer
    lookup_field = 'ubigeo'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['province', 'province__department']
    search_fields = ['ubigeo', 'name']
    ordering_fields = ['ubigeo', 'name']

    def get_queryset(self):
        return District.objects.select_related('province__department').all()

@extend_schema_view(
    list=extend_schema(tags=['Places / Sector'], summary="Listar sectores con filtrado espacial/atributo"),
    retrieve=extend_schema(tags=['Places / Sector'], summary="Obtener detalle de un sector por código"),
    create=extend_schema(tags=['Places / Sector'], summary="Registrar un nuevo sector"),
    update=extend_schema(tags=['Places / Sector'], summary="Actualizar completamente un sector (PUT)"),
    partial_update=extend_schema(tags=['Places / Sector'], summary="Actualizar parcialmente un sector (PATCH)"),
    destroy=extend_schema(tags=['Places / Sector'], summary="Eliminar un sector (DELETE)")
)
class SectorViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura/Escritura para Sectores.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite el filtrado en base a los Sectores, Distritos, Provincias y Departamentos.
        - Permite la búsqueda en base a campos como: Codigo, Nombre.
        - Permite el ordenamiento en base a campos como: Codigo, Nombre    
    """
    permission_classes = [IsAuthenticatedOrReadOnly]

    serializer_class = SectorSerializer
    lookup_field = 'code'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['district', 'status']
    search_fields = ['code', 'name']
    ordering_fields = ['code', 'name']

    def get_queryset(self):
        return Sector.objects.select_related('district').all()