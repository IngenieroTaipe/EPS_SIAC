import cdsapi
import os
from django.conf import settings

class ECMWFService:
    def __init__(self):
        
        # --- Iniciar el cliente ---
        self.client = cdsapi.Client(
            url=settings.ECMWF_URL,
            key=settings.ECMWF_KEY
            # quiet=True # Desactiva logs excesivos en consola de producción
        )

    def obtain_wheather_forecast(self, latitud, longitud):
        """
            Solicita datos de precipitación total (Total Precipitation) al ECMWF.
            Filtra geográficamente mediante una caja delimitadora (Bounding Box) 
            alrededor de las coordenadas de la infraestructura sanitaria.
        """
        # Definimos un pequeño margen de análisis espacial alrededor del punto crítico (ej. Pichanaqui)
        delta = 0.1 
        north = latitud + delta
        south = latitud - delta
        east = longitud + delta
        west = longitud - delta

        # Nombre del archivo temporal de descarga (Formato estructurado GRIB o NetCDF)
        output_path = os.path.join('/tmp', f"forecast_{latitud}_{longitud}.nc")

        try:
            # Petición formal a la API según la documentación de Copernicus (ECMWF)
            self.client.retrieve(
                'reanalysis-era5-single-levels', # Set de datos meteorológicos de alta resolución
                {
                    'product_type': 'reanalysis',
                    'format' : 'netcdf',
                    'variable': 'total_precipitation', # Variable clave solicitada
                    'year': '2026',
                    'month': '07',
                    'day': '11',
                    'time': [
                        '00:00', '03:00', '06:00',
                        '09:00', '12:00', '15:00',
                        '18:00', '21:00',
                    ],
                    'format': 'netcdf',
                    'area': [
                        north, west, 
                        south, east
                    ], # Formato: [North, West, South, East]
                },
                output_path
            )
            return output_path
            
        except Exception as e:
            # Principio SRE: Registro y mitigación de fallas externas (Circuit Breaker implícito)
            print(f"[ERROR] Falló la conexión con la API externa de ECMWF: {str(e)}")
            return None