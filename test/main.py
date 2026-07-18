import cdsapi
import xarray as xr

# 1. Inicializar el cliente de la API
c = cdsapi.Client(
    url="https://api.ecmwf.int/v1",
    key="421a5cb968c9e895e6b37000f6a8ee2f"
)

# 2. Definir la petición (Ejemplo: Datos de reanálisis ERA5 de temperatura a 2m)
# Optimizamos filtrando solo el año más reciente y un área específica (BBox) si es necesario.
try:
    print("Iniciando la descarga desde ECMWF CDS API...")
    c.retrieve(
        'reanalysis-era5-single-levels',
        {
            'product_type': 'reanalysis',
            'format': 'netcdf', # Formato raster geoespacial nativo
            'variable': '2m_temperature',
            'year': '2025',
            'month': '01',
            'day': '01',
            'time': [
                '00:00', '06:00', '12:00', '18:00',
            ],
            # Área de interés [Norte, Oeste, Sur, Este] (Ejemplo: Sudamérica central)
            'area': [10, -80, -40, -35], 
        },
        'ecmwf_era5_data.nc' # Archivo de salida
    )
    print("Descarga completada con éxito.")

except Exception as e:
    print(f"Error de Entorno/Conexión: {e}")

# --- 3. Lectura e Inspección de la Información Devuelta ---
print("\n--- Inspeccionando el Dataset Devuelto ---")
try:
    # Usamos xarray, la herramienta estándar para manejar arreglos multidimensionales
    ds = xr.open_dataset('ecmwf_era5_data.nc')
    
    # Mostrar la estructura del objeto devuelto
    print(ds)
    
except FileNotFoundError:
    print("Error de Geoprocesamiento: No se encontró el archivo descargado.")