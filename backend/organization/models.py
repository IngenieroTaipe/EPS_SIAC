from django.db import models
from core_shared.models import AuditCompleteModel
from core_shared.validators import alpha_name_validator
from organization.validators import branch_code_validator, dni_validator, phone_number_validator

class Branch(AuditCompleteModel):
    '''
        Modelo que representa una sucursal. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'branches'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Sucursal'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Sucursales'.
        
        `@str`: Devuelve el nombre de la sucursal como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    district = models.ForeignKey(
        'places.District', 
        on_delete=models.PROTECT, 
        related_name='branches_district', null=False, blank=False
    )
    code = models.CharField(max_length=3, unique=True, null=False, blank=False, validators=[branch_code_validator])
    name = models.CharField(max_length=50, unique=True, null=False, blank=False, validators=[alpha_name_validator])
    acronym = models.CharField(max_length=3, unique=True, null=False, blank=False)
    status = models.BooleanField(default=True)
    observations = models.TextField(null=True, blank=True)

    class Meta():
        db_table = 'branches'
        verbose_name = 'Sucursal'
        verbose_name_plural = 'Sucursales'

    def __str__(self):
        return self.name

class OrganicUnit(AuditCompleteModel):
    '''
        Modelo que representa una unidad orgánica. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'organic_units'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Unidad Orgánica'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Unidades Orgánicas'.
        
        `@str`: Devuelve el nombre de la unidad orgánica como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    parent_unit = models.ForeignKey(
        'self', 
        on_delete=models.PROTECT, 
        related_name='organic_units_parent', null=True, blank=True
    )
    name = models.CharField(max_length=50, unique=True, null=False, blank=False, validators=[alpha_name_validator])
    hierarchy_level = models.PositiveIntegerField(null=False, blank=False)

    class Meta():
        db_table = 'organic_units'
        verbose_name = 'Unidad Orgánica'
        verbose_name_plural = 'Unidades Orgánicas'

    def __str__(self):
        return self.name

class BranchesOrganicUnit(AuditCompleteModel):
    '''
        Modelo que representa la relación entre una sucursal y una unidad orgánica. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'branches_organic_units'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Sucursal - Unidad Orgánica'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Sucursales - Unidades Orgánicas'.
        
        `@str`: Devuelve el nombre de la relación como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    branch = models.ForeignKey(
        'Branch', 
        on_delete=models.PROTECT, 
        related_name='branches_organic_units_branch'
    )
    organic_unit = models.ForeignKey(
        'OrganicUnit', 
        on_delete=models.PROTECT, 
        related_name='branches_organic_units_organic_unit'
    )

    class Meta():
        db_table = 'branches_organic_units'
        verbose_name = 'Sucursal - Unidad Orgánica'
        verbose_name_plural = 'Sucursales - Unidades Orgánicas'

    def __str__(self):
        return f'{self.branch_id.name} - {self.organic_unit_id.name}'

class RolesUnit(AuditCompleteModel):
    '''
        Modelo que representa la relación entre un rol y una unidad orgánica. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'roles_units'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Rol - Unidad Orgánica'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Roles - Unidades Orgánicas'.
        
        `@str`: Devuelve el nombre de la relación como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    name = models.CharField(max_length=50, unique=True, null=False, blank=False, validators=[alpha_name_validator])
    description = models.TextField(null=True, blank=True)

    class Meta():
        db_table = 'roles_units'
        verbose_name = 'Rol - Unidad Orgánica'
        verbose_name_plural = 'Roles - Unidades Orgánicas'

    def __str__(self):
        return self.name

class Worker(AuditCompleteModel):
    '''
        Modelo que representa un trabajador. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'workers'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Trabajador'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Trabajadores'.
        
        `@str`: Devuelve el nombre del trabajador como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    names = models.CharField(max_length=150, null=False, blank=False, validators=[alpha_name_validator])
    paternal_lastname = models.CharField(max_length=150, null=False, blank=False, validators=[alpha_name_validator])
    maternal_lastname = models.CharField(max_length=150, null=False, blank=False, validators=[alpha_name_validator])
    dni = models.CharField(max_length=8, unique=True, null=False, blank=False, validators=[dni_validator])
    email = models.EmailField(unique=True, null=False, blank=False)
    phone_number = models.CharField(max_length=9, unique=True, null=False, blank=False, validators=[phone_number_validator])

    class Meta():
        db_table = 'workers'
        verbose_name = 'Trabajador'
        verbose_name_plural = 'Trabajadores'

    def __str__(self):
        return f'{self.names} {self.paternal_lastname} {self.maternal_lastname} - {self.dni}'
    
class Member(AuditCompleteModel):
    '''
        Modelo que representa un miembro de la organización. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'members'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Miembro'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Miembros'.
        
        `@str`: Devuelve el nombre del miembro como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    worker = models.ForeignKey(
        'Worker', 
        on_delete=models.PROTECT, 
        related_name='members_worker',
        null=False, blank=False
    )
    rol_unit = models.ForeignKey(
        'RolesUnit', 
        on_delete=models.PROTECT, 
        related_name='members_role_unit',
        null=False, blank=False
    )
    branch_organic_unit = models.ForeignKey(
        'BranchesOrganicUnit', 
        on_delete=models.PROTECT, 
        related_name='members_branch_organic_unit', 
        null=False, blank=False
    )

    class Meta():
        db_table = 'members'
        verbose_name = 'Miembro'
        verbose_name_plural = 'Miembros'

    def __str__(self):
        return f'{self.worker.names} {self.worker.paternal_lastname} {self.worker.maternal_lastname} - {self.rol_unit.name}'