from django.contrib.gis.db import models
from django.core.validators import RegexValidator
from core_shared.models import AuditCompleteModel
from places.validators import department_ubigeo_validator, province_ubigeo_validator, district_ubigeo_validator, sector_code_validator
from core_shared.validators import alpha_name_validator

class Department(AuditCompleteModel):
    '''
        Modelo que representa un departamento. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'departments'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Departamento'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Departamentos'.
        
        `@str`: Devuelve el nombre del departamento como representación en cadena del objeto.
    '''
    ubigeo = models.CharField(max_length=2, unique=True, primary_key=True,
            validators=[department_ubigeo_validator])
    name = models.CharField(max_length=50, unique=True, validators=[alpha_name_validator])
    geometry = models.MultiPolygonField(srid=4326, null=True, blank=True)

    class Meta():
        db_table = 'departments'
        verbose_name = 'Departamento'
        verbose_name_plural = 'Departamentos'
        ordering = ['ubigeo']

    def __str__(self):
        return self.name

class Province(AuditCompleteModel):
    '''
        Modelo que representa una provincia. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'provinces'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Provincia'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Provincias'.
        
        `@str`: Devuelve el nombre de la provincia como representación en cadena del objeto.
    '''
    ubigeo = models.CharField(max_length=4, unique=True, primary_key=True,
            validators=[province_ubigeo_validator])
    department = models.ForeignKey(
        'Department', 
        on_delete=models.PROTECT, 
        related_name='provinces',
        db_column='department_ubigeo'
    )
    name = models.CharField(max_length=50, unique=True, validators=[alpha_name_validator])
    geometry = models.MultiPolygonField(srid=4326, null=True, blank=True)

    class Meta():
        db_table = 'provinces'
        verbose_name = 'Provincia'
        verbose_name_plural = 'Provincias'
        ordering = ['ubigeo']
        unique_together = ('department', 'name')

    def __str__(self):
        return self.name

class District(AuditCompleteModel):
    '''
        Modelo que representa una provincia. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'districts'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Distrito'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Distritos'.
        
        `@str`: Devuelve el nombre del distrito como representación en cadena del objeto.
    '''
    ubigeo = models.CharField(max_length=6, unique=True, primary_key=True,
            validators=[district_ubigeo_validator])
    province = models.ForeignKey(
        'Province', 
        on_delete=models.PROTECT, 
        related_name='districts',
        db_column='province_ubigeo'
    )
    name = models.CharField(max_length=50, validators=[alpha_name_validator])
    geometry = models.MultiPolygonField(srid=4326, null=True, blank=True)

    thresholds = models.ManyToManyField(
        'core_predictive.Threshold',
        through='core_predictive.ThresholdsNaturalPhenomena',
        related_name='districts',
        blank=True
    )
    class Meta():
        db_table = 'districts'
        verbose_name = 'Distrito'
        verbose_name_plural = 'Distritos'
        ordering = ['ubigeo']
        unique_together = ('province', 'name')

    def __str__(self):
        return self.name

class Sector(AuditCompleteModel):
    '''
        Modelo que representa un sector. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'sectors'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Sector'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Sectores'.
        
        `@str`: Devuelve el nombre del sector como representación en cadena del objeto.
    '''
    code = models.CharField(max_length=3, primary_key=True,
        validators=[sector_code_validator])
    district = models.ForeignKey(
        'District',
        on_delete=models.PROTECT,
        related_name='sectors',
        db_column='district_ubigeo'
    )
    name = models.CharField(max_length=50, unique=True, validators=[alpha_name_validator])
    status = models.BooleanField(default=True)
    observations = models.TextField(null=True, blank=True)

    class Meta():
        db_table = 'sectors'
        verbose_name = 'Sector'
        verbose_name_plural = 'Sectores'
        ordering = ['code']
        unique_together = ('district', 'code')

    def __str__(self):
        return f'{self.code} - {self.name}'