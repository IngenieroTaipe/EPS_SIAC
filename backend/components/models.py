from django.contrib.gis.db import models # Importamos los models de Django especializados en geodatabases para definir los modelos de la DB Postgis
from core_shared.models import AuditCompleteModel

class Criticalities(AuditCompleteModel):
    '''
        Modelo que representa la criticidad de un componente. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'criticalities'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Criticidad'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Criticidades'.
        
        `@str`: Devuelve el nombre de la criticidad como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField()

    class Meta():
        db_table = 'criticalities'
        verbose_name = 'Criticidad'
        verbose_name_plural = 'Criticidades'

    def __str__(self):
        return self.name

class ComponentTypes(AuditCompleteModel):
    '''
        Modelo que representa la criticidad de un componente. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'criticalities'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Criticidad'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Criticidades'.
        
        `@str`: Devuelve el nombre de la criticidad como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField()

    class Meta():
        db_table = 'type_coords'
        verbose_name = 'Tipo de Coordenada'
        verbose_name_plural = 'Tipos de Coordenadas'

    def __str__(self):
        return self.name

class OperationalStatuses(AuditCompleteModel):
    '''
        Modelo que representa la criticidad de un componente. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'criticalities'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Criticidad'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Criticidades'.
        
        `@str`: Devuelve el nombre de la criticidad como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    code = models.CharField(max_length=3, unique=True)
    name = models.CharField(max_length=50, unique=True) 

    class Meta():
        db_table = 'operational_statuses'
        verbose_name = 'Estado Operativo'
        verbose_name_plural = 'Estados Operativos'

    def __str__(self):
        return self.name

class PhysicalStatuses(AuditCompleteModel):
    '''
        Modelo que representa la criticidad de un componente. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'criticalities'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Criticidad'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Criticidades'.
        
        `@str`: Devuelve el nombre de la criticidad como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    code = models.CharField(max_length=3, unique=True)
    name = models.CharField(max_length=50, unique=True) 

    class Meta():
        db_table = 'physical_statuses'
        verbose_name = 'Estado Físico'
        verbose_name_plural = 'Estados Físicos'

    def __str__(self):
        return self.name

class Components(AuditCompleteModel):
    '''
        Modelo que representa la criticidad de un componente. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'criticalities'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Criticidad'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Criticidades'.
        
        `@str`: Devuelve el nombre de la criticidad como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    sector = models.ForeignKey(
        'places.Sector', 
        on_delete=models.CASCADE
    )
    type = models.ForeignKey(
        'ComponentTypes', 
        on_delete=models.CASCADE
    )
    physical_status = models.ForeignKey(
        'PhysicalStatuses', 
        on_delete=models.CASCADE
    )
    operational_status = models.ForeignKey(
        'OperationalStatuses', 
        on_delete=models.CASCADE
    )
    code = models.CharField(max_length=7, unique=True)
    specification = models.TextField()

    class Meta():
        db_table = 'components'
        verbose_name = 'Componente'
        verbose_name_plural = 'Componentes'

class ComponentsCoords(AuditCompleteModel):
    '''
        Modelo que representa la criticidad de un componente. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'criticalities'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Criticidad'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Criticidades'.
        
        `@str`: Devuelve el nombre de la criticidad como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    component_id = models.ForeignKey(
        'Components', 
        on_delete=models.CASCADE
    )
    criticality_id = models.ForeignKey(
        to='Criticalities',
        on_delete=models.CASCADE
    )
    coords = models.PointField(srid=4326, verbose_name="Ubicación WGS84")

    class Meta():
        db_table = 'components_coords'
        verbose_name = 'Coordenada de Componente'
        verbose_name_plural = 'Coordenadas de Componentes'
        