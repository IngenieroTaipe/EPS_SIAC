# ===================================
## Constantes para el servicio GFS NOOA AWS S3
# ===================================

# Formato Geodésico: [North, West, South, East] - Perú
PERU_BBOX = [
    0.5, -81.5, 
    -18.5, -68.5
]

# Representa la resolución del modelo GFS en grados
GFS_DEFAULT_RESOL = "0p25"

# URL base del bucket de AWS S3 donde se encuentran los archivos GFS
GFS_AWS_S3_BASE_URL = "https://noaa-gfs-bdp-pds.s3.amazonaws.com"

# Horas de ejecución nominales del modelo GFS (UTC) (El modelo incluye estas 4 ejecuciones diarias)
GFS_RUN_HOURS = [
    0, 
    6, 
    12, 
    18
]

# Número máximo de horas de pronóstico a descargar (por defecto 12 horas con paso de 1 hora)
    # Esto equivale a 12 archivos .grib2 (f001 a f012)
# === TODO / FUTURE-PROOFING: Ampliar horizonte futuro a 16h ===
# Para garantizar 6h mínimo de horizonte futuro (peor caso del peor caso con C=+4h),
# cambiar esto a `16`. NOAA publica f016 en el mismo tandeo que f012 (misma latencia ~3h36min),
# no añade riesgo. En ese caso, actualizar también:
#   1. backend/core_predictive/utils/geojson_builder.py:
#        - `BETWEEN 1 AND 12` (latest_slice) → `BETWEEN 1 AND 16`
#        - `'window_duration_hours': 18` → `'window_duration_hours': 22`
#   2. backend/core_predictive/views.py (opcional cosmético):
#        - url_path='window-18h' → 'window-22h' (rompería el frontend, dejar como está)
#   3. frontend/src/features/mapa/timeline/types.ts, PrecipitationTimelineProvider.tsx:
#        - comentarios "ventana 18h" → "ventana 22h" (cosmético)
GFS_TOTAL_HOURS_FORECAST = 16
GFS_TOTAL_HOURS_HISTORIC = 6

MIN_THRESHOLD_MM_H = 0.1

# Resolución nativa del modelo GFS en grados
GFS_NATIVE_GRID_RES = 0.25

# Resolución objetivo del raster interpolado en grados
TARGET_GRID_RES = 0.10

# ===================================
## Constantes para el servicio ClusterService
# ===================================

# Tolerancia de proximidad espacial (eps = 0.15 grados ~ 15km)
DBSCAN_EPS_DEGREES = 0.15
# Número mínimo de celdas para formar un clúster
MIN_CELLS_PER_CLUSTER = 2


# Intensidad mínima para participar en el análisis
MIN_ACTIVE_INTENSITY = 0.1

# Distancia usada para determinar vecinos.
# Debe ajustarse según la separación real de la grilla GFS.
LOCAL_MORAN_NEIGHBOR_DISTANCE = 0.36

# ===================================
# CONSTANTES PARA LA LIMPIEZA AUTÓNOMA DE LA BASE DE DATOS
# ===================================
ACTIVE_CELLS_RETENTION_DAYS = 1
CLUSTER_SNAPSHOTS_RETENTION_DAYS = 7