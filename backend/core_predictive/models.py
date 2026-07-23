from django.contrib.gis.db import models
from core_shared.models import AuditCompleteModel

class EMCWFRequests(AuditCompleteModel):
    '''
        Modelo que representa una solicitud de EMCWF. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'emcwf_requests'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Solicitud EMCWF'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Solicitudes EMCWF'.
        
        `@str`: Devuelve el nombre de la solicitud como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    request_code = models.CharField(max_length=100, unique=True)
    status = models.CharField(max_length=20)
    TargetVariable = models.CharField(max_length=50)
    DateRangeStart = models.DateField()
    DateRangeEnd = models.DateField()

    GeomBounds = models.PolygonField(srid=4326, verbose_name="Límite Geométrico WGS84")

    FileName = models.CharField(max_length=200)
    FilePath = models.CharField(max_length=200)
    FileSizeMb = models.FloatField()
    DownloandTimeSeconds = models.FloatField()

    class Meta():
        db_table = 'emcwf_requests'
        verbose_name = 'Solicitud EMCWF'
        verbose_name_plural = 'Solicitudes EMCWF'

    def __str__(self):
        return self.emcwf_request_id

class NaturalPhenomenas(AuditCompleteModel):
    '''
        Modelo que representa un fenómeno natural. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'natural_phenomenas'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Fenómeno Natural'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Fenómenos Naturales'.
        
        `@str`: Devuelve el nombre del fenómeno natural como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(null=True, blank=True)

    class Meta():
        db_table = 'natural_phenomenas'
        verbose_name = 'Fenómeno Natural'
        verbose_name_plural = 'Fenómenos Naturales'

    def __str__(self):
        return self.name

class VariableTypes(AuditCompleteModel):
    '''
        Modelo que representa un tipo de variable. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'variable_types'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Tipo de Variable'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Tipos de Variables'.
        
        `@str`: Devuelve el nombre del tipo de variable como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(null=True, blank=True)

    class Meta():
        db_table = 'variable_types'
        verbose_name = 'Tipo de Variable'
        verbose_name_plural = 'Tipos de Variables'

    def __str__(self):
        return self.name

class UnitsMeasurement(AuditCompleteModel):
    '''
        Modelo que representa una unidad de medida. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'units_measurement'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Unidad de Medida'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Unidades de Medida'.
        
        `@str`: Devuelve el nombre de la unidad de medida como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(null=True, blank=True)

    class Meta():
        db_table = 'units_measurement'
        verbose_name = 'Unidad de Medida'
        verbose_name_plural = 'Unidades de Medida'

    def __str__(self):
        return self.name

class Variables(AuditCompleteModel):
    '''
        Modelo que representa una variable. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'variables'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Variable'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Variables'.
        
        `@str`: Devuelve el nombre de la variable como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    variable_type = models.ForeignKey(
        'VariableTypes', 
        on_delete=models.CASCADE, 
        related_name='variables_variable_type'
    )
    unit_measurement = models.ForeignKey(
        'UnitsMeasurement', 
        on_delete=models.CASCADE, 
        related_name='variables_unit_measurement'
    )
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(null=True, blank=True)

    class Meta():
        db_table = 'variables'
        verbose_name = 'Variable'
        verbose_name_plural = 'Variables'

    def __str__(self):
        return self.name

class NaturalPhenomenasVariables(AuditCompleteModel):
    '''
        Modelo que representa la relación entre un fenómeno natural y una variable. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'natural_phenomenas_variables'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Fenómeno Natural - Variable'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Fenómenos Naturales - Variables'.
        
        `@str`: Devuelve el nombre de la relación como representación en cadena del objeto.
    '''
    natural_phenomena = models.ForeignKey(
        'NaturalPhenomenas', 
        on_delete=models.CASCADE, 
        related_name='natural_phenomenas_variables_natural_phenomena'
    )
    variable = models.ForeignKey(
        'Variables', 
        on_delete=models.CASCADE, 
        related_name='natural_phenomenas_variables_variable'
    )

    pk = models.CompositePrimaryKey('natural_phenomena', 'variable')
    
    class Meta():
        db_table = 'natural_phenomenas_variables'
        verbose_name = 'Fenómeno Natural - Variable'
        verbose_name_plural = 'Fenómenos Naturales - Variables'
        unique_together = ('natural_phenomena', 'variable')

    def __str__(self):
        return f"{self.natural_phenomena.name} - {self.variable.name}"

class Thresholds(AuditCompleteModel):
    '''
        Modelo que representa un umbral. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'thresholds'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Umbral'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Umbrales'.
        
        `@str`: Devuelve el nombre del umbral como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(null=True, blank=True)

    class Meta():
        db_table = 'thresholds'
        verbose_name = 'Umbral'
        verbose_name_plural = 'Umbrales'

    def __str__(self):
        return self.name

class ThresholdsNaturalPhenomenas(AuditCompleteModel):
    '''
        Modelo que representa la relación entre un umbral y un fenómeno natural. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'thresholds_natural_phenomenas'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Umbral - Fenómeno Natural'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Umbrales - Fenómenos Naturales'.
        
        `@str`: Devuelve el nombre de la relación como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    threshold = models.ForeignKey(
        'Thresholds', 
        on_delete=models.CASCADE, 
        related_name='thresholds_natural_phenomenas_threshold'
    )

    natural_phenomena = models.ForeignKey(
        'NaturalPhenomenas', 
        on_delete=models.CASCADE, 
        related_name='thresholds_natural_phenomenas_natural_phenomena'
    )

    variable = models.ForeignKey(
        'Variables',
        on_delete=models.CASCADE,
        related_name='thresholds_natural_phenomenas_variable'
    )

    district = models.ForeignKey(
        'places.Districts',
        on_delete=models.CASCADE,
        related_name='thresholds_natural_phenomenas_district'
    )

    min_value = models.FloatField()
    max_value = models.FloatField()

    class Meta():
        db_table = 'thresholds_natural_phenomenas'
        verbose_name = 'Umbral - Fenómeno Natural'
        verbose_name_plural = 'Umbrales - Fenómenos Naturales'

    def __str__(self):
        return f"{self.threshold.name} - {self.natural_phenomena.name}"