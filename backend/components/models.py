from django.contrib.gis.db import models # Importamos los models de Django especializados en geodatabases para definir los modelos de la DB Postgis
from core_shared.models import AuditCompleteModel

from components.validators import operational_status_code_validator, physical_status_code_validator, component_code_validator
from core_shared.validators import alpha_name_validator

class Criticality(AuditCompleteModel):
    '''
        Modelo que representa la criticidad de un componente. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'criticalities'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Criticidad'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Criticidades'.
        
        `@str`: Devuelve el nombre de la criticidad como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    name = models.CharField(max_length=30, unique=True, validators=[alpha_name_validator])
    description = models.TextField()

    class Meta():
        db_table = 'criticalities'
        verbose_name = 'Criticidad'
        verbose_name_plural = 'Criticidades'

    def __str__(self):
        return self.name

class ComponentType(AuditCompleteModel):
    '''
        Modelo que representa el tipo de componente. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'type_components'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Tipo de Componente'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Tipos de Componentes'.
        
        `@str`: Devuelve el nombre del tipo de componente como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    name = models.CharField(max_length=50, unique=True, validators=[alpha_name_validator])
    description = models.TextField(blank=True, null=True)

    class Meta():
        db_table = 'type_components'
        verbose_name = 'Tipo de Componente'
        verbose_name_plural = 'Tipos de Componentes'

    def __str__(self):
        return self.name

class OperationalStatus(AuditCompleteModel):
    '''
        Modelo que representa el estado operativo de un componente. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'criticalities'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Estado Operativo'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Estados Operativos'.
        
        `@str`: Devuelve el nombre del estado operativo como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    code = models.CharField(max_length=3, unique=True, validators=[operational_status_code_validator])
    name = models.CharField(max_length=50, unique=True, validators=[alpha_name_validator]) 
    description = models.TextField(blank=True, null=True)

    class Meta():
        db_table = 'operational_statuses'
        verbose_name = 'Estado Operativo'
        verbose_name_plural = 'Estados Operativos'

    def __str__(self):
        return self.name

class PhysicalStatus(AuditCompleteModel):
    '''
        Modelo que representa el estado físico de un componente. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'physical_statuses'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Estado Físico'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Estados Físicos'.
        
        `@str`: Devuelve el nombre del estado físico como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    code = models.CharField(max_length=1, unique=True, validators=[physical_status_code_validator])
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, null=True)

    class Meta():
        db_table = 'physical_statuses'
        verbose_name = 'Estado Físico'
        verbose_name_plural = 'Estados Físicos'

    def __str__(self):
        return self.name

class Component(AuditCompleteModel):
    '''
        Modelo que representa un componente. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'components'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Componente'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Componentes'.
        
        `@str`: Devuelve el nombre del componente como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    sector = models.ForeignKey(
        to='places.Sector', 
        on_delete=models.CASCADE
    )
    type = models.ForeignKey(
        to='ComponentType', 
        on_delete=models.CASCADE
    )
    physical_status = models.ForeignKey(
        to='PhysicalStatus', 
        on_delete=models.CASCADE
    )
    operational_status = models.ForeignKey(
        to='OperationalStatus', 
        on_delete=models.CASCADE
    )
    code = models.CharField(max_length=4, unique=True, validators=[component_code_validator])
    name = models.CharField(max_length=50, unique=True)
    specification = models.TextField()

    class Meta():
        db_table = 'components'
        verbose_name = 'Componente'
        verbose_name_plural = 'Componentes'
        unique_together = ['sector', 'type', 'code']

    def __str__(self):
        return f"{self.code} - {self.type.name} - {self.sector.name}"
        
class ComponentCoord(AuditCompleteModel):
    '''
        Modelo que representa las coordenadas de un componente. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'component_coords'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Coordenada de Componente'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Coordenadas de Componentes'.
        
        `@str`: Devuelve el nombre de la criticidad como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    component = models.ForeignKey(
        'Component', 
        on_delete=models.CASCADE
    )
    criticality = models.ForeignKey(
        to='Criticality',
        on_delete=models.CASCADE
    )
    coords = models.PointField(srid=4326, verbose_name="Ubicación WGS84")

    class Meta():
        db_table = 'components_coords'
        verbose_name = 'Coordenada de Componente'
        verbose_name_plural = 'Coordenadas de Componentes'

    def __str__(self):
        return f"{self.component.code} ({self.component.type.name})"
        