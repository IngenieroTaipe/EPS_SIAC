from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from drf_spectacular.utils import extend_schema_view, extend_schema

from organization.serializers import (
    BranchSerializer,
    OrganicUnitSerializer,
    RolesUnitSerializer,
    WorkerSerializer,
    MemberSerializer,
    BranchesOrganicUnitSerializer
)
from organization.models import (
    Branch,
    OrganicUnit,
    RolesUnit,
    Worker,
    Member,
    BranchesOrganicUnit
)

@extend_schema_view(
    list=extend_schema(tags=['Organization / Branches'], summary="Listar sucursales"),
    retrieve=extend_schema(tags=['Organization / Branches'], summary="Obtener detalle de una sucursal"),
    create=extend_schema(tags=['Organization / Branches'], summary="Registrar una nueva sucursal"),
    update=extend_schema(tags=['Organization / Branches'], summary="Actualizar una sucursal"),
    partial_update=extend_schema(tags=['Organization / Branches'], summary="Actualizar parcialmente una sucursal"),
    destroy=extend_schema(tags=['Organization / Branches'], summary="Eliminar una sucursal")
)
class BranchViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura/Escritura para Sucursales.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Código, Nombre, Acrónimo, Estatus, Distrito (Ubigeo, Nombre), Provincia (Ubigeo, Nombre), Departamento (Ubigeo, Nombre).
        - Permite el ordenamiento en base a campos como: Código, Nombre, Acrónimo, Estatus.    
    """
    serializer_class = BranchSerializer
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = [
        'status',
        'district',
        'district__province',
        'district__province__department',
    ]
    search_fields = [
        'code',
        'name',
        'acronym',
        'district__ubigeo',
        'district__name',
        'district__province__name',
        'district__province__department__name',
    ]
    ordering_fields = [
        'id',
        'code',
        'name',
        'acronym',
        'status',
    ]

    def get_queryset(self):
        """
            Realiza un Lazy Loader para evitar consultas múltiples
        """
        return Branch.objects.select_related(
            'district__province__department',
        ).filter()

@extend_schema_view(
    list=extend_schema(tags=['Organization / Organic Unit'], summary="Listar unidades orgánicas"),
    retrieve=extend_schema(tags=['Organization / Organic Unit'], summary="Obtener detalle de una unidad orgánica"),
    create=extend_schema(tags=['Organization / Organic Unit'], summary="Registrar una nueva unidad orgánica"),
    update=extend_schema(tags=['Organization / Organic Unit'], summary="Actualizar una unidad orgánica"),
    partial_update=extend_schema(tags=['Organization / Organic Unit'], summary="Actualizar parcialmente una unidad orgánica"),
    destroy=extend_schema(tags=['Organization / Organic Unit'], summary="Eliminar una unidad orgánica")
)
class OrganicUnitViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura/Escritura para Unidades Orgánicas.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.

        - Permite la búsqueda en base a campos como: Código, Nombre, Sigla, Nivel jerárquico, Unidad Orgánica Padre (Nombre).
        - Permite el ordenamiento en base a campos como: Código, Nombre, Sigla, Nivel jerárquico.    
    """
    queryset = OrganicUnit.objects.all()
    serializer_class = OrganicUnitSerializer
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = [
        'hierarchy_level',
        'parent_unit',
        'parent_unit__name',
    ]
    search_fields = [
        'code',
        'name',
        'acronym',
        'parent_unit__name',
    ]
    ordering_fields = [
        'code',
        'name',
        'acronym',
        'hierarchy_level'
    ]

    def get_queryset(self):
        """
            Realiza un Lazy Loader para evitar consultas múltiples
        """
        return OrganicUnit.objects.select_related(
            'parent_unit'
        ).filter()

@extend_schema_view(
    list=extend_schema(tags=['Organization / Roles Unit'], summary="Listar roles de unidades orgánicas"),
    retrieve=extend_schema(tags=['Organization / Roles Unit'], summary="Obtener detalle de un rol de unidad orgánica"),
    create=extend_schema(tags=['Organization / Roles Unit'], summary="Registrar un nuevo rol de unidad orgánica"),
    update=extend_schema(tags=['Organization / Roles Unit'], summary="Actualizar un rol de unidad orgánica"),
    partial_update=extend_schema(tags=['Organization / Roles Unit'], summary="Actualizar parcialmente un rol de unidad orgánica"),
    destroy=extend_schema(tags=['Organization / Roles Unit'], summary="Eliminar un rol de unidad orgánica")
)
class RolesUnitViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura/Escritura para Roles de Unidades Orgánicas.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Nombre.
        - Permite el ordenamiento en base a campos como: Nombre.    
    """
    queryset = RolesUnit.objects.all()
    serializer_class = RolesUnitSerializer
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
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
    list=extend_schema(tags=['Organization / Worker'], summary="Listar trabajadores"),
    retrieve=extend_schema(tags=['Organization / Worker'], summary="Obtener detalle de un trabajador"),
    create=extend_schema(tags=['Organization / Worker'], summary="Registrar un nuevo trabajador"),
    update=extend_schema(tags=['Organization / Worker'], summary="Actualizar un trabajador"),
    partial_update=extend_schema(tags=['Organization / Worker'], summary="Actualizar parcialmente un trabajador"),
    destroy=extend_schema(tags=['Organization / Worker'], summary="Eliminar un trabajador")
)
class WorkerViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura/Escritura para Trabajadores.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: DNI, Email.
        - Permite el ordenamiento en base a campos como: DNI, Email.    
    """
    queryset = Worker.objects.all()
    serializer_class = WorkerSerializer
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = [
        'dni',
        'email',
    ]
    search_fields = [
        'names',
        'paternal_lastname',
        'maternal_lastname',
        'dni',
        'email',
    ]
    ordering_fields = [
        'names',
        'paternal_lastname',
        'maternal_lastname',
        'dni',
        'email',
    ]

@extend_schema_view(
    list=extend_schema(tags=['Organization / Member'], summary="Listar miembros"),
    retrieve=extend_schema(tags=['Organization / Member'], summary="Obtener detalle de un miembro"),
    create=extend_schema(tags=['Organization / Member'], summary="Registrar un nuevo miembro"),
    update=extend_schema(tags=['Organization / Member'], summary="Actualizar un miembro"),
    partial_update=extend_schema(tags=['Organization / Member'], summary="Actualizar parcialmente un miembro"),
    destroy=extend_schema(tags=['Organization / Member'], summary="Eliminar un miembro")
)
class MemberViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura/Escritura para los Miembros de la EPS Selva Central.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: DNI, Email.
        - Permite el ordenamiento en base a campos como: DNI, Email.    
    """
    serializer_class = MemberSerializer
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = [
        # Búsqueda por Primary Key (IDs)
        'worker',
        'rol_unit',
        'branch_organic_unit',

        # Búsqueda relacional por Nombres / Atributos
        'rol_unit__name',
        'worker__names',
        'branch_organic_unit__branch__name',
        'branch_organic_unit__organic_unit__name',
    ]
    search_fields = [
        # Búsqueda en el modelo Worker
        'worker__dni',
        'worker__names',
        'worker__paternal_lastname',
        'worker__maternal_lastname',
        
        # Búsqueda en el modelo RolUnit
        'rol_unit__name',
        
        # Búsqueda en el modelo BranchOrganicUnit
        'branch_organic_unit__branch__name',
        'branch_organic_unit__organic_unit__name',
    ]
    ordering_fields = [
        # Ordenamiento en el modelo Worker
        'worker__dni',
        'worker__names',
        'worker__paternal_lastname',
        'worker__maternal_lastname',

        # Ordenamiento en el modelo RolUnit
        'rol_unit__name',

        # Ordenamiento en el modelo BranchOrganicUnit
        'branch_organic_unit__branch__name',
        'branch_organic_unit__organic_unit__name',
    ]

    def get_queryset(self):
        """
            Realiza un Lazy Loader para evitar consultas múltiples
        """
        return Member.objects.select_related(
            'worker',
            'rol_unit',
            'branch_organic_unit__branch',
            'branch_organic_unit__organic_unit'
        ).all()

@extend_schema_view(
    list=extend_schema(tags=['Organization / Branches / Organic Unit'], summary="Listar sucursales de unidades orgánicas"),
    retrieve=extend_schema(tags=['Organization / Branches / Organic Unit'], summary="Obtener detalle de una sucursal de unidad orgánica"),
    create=extend_schema(tags=['Organization / Branches / Organic Unit'], summary="Registrar una nueva sucursal de unidad orgánica"),
    update=extend_schema(tags=['Organization / Branches / Organic Unit'], summary="Actualizar una sucursal de unidad orgánica"),
    partial_update=extend_schema(tags=['Organization / Branches / Organic Unit'], summary="Actualizar parcialmente una sucursal de unidad orgánica"),
    destroy=extend_schema(tags=['Organization / Branches / Organic Unit'], summary="Eliminar una sucursal de unidad orgánica")
)
class BranchesOrganicUnitViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura/Escritura para Sucursales de Unidades Orgánicas.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Sucursal, Unidad Orgánica.
        - Permite el ordenamiento en base a campos como: Sucursal, Unidad Orgánica.    
    """
    queryset = BranchesOrganicUnit.objects.all()
    serializer_class = BranchesOrganicUnitSerializer
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = [
        'branch__name',
        'organic_unit__name',
    ]
    search_fields = [
        'branch__name',
        'organic_unit__name',
    ]
    ordering_fields = [
        'branch__name',
        'organic_unit__name',
    ]

    def get_queryset(self):
        """
            Realiza un Lazy Loader para evitar consultas múltiples
        """
        return BranchesOrganicUnit.objects.select_related(
            'branch',
            'organic_unit'
        ).filter()