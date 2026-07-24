from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from places.models import Department, Province, District, Sector

from places.serializers import (
    DepartmentSerializer, 
    ProvinceSerializer,
    DistrictSerializer,
    SectorSerializer
)

class DepartmentViewSet(viewsets.ReadOnlyModelViewSet):
    """
        Controlador de Lectura para Departamentos (Nivel 1).
        - El controlador solo tiene permitido el uso de los métodos GET (List, o individual)

        - Permite la búsqueda en base a campos como: Nombre, Ubigeo.
        - Permite el ordenamiento en base a campos como: Nombre, Ubigeo    
    """
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    lookup_field = 'ubigeo'
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['ubigeo', 'name']
    ordering_fields = ['ubigeo', 'name']

class ProvinceViewSet(viewsets.ReadOnlyModelViewSet):
    """
        Controlador de Lectura para las Provincias (Nivel 2).
        - El controlador solo tiene permitido el uso de los métodos GET (List, o individual)
        - Permite el filtrado en base a las Provincias y Departamentos
        - Permite la búsqueda en base a campos como: Nombre, Ubigeo.
        - Permite el ordenamiento en base a campos como: Nombre, Ubigeo    
    """
    serializer_class = ProvinceSerializer
    lookup_field = 'ubigeo'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['department']
    search_fields = ['ubigeo', 'name']
    ordering_fields = ['ubigeo', 'name']

    def get_queryset(self):
        return Province.objects.select_related('department').all()

class DistrictViewSet(viewsets.ReadOnlyModelViewSet):
    """
        Controlador de Lectura para los Distritos (Nivel 2).
        - El controlador solo tiene permitido el uso de los métodos GET (List, o individual)
        - Permite el filtrado en base a los Distritos, Provincias y Departamentos
        - Permite la búsqueda en base a campos como: Nombre, Ubigeo.
        - Permite el ordenamiento en base a campos como: Nombre, Ubigeo    
    """
    serializer_class = DistrictSerializer
    lookup_field = 'ubigeo'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['province', 'province__department']
    search_fields = ['ubigeo', 'name']
    ordering_fields = ['ubigeo', 'name']

    def get_queryset(self):
        return District.objects.select_related('province__department').all()

class SectorViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura para los Sectores (Nivel 1).
        - El controlador permite todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE)
        - Permite el filtrado en base a los Sectores
        - Permite la búsqueda en base a campos como: Codigo, Nombre.
        - Permite el ordenamiento en base a campos como: Codigo, Nombre    
    """
    serializer_class = SectorSerializer
    lookup_field = 'code'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['district', 'status']
    search_fields = ['code', 'name']
    ordering_fields = ['code', 'name']

    def get_queryset(self):
        return Sector.objects.select_related('district').all()