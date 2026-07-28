from django.conf import settings
from django.contrib.gis.geos import Polygon
from datetime import datetime, timedelta
from django.db import transaction
from rest_framework.exceptions import ValidationError
from herbie import Herbie
from herbie import FastHerbie

import os
import time
import numpy as np
import xarray as xr
import requests
import logging
import json
import zoneinfo

from core_predictive.models import GFSRequest

from core_predictive.constants import (
    PERU_BBOX, 
    GFS_DEFAULT_RESOL,
    GFS_RUN_HOURS,
    GFS_TOTAL_HOURS_FORECAST,
    LIMA_TZ
)
from places.services import DistrictService
from components.services import ComponentService


logger = logging.getLogger(__name__)

class StorageService:
    def create_storage_path(self, resource_type: str) -> str:
        """
        Crea el directorio de almacenamiento para los archivos grib2 y geojson.
        """
        now = datetime.now()
        sub_dir = os.path.join(
            getattr(settings, 'GFS_STORAGE_DIR', '/app/storage'),
            resource_type,
            now.strftime('%Y'),
            now.strftime('%m'),
            now.strftime('%d')
        )
        os.makedirs(sub_dir, exist_ok=True)
        return sub_dir

class GFSDataService(StorageService):
    """
        Servicio de Ingesta y Geoprocesamiento de Pronósticos Operativos de la NOAA (GFS Global Forecast System).
        
        Descarga directamente desde el bucket público de AWS S3 Open Data sin requerir claves API.
        Soporta resoluciones temporales EXACTAS DE 1 HORA (pasos f001 a f048/f120).
        
        Documentación oficial NOAA GFS en AWS:
        - https://registry.opendata.aws/noaa-gfs-bdp-pds/

        A su vez, al acceder al bucket de AWS CLI (mostrada en la documentación anterior), encontraremos la siguiente info:
        - https://noaa-gfs-bdp-pds.s3.amazonaws.com/index.html

        Aquí, podemos buscar los archivos mediante "gfs.{YEAR}{MONTH}" == gfs.202607 (a la fecha en la que realizamos la ingesta)
    """

    def __init__(self, resol: str = GFS_DEFAULT_RESOL):
        """
            Inicializa el cliente de NOAA GFS.
            `@param resol` Resolución espacial ('0p25' por defecto)
        """
        self.resol = resol
        self.grib2_storage_dir = self.create_storage_path('grib2')

    def is_data_already_processed(self, request_code: str) -> bool:
        """
            Verifica en la BD si la corrida (Fecha + Hora UTC) ya fue descargada y procesada
            exitosamente en la tabla GFSRequest para evitar I/O redundante.
        """
        return GFSRequest.objects.filter(
            request_code=request_code,
            status="COMPLETED"
        ).exists()

    def execute_download_data(
        self, 
        request_code: str,
        total_hours: int = GFS_TOTAL_HOURS_FORECAST, 
    ) -> dict[str, str | None]:
        """
        Ejecuta la descarga en BATCH del binario GRIB2 desde AWS S3 (NOAA GFS) con paso horaria de 1 HORA.
        Ensambla los archivos individuales f001..f048 en un único binario local para análisis vectorial PostGIS.
        
        `@param request_code:` Código único trazable del Job
        `@param total_hours:` Horas totales a evaluar (paso de 1 hora, max 120h)
        `@return:` Diccionario con la ruta del archivo GRIB2 ensamblado
        """
        if total_hours > 120:
            raise ValidationError("La cantidad de horas totales excede el máximo permitido para paso de 1 hora en GFS (120h).")

        # === Matriz de prioridades de ejecución (Hora UTC) ===
        # Revisa ejecuciones nominales 12Z y 00Z de hoy y ayer
        now_utc = datetime.utcnow()
        datetime_config = [
            {"date_offset": 0, "time": GFS_RUN_HOURS[3] },   # 18Z
            {"date_offset": 0, "time": GFS_RUN_HOURS[2] },   # 12Z
            {"date_offset": 0, "time": GFS_RUN_HOURS[1] },    # 06Z
            {"date_offset": 0, "time": GFS_RUN_HOURS[0] },    # 00Z
            {"date_offset": -1, "time": GFS_RUN_HOURS[3] },   # 18Z
            {"date_offset": -1, "time": GFS_RUN_HOURS[2] },   # 12Z
            {"date_offset": -1, "time": GFS_RUN_HOURS[1] },    # 06Z
            {"date_offset": -1, "time": GFS_RUN_HOURS[0] },    # 00Z
        ]

        tag = f"request_{request_code}"
        output_file = None
        download_success = False

        # === Itera sobre las fechas de ejecución nominales (00Z y 12Z) ===
        for dt_cfg in datetime_config:
            run_datetime = (
                now_utc + timedelta(days=dt_cfg["date_offset"])
            ).replace(
                hour=dt_cfg["time"],
                minute=0,
                second=0,
                microsecond=0,
            )

            if run_datetime > now_utc:
                logger.debug(f"⏭Omitiendo corrida futura: {run_datetime.strftime('%Y-%m-%d %H:%MZ')}")
                continue

            herbie_date_str = run_datetime.strftime('%Y-%m-%d %H:00')
            run_date = run_datetime.strftime('%Y%m%d')
            run_hour = f"{dt_cfg['time']:02d}"

            logger.info(f"[NOAA GFS] Intentando descargar ejecución {run_date} {run_hour}Z para {total_hours}h con paso de 1 HORA...")

            # === Intenta descargar los N pasos de 1 hora (f001 a f048) ===
            try:
                # ----------------------------------------------------------
                # Verificar que exista el último forecast hour
                # ----------------------------------------------------------
                h_check = Herbie(
                    herbie_date_str,
                    model="gfs",
                    product=f"pgrb2.{self.resol}",
                    fxx=total_hours,
                    priority=['aws']
                )

                # Búsqueda por patrón Regex de la variable de precipitación en el índice (.idx)
                idx_df = h_check.inventory(search=":APCP:surface:")
                
                #----------------------------------------------------------
                # Validar que el último paso de pronóstico exista
                #----------------------------------------------------------
                if idx_df.empty:
                    logger.warning(f" La ejecución {run_date} {run_hour} aún no se encuentra disponible.")
                    continue

                logger.info(f"[Byte-Range BATCH] Descargando {total_hours} pasos temporales (Solo variable APCP sobre Perú)...")
                
                #----------------------------------------------------------
                # Crear objeto FastHerbie con parámetros específicos
                #----------------------------------------------------------
                FH = FastHerbie(
                    DATES=[herbie_date_str],
                    model="gfs",
                    product=f"pgrb2.{self.resol}",
                    fxx=range(1,total_hours + 1),
                    priority=['aws']
                )

                # xarray() con parámetro searchString ejecuta la petición HTTP Range por la variable especificada
                local_files = FH.download(
                    search=":APCP:surface:"
                )
                
                datasets = []

                #----------------------------------------------------------
                # Descargar y procesar cada paso de pronóstico
                #----------------------------------------------------------
                for step, file in enumerate(local_files, start=1):
                    ds_step = xr.open_dataset(
                        file,
                        engine="cfgrib"
                    )
                    
                    # ----------------------------
                    # Normalizar longitudes
                    # ----------------------------
                    ds_step = ds_step.assign_coords(
                        longitude=((ds_step.longitude + 180) % 360) - 180
                    )
                    ds_step = ds_step.sortby("longitude")

                    north, west, south, east = PERU_BBOX

                    lat_slice = (
                        slice(north, south)
                        if ds_step.latitude.values[0] > ds_step.latitude.values[-1]
                        else slice(south, north)
                    )

                    lon_slice = slice(west, east)

                    ds_step = ds_step.sel(
                        latitude=lat_slice,
                        longitude=lon_slice,
                    )

                    ds_step = ds_step.expand_dims(step=[step])

                    datasets.append(ds_step.load())
                    ds_step.close()

                # ----------------------------------------------------------
                # Concatenar los datasets
                # ----------------------------------------------------------
                ds_final = xr.concat(
                    datasets,
                    dim="step",
                    combine_attrs="override",
                )

                ds_final = ds_final.transpose(
                    "step",
                    "latitude",
                    "longitude",
                )

                # ----------------------------------------------------------
                # Construir nombre y ruta del archivo GRIB2 ensamblado
                # ----------------------------------------------------------
                file_name = f"gfs_{self.resol}_tp_{tag}_date_{run_date}_time_{run_hour}Z_{datetime.now().strftime('%Y%m%d_%H%M%S')}.nc"
                output_file = os.path.join(self.grib2_storage_dir, file_name)
                
                encoding = {
                    var: {
                        "zlib": True,
                        "complevel": 5,
                    }
                    for var in ds_final.data_vars
                }

                ds_final.to_netcdf(
                    output_file,
                    encoding=encoding,
                )

                ds_final.close()

                logger.info(
                    f"Archivo generado correctamente: {output_file}"
                )

                download_success = True
                break
            
            except Exception as e:
                logger.warning(f"[NOAA GFS Aviso] Ejecución {run_date} {run_hour}Z incompleta o no lista en AWS S3. {str(e)}")
                if output_file and os.path.exists(output_file):
                    os.remove(output_file)  # Limpia el binario parcial ante fallos

        if not download_success:
            raise ValidationError(f"No fue posible obtener el paquete completo de {total_hours} horas del modelo NOAA GFS desde AWS S3.")

        return {
            "file_path": output_file,
            "file_name": os.path.basename(output_file) if output_file else None
        }

class GribFileToGeoJSONService(StorageService):
    def __init__(self):
        self.geojson_storage_dir = self.create_storage_path('geojson')
    
    def process_grib2_to_geojson(
        self,
        file_path: str,
        smooth_raster: bool = True
    ) -> dict[str, str | None]:
        """
            El método nos permite convertir el binario .nc (NetCDF) y .grib2 (GRIB2)
            a una FeatureCollection GeoJSON (EPSG:4326) representando cada celda ráster como un polígono.
        """
        if not os.path.exists(file_path):
            raise ValidationError(f"El archivo GRIB2 no existe en la ruta especificada: {file_path}")

        try:
            is_netcdf = file_path.endswith('.nc')
            engine = "netcdf4" if is_netcdf else "cfgrib"
            backend_kwargs = {} if is_netcdf else {'filter_by_keys': {'typeOfLevel': 'surface'}}

            # === Apertura del archivo GRIB2 ===
            with xr.open_dataset(
                file_path,
                engine=engine,
                backend_kwargs=backend_kwargs,
            ) as ds:

                # === Conversión de coordenadas longitude a rango [-180, 180] ===
                if 'longitude' in ds.coords:
                    ds = ds.assign_coords(longitude=(((ds.longitude + 180) % 360) - 180))
                    ds = ds.sortby("longitude")

                # === Rebanado espacial de la matriz con xarray (Limitado a Perú) ===
                north, west, south, east = PERU_BBOX[0], PERU_BBOX[1], PERU_BBOX[2], PERU_BBOX[3]
                lat_slice = slice(north, south) if ds.latitude[0] > ds.latitude[-1] else slice(south, north)
                lon_slice = slice(west, east)

                ds_cropped = ds.sel(latitude=lat_slice, longitude=lon_slice)

                # === Verificación de que el rebanado se realizó correctamente ===
                if ds_cropped.sizes["latitude"] == 0 or ds_cropped.sizes["longitude"] == 0:
                    raise ValidationError("El rebanado espacial no se realizó correctamente. No se encontraron celdas cubiertas por Perú.")
                
                # === Extracción de la variable de precipitación (apcp en GFS) ===
                # En GFS, 'apcp' ya viene expresado en kg/m² = mm (Paso de 1 hora)
                if "apcp" in ds_cropped:
                    tp_rate_mm_h = ds_cropped["apcp"]
                elif "tp" in ds_cropped:
                    tp_rate_mm_h = ds_cropped["tp"]
                else:
                    raise KeyError("No se encontró la variable de precipitación ('apcp' o 'tp') en el archivo GRIB2.")
                
                # === Resolución espacial para cálculo del Bounding Box del polígono ===
                res_deg = 0.25 # Resolución espacial

                if smooth_raster:
                    # Incrementa la densidad de la malla por un factor de 2.5x (de 0.25° a 0.10°)
                    res_deg = 0.10
                    new_lats = np.arange(ds_cropped.latitude.max().item(), ds_cropped.latitude.min().item(), -res_deg)
                    new_lons = np.arange(ds_cropped.longitude.min().item(), ds_cropped.longitude.max().item(), res_deg)
                    
                    # Interpolación bilineal/cúbica que suaviza la gradiente espacial
                    tp_rate_mm_h = tp_rate_mm_h.interp(latitude=new_lats, longitude=new_lons, method="linear")

                half_res = res_deg / 2.0 # Apotema de 0.125 grados

                # === Coordenadas Geodésicas ===
                lats = tp_rate_mm_h.latitude.values
                lons = tp_rate_mm_h.longitude.values
                lons_normalized = np.where(lons > 180, lons - 360, lons)

                timestamps_per = []
                # === Construcción de Marcas de Tiempo Horarias ===
                if "valid_time" in tp_rate_mm_h.coords:
                    time_vals = tp_rate_mm_h.valid_time.values

                    for t in time_vals:
                        # Convertir numpy datetime64 a datetime nativo en UTC
                        dt_utc = datetime.fromtimestamp(t.astype('M8[s]').astype('int'), tz=zoneinfo.ZoneInfo("UTC"))
                        
                        # Transformación de zona horaria a Perú (UTC-5)
                        dt_pet = dt_utc.astimezone(LIMA_TZ)
                        timestamps_per.append(dt_pet.strftime("%Y-%m-%d %H:00 PET"))
                else:
                    # === Construcción de Marcas de Tiempo (Fallback) ===
                    run_time = ds.time.values.astype('M8[ms]').astype(datetime)
                    step_hours = [int(s / np.timedelta64(1, 'h')) for s in tp_rate_mm_h.step.values]
                    
                    for h in step_hours:
                        dt_utc = run_time + np.timedelta64(h, 'h')
                        dt_pet = dt_utc.astimezone(LIMA_TZ)
                        timestamps_per.append(dt_pet.strftime("%Y-%m-%d %H:00 PET"))

                # === Normalización Matricial en BATCH ===
                # Asegura la ordenación dimensional (pasos_horarios, latitud, longitud)
                time_dim = "step" if "step" in tp_rate_mm_h.dims else "valid_time"
                tp_rate_mm_h = tp_rate_mm_h.transpose(time_dim, "latitude", "longitude")
                
                data_matrix = tp_rate_mm_h.values
                num_lats = len(lats)
                num_lons = len(lons_normalized)

                features = []
                
                # === Geoprocesamiento Vectorial: Construcción Batch de Celdas Poligonales ===
                for i in range(num_lats):
                    lat = lats[i]

                    for j in range(num_lons):
                        lon = lons_normalized[j]

                        series_vals = data_matrix[:, i, j]  
                        cleaned_series = [max(0.0, round(float(v), 2)) for v in series_vals]

                        # === Vértices geodésicos ===
                        min_x = round(float(lon - half_res), 4)
                        max_x = round(float(lon + half_res), 4)
                        min_y = round(float(lat - half_res), 4)
                        max_y = round(float(lat + half_res), 4)

                        # === Polígono (sentido antihorario, cierre RFC 7946) ===
                        polygon_coordinates = [[
                            [min_x, min_y],
                            [max_x, min_y],
                            [max_x, max_y],
                            [min_x, max_y],
                            [min_x, min_y]
                        ]]

                        # === Estructura de la entidad geográfica (feature) ===
                        feature = {
                            "type": "Feature",
                            "geometry": {
                                "type": "Polygon",
                                "coordinates": polygon_coordinates
                            },
                            "properties": {
                                "timestamps": timestamps_per,
                                "intensity_mm_h": cleaned_series,
                                "accumulated_period_mm": round(float(sum(cleaned_series) * 3.0), 2),
                                "centroid": [round(float(lon), 4), round(float(lat), 4)]
                            }
                        }
                        features.append(feature)

                return {
                    "type": "FeatureCollection",
                    "crs": {
                        "type": "name",
                        "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}
                    },
                    "features": features
                }

        except Exception as e:
            logger.error(f"[ECMWF Error] Falló el geoprocesamiento del binario GRIB2 a GeoJSON: {str(e)}")
            raise ValidationError(f"Error en la conversión ráster a GeoJSON: {str(e)}") 

    def save_geojson_to_disk(self, geojson_data: dict, file_path: str) -> dict[str, str]:
        """
            Escribe la estructura GeoJSON final (ya enriquecida) en el sistema de archivos.
        """
        base_name = os.path.basename(file_path)
        for ext in ['.grib2', '.nc']:
            if base_name.endswith(ext):
                json_file_name = base_name.replace(ext, '.geojson')
                break
        output_geojson_path = os.path.join(self.geojson_storage_dir, json_file_name)
        
        with open(output_geojson_path, 'w', encoding='utf-8') as f:
            json.dump(geojson_data, f, ensure_ascii=False)
        
        logger.info(f"[ECMWF I/O] GeoJSON persistido exitosamente en: {output_geojson_path}")

        return {
            'file_name': json_file_name,
            'file_path': output_geojson_path,
        }

class GridIntersectionService:
    """
        Servicio de Integración y Geoprocesamiento Espacial.
        Sustituye la especificación manual de ID por intersección topológica automática (ST_Intersects)
        entre la malla de celdas de ECMWF y los MULTIPOLYGON de los distritos en PostGIS.
    """

    @staticmethod
    def map_grid_cells_to_districts(geojson_features: list) -> list:
        """
            Recibe la lista de Features (Polígonos de celda) generados desde el GRIB2,
            ejecuta la intersección espacial en batch contra PostGIS y enriquece cada Feature
            con los datos del distrito e información de umbrales intersectados.
        """
        if not geojson_features:
            return []

        logger.info(f"[Spatial Intersect] Ejecutando intersección para {len(geojson_features)} celdas contra PostGIS...")

        districts_thresholds = DistrictService.get_district_thresholds()

        enriched_features = []

        for feature in geojson_features:
            poly_coords = feature["geometry"]["coordinates"][0]
            cell_polygon = Polygon(poly_coords, srid=4326)
            cell_centroid = cell_polygon.centroid

            intersected_districts = []
            for dist_data in districts_thresholds:
                # Intersección espacial del centroide o del polígono completo
                if dist_data.geometry.intersects(cell_centroid) or dist_data.geometry.intersects(cell_polygon):
                    intersected_districts.append({
                        "district_name": dist_data.name,
                        "ubigeo": dist_data.ubigeo,
                        "thresholds": [{
                            # "natural_phenomena_name": relation.natural_phenomena.name,
                            "threshold_name": relation.threshold.name,
                            "min_value": relation.min_value,
                            "max_value": relation.max_value,
                        } for relation in dist_data.thresholds_district.all()]
                    })

            feature_properties = feature.get("properties", {})
            feature_properties["intersected_districts"] = intersected_districts if intersected_districts else []
            feature["properties"] = feature_properties

            enriched_features.append(feature)

        logger.info("[Spatial Intersect] Intersección vectorial completada con éxito.")
        return enriched_features

    def map_geojson_to_components(self, geojson_features: list):
        logger.info(f"[Spatial Intersect] Ejecutando intersección para {len(geojson_features)} celdas contra los componentes geográficos de la EPS Selva Central...")
        
        # components = ComponentService.get_all_components()

        # return geojson_intersected

class ForecastRainRequestService:
    """
        Servicio de Orquestación y Persistencia en BD:
        Vincular la entidad PostGIS GFSRequest con los métodos I/O y de geoprocesamiento
        de ECMWFOpenDataService.
    """

    def __init__(self, gfs_request_instance : GFSRequest):
        """
        Inicializa el orquestador vinculando una instancia de la BD.
        `@param gfs_request_instance:` Registro del modelo GFSRequest (PostGIS)
        """
        self.request_obj = gfs_request_instance
        self.data_service = GFSDataService()
        self.process_service = GribFileToGeoJSONService()

    def process_request(self, total_hours: int = GFS_TOTAL_HOURS_FORECAST) -> dict:
        """
        Ejecuta el ciclo de vida automático end-to-end:
            1. Transición de Estado BD -> PROCESSING.
            2. Ingesta I/O del binario GRIB2 (ECMWFOpenDataService).
            3. Cálculo de métricas I/O (Tamaño MB, Tiempo de descarga).
            4. Geoprocesamiento del GRIB2 a Polígonos de Celda GeoJSON (Opción A).
            5. Actualización transaccional en BD -> COMPLETED.
            6. Retorno de la carga útil para la respuesta del Backend.
        """
        if not self.request_obj or not self.request_obj.pk:
            raise ValidationError("La instancia de GFSRequest debe estar previamente registrada en la BD.")

        # === Establecemos el Request en PROCESSING ===
        self.request_obj.status = "PROCESSING"
        self.request_obj.save(update_fields=['status'])

        start_time = time.time()

        try:
            # === Ejecutamos la descarga desde ECMWFOpenDataService === 
            logger.info(f"[Orquestador BD] Iniciando ingesta I/O para Request Code: {self.request_obj.request_code}")

            download_result = self.data_service.execute_download_data(
                request_code=self.request_obj.request_code,
                total_hours=total_hours
            )

            # === Extracción de resultados de la descarga ===
            file_path = download_result["file_path"]
            file_name = download_result["file_name"]
            download_duration = round(time.time() - start_time, 2)

            # === Cálculo de tamaño del archivo en Megabytes (MB) === 
            file_size_bytes = os.path.getsize(file_path) if os.path.exists(file_path) else 0
            file_size_mb = round(file_size_bytes / (1024 * 1024), 2)

            # === Invocación al Método de Geoprocesamiento (Conversión a Polígonos GeoJSON) ===
            logger.info(f"[Orquestador BD] Procesando binario GRIB2 a Polígonos de Celda GeoJSON...")
            geojson_result = self.process_service.process_grib2_to_geojson(file_path=file_path)
            
            # === Intersección Espacial Topológica contra PostGIS ===
            logger.info(f"[Orquestador BD] Intersectando celdas con la base de datos de distritos...")
            geojson_result["features"] = GridIntersectionService.map_grid_cells_to_districts(
                geojson_features=geojson_result.get("features", [])
            )
            
            # === Guardamos el GeoJSON final en disco ===
            geojson_storage_result = self.process_service.save_geojson_to_disk(
                geojson_data=geojson_result,
                file_path=file_path
            )
            
            # === Actualización Transaccional en Base de Datos (PostGIS) === 
            with transaction.atomic():
                self.request_obj.status = "COMPLETED"
                self.request_obj.file_name = file_name
                self.request_obj.file_path = file_path
                self.request_obj.geojson_path = geojson_storage_result["file_path"]
                self.request_obj.file_size_mb = file_size_mb
                self.request_obj.download_time_seconds = download_duration
                self.request_obj.save()

            logger.info(f"[Orquestador BD] Solicitud {self.request_obj.request_code} COMPLETADA. ({file_size_mb} MB en {download_duration}s)")

            # 5. Estructura de salida consolidada
            return {
                "request_id": self.request_obj.id,
                "request_code": self.request_obj.request_code,
                "status": self.request_obj.status,
                "metrics": {
                    "file_name": file_name,
                    "file_path": file_path,
                    "file_size_mb": file_size_mb,
                    "download_time_seconds": download_duration,
                    "geojson_path": geojson_storage_result["file_path"]
                },
            }

        except Exception as e:
            # Captura de fallos y marcado de consistencia en BD
            error_msg = f"Error durante la ingesta y persistencia en BD: {str(e)}"
            logger.error(f"[Orquestador BD Error] Request {self.request_obj.request_code}: {error_msg}")
            
            self.request_obj.status = "FAILED"
            self.request_obj.save(update_fields=['status'])
            
            raise ValidationError(error_msg)