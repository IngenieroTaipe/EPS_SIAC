##Constantes para el servicio ECMWFOpenDataService

# Formato Geodésico: [North, West, South, East] - Perú
PERU_BBOX = [
    0.5, -81.5, 
    -18.5, -68.5
]

# Parámetros del Modelo ECMWF Open Data
ECMWF_DEFAULT_MODEL = "ifs"
ECMWF_DEFAULT_RESOL = "0p25"
ECMWF_DEFAULT_SOURCE = ["ecmwf", "aws", "azure"]
ECMWF_NATIVE_STEP_INTERVAL_HOURS = 3


# Variable del fenómeno climático
ECMWF_PARAMETER = "tp" # Total Precipitation (m)

# Parámetros de control para la descarga
ECMWF_STREAM = "oper" # Operativo
ECMWF_TYPE = "fc" # Pronóstico (Forecast)