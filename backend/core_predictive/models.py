from django.contrib.gis.db import models
from core_shared.models import AuditCreateModel, AuditCompleteModel

from core_shared.validators import alpha_name_validator

class GFSRequest(AuditCompleteModel):
    '''
        Modelo que representa una solicitud de GFS. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'gfs_requests'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Solicitud GFS'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Solicitudes GFS'.
        
        `@str`: Devuelve el nombre de la solicitud como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    request_code = models.CharField(max_length=100, unique=True, verbose_name="Código de Solicitud")
    status = models.CharField(max_length=20, validators=[alpha_name_validator])
    target_variable = models.CharField(max_length=50, validators=[alpha_name_validator])
    date_range_start = models.DateTimeField(verbose_name="Inicio del Pronóstico (UTC)")
    date_range_end = models.DateTimeField(verbose_name="Fin del Pronóstico (UTC)")

    geom_bounds = models.PolygonField(srid=4326, verbose_name="Límite Geométrico WGS84 de la petición.")

    file_name = models.CharField(max_length=200, null=True, blank=True, verbose_name="Nombre del Archivo")
    file_path = models.CharField(max_length=200, null=True, blank=True, verbose_name="Ruta del Archivo grib2 o netcdf")
    file_size_mb = models.FloatField(null=True, blank=True, verbose_name="Tamaño del Archivo (MB)")
    download_time_seconds = models.FloatField(null=True, blank=True, verbose_name="Tiempo de Descarga (segundos)")
    
    class Meta():
        db_table = 'gfs_requests'
        verbose_name = 'Solicitud GFS'
        verbose_name_plural = 'Solicitudes GFS'

    def __str__(self):
        return self.request_code

class GFSActiveCell(AuditCreateModel):
    '''
        Modelo que representa una celda activa de GFS.
        Almacena directamente las celdas activas con precipitación (> 0.1 mm/h) (Recuerda que previamente cada elemento del geojson tenía asociado su propia serie de intensidades de precipitación)
        sin pasar por archivos GeoJSON estáticos en disco.
    '''
    gfs_request = models.ForeignKey(
        'GFSRequest',
        on_delete=models.CASCADE, 
        related_name='gfs_cells'
    )

    max_intensity_mm_h = models.FloatField(verbose_name="Intensidad Pico (mm/h)")
    intensity_series = models.JSONField(verbose_name="Serie Temporal Horaria [t1..t12]")
    timestamps = models.JSONField(null=True, blank=True, verbose_name="Marcas de Tiempo Horarias [t1..t12]")
    threshold_names = models.JSONField(null=True, blank=True, verbose_name="Nombres de Umbral [t1..t12]")

    geometry = models.PolygonField(srid=4326, spatial_index=True, verbose_name="Geometría Celda")

    class Meta:
        db_table = 'gfs_active_cells'
        verbose_name = 'Celda Activa GFS'
        verbose_name_plural = 'Celdas Activas GFS'
        indexes = [
            models.Index(fields=['gfs_request', 'max_intensity_mm_h']),
        ]

    def __str__(self):
        return f"Celda {self.id} - Solicitud: {self.gfs_request.request_code}"

class GFSClusterSnapshot(AuditCreateModel):
    """ 
        Entidad de Consolidación Espacio-Temporal (Etapa 2):
        Almacena los polígonos disueltos (ST_Union) de las manchas de lluvia 
        agrupadas por DBSCAN para cada hora del horizonte de pronóstico.

        Nota: El campo cluster_index es indispensable para identificar cada clúster. Si bien tendrá un id en la db, al momento de generarse los clústeres por medio de los servicios (y a partir de los cells) se generarán diversas versiones de los clústeres por cada step (paso horario), por lo que se necesita de un identificador adicional para saber que un mismo clúster (aunque variando a lo largo del tiempo), se trata del mismo en distintos steps.
    """
    # Django crea internamente el campo 'id' de forma automática
    gfs_request = models.ForeignKey(
        'GFSRequest', 
        on_delete=models.CASCADE, 
        related_name='clusters'
    )
    time_step = models.IntegerField(verbose_name="Paso Horario (1..12)")
    timestamp_str = models.CharField(max_length=50, verbose_name="Fecha/Hora Legible (UTC)")
    
    cluster_index = models.IntegerField(verbose_name="Índice de Clúster (DBSCAN ID)")
    total_cells = models.IntegerField(verbose_name="Cantidad de Celdas Agrupadas")
    max_intensity_mm_h = models.FloatField(verbose_name="Intensidad Máxima (mm/h)")
    avg_intensity_mm_h = models.FloatField(verbose_name="Intensidad Promedio (mm/h)")
    
    # Clasificación del Umbral de Peligro para este clúster
    threshold = models.ForeignKey(
        'Threshold', 
        on_delete=models.PROTECT,  # Impide borrar el umbral si está referenciado en un histórico
        null=True, 
        blank=True, 
        verbose_name="Umbral Asignado"
    )

    affected_ubigeos = models.JSONField(default=list, verbose_name="Lista de UBIGEOS Afectados")

    geometry = models.MultiPolygonField(srid=4326, spatial_index=True, verbose_name="Geometría Disuelta Clúster")

    class Meta:
        db_table = 'gfs_cluster_snapshots'
        ordering = ['time_step', 'cluster_index']
        indexes = [
            models.Index(fields=['gfs_request', 'time_step']),
        ]

class NaturalPhenomena(AuditCompleteModel):
    '''
        Modelo que representa un fenómeno natural. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'natural_phenomenas'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Fenómeno Natural'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Fenómenos Naturales'.
        
        `@str`: Devuelve el nombre del fenómeno natural como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    name = models.CharField(max_length=100, unique=True, validators=[alpha_name_validator])
    description = models.TextField(null=True, blank=True, validators=[alpha_name_validator])

    class Meta():
        db_table = 'natural_phenomenas'
        verbose_name = 'Fenómeno Natural'
        verbose_name_plural = 'Fenómenos Naturales'

    def __str__(self):
        return self.name

class VariableType(AuditCompleteModel):
    '''
        Modelo que representa un tipo de variable. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'variable_types'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Tipo de Variable'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Tipos de Variables'.
        
        `@str`: Devuelve el nombre del tipo de variable como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática
    name = models.CharField(max_length=100, unique=True, validators=[alpha_name_validator])
    description = models.TextField(null=True, blank=True, validators=[alpha_name_validator])

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
    name = models.CharField(max_length=100, unique=True, validators=[alpha_name_validator])
    description = models.TextField(null=True, blank=True, validators=[alpha_name_validator])

    class Meta():
        db_table = 'units_measurement'
        verbose_name = 'Unidad de Medida'
        verbose_name_plural = 'Unidades de Medida'

    def __str__(self):
        return self.name

class Variable(AuditCompleteModel):
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
        'VariableType', 
        on_delete=models.CASCADE, 
        related_name='variables_variable_type'
    )
    unit_measurement = models.ForeignKey(
        'UnitsMeasurement', 
        on_delete=models.CASCADE, 
        related_name='variables_unit_measurement'
    )
    name = models.CharField(max_length=100, unique=True, validators=[alpha_name_validator])
    description = models.TextField(null=True, blank=True, validators=[alpha_name_validator])

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
        'NaturalPhenomena', 
        on_delete=models.CASCADE, 
        related_name='natural_phenomenas_variables_natural_phenomena'
    )
    variable = models.ForeignKey(
        'Variable', 
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

class Threshold(AuditCompleteModel):
    '''
        Modelo que representa un umbral. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'thresholds'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Umbral'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Umbrales'.
        
        `@str`: Devuelve el nombre del umbral como representación en cadena del objeto.
    '''
    name = models.CharField(max_length=100, unique=True, validators=[alpha_name_validator])
    description = models.TextField(null=True, blank=True, validators=[alpha_name_validator])

    class Meta():
        db_table = 'thresholds'
        verbose_name = 'Umbral'
        verbose_name_plural = 'Umbrales'

    def __str__(self):
        return self.name

class ThresholdsNaturalPhenomena(AuditCompleteModel):
    '''
        Modelo que representa la relación entre un umbral y un fenómeno natural. Contiene un identificador único, un nombre y una descripción.

        `@extends AuditCompleteModel`: Hereda de AuditCompleteModel para incluir campos de fecha de creación, actualización y eliminación suave.

        `@db_table`: Define el nombre de la tabla en la base de datos como 'thresholds_natural_phenomenas'.

        `@verbose_name`: Define el nombre legible para el modelo como 'Umbral - Fenómeno Natural'.
        
        `@verbose_name_plural`: Define el nombre legible en plural para el modelo como 'Umbrales - Fenómenos Naturales'.
        
        `@str`: Devuelve el nombre de la relación como representación en cadena del objeto.
    '''
    # Django crea internamente el campo 'id' de forma automática

    natural_phenomena = models.ForeignKey(
        'NaturalPhenomena',
        on_delete=models.CASCADE,
        related_name='thresholds_natural_phenomena'
    )

    variable = models.ForeignKey(
        'Variable',
        on_delete=models.CASCADE,
        related_name='thresholds_variable'
    )

    threshold = models.ForeignKey(
        'Threshold',
        on_delete=models.CASCADE,
        related_name='thresholds_threshold'
    )

    district = models.ForeignKey(
        'places.District',
        on_delete=models.CASCADE,
        related_name='thresholds_district'
    )

    min_value = models.FloatField(null=True, blank=True)
    max_value = models.FloatField(null=True, blank=True)

    class Meta():
        db_table = 'thresholds_natural_phenomenas'
        verbose_name = 'Umbral - Fenómeno Natural'
        verbose_name_plural = 'Umbrales - Fenómenos Naturales'

    def __str__(self):
        return f"{self.threshold.name} - {self.natural_phenomena.name}"