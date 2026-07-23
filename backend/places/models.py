from django.db import models
from core_shared.models import AuditCreateModel, AuditCompleteModel

class Departments(AuditCompleteModel):
    '''
        Modelo que representa un departamento. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'departments'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Departamento'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Departamentos'.
        
        `@str`: Devuelve el nombre del departamento como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    ubigeo = models.CharField(max_length=2, unique=True)
    name = models.CharField(max_length=50, unique=True)

    class Meta():
        db_table = 'departments'
        verbose_name = 'Departamento'
        verbose_name_plural = 'Departamentos'

    def __str__(self):
        return self.name

class Provinces(AuditCompleteModel):
    '''
        Modelo que representa una provincia. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'provinces'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Provincia'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Provincias'.
        
        `@str`: Devuelve el nombre de la provincia como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    department = models.ForeignKey(
        'Department', 
        on_delete=models.PROTECT, 
        related_name='provinces'
    )
    ubigeo = models.CharField(max_length=4, unique=True)
    name = models.CharField(max_length=50, unique=True)

    class Meta():
        db_table = 'provinces'
        verbose_name = 'Provincia'
        verbose_name_plural = 'Provincias'

    def __str__(self):
        return self.name

class Districts(AuditCompleteModel):
    '''
        Modelo que representa una provincia. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'districts'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Distrito'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Distritos'.
        
        `@str`: Devuelve el nombre del distrito como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    province_id = models.ForeignKey(
        'Provinces', 
        on_delete=models.PROTECT, 
        related_name='districts'
    )
    ubigeo = models.CharField(max_length=6, unique=True)
    name = models.CharField(max_length=50, unique=True)

    class Meta():
        db_table = 'districts'
        verbose_name = 'Distrito'
        verbose_name_plural = 'Distritos'

    def __str__(self):
        return self.name

class Sectors(AuditCompleteModel):
    '''
        Modelo que representa un sector. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'sectors'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Sector'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Sectores'.
        
        `@str`: Devuelve el nombre del sector como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    district_id = models.ForeignKey(
        'Districts',
        on_delete=models.PROTECT,
        related_name='sectors'
    )
    ubigeo = models.CharField(max_length=6, unique=True)
    name = models.CharField(max_length=50, unique=True)
    status = models.BooleanField(default=True)
    observations = models.TextField(null=True, blank=True)

    class Meta():
        db_table = 'sectors'
        verbose_name = 'Sector'
        verbose_name_plural = 'Sectores'

    def __str__(self):
        return self.name