from django.contrib.gis.geos import Polygon
from places.models import District
from datetime import datetime
from django.conf import settings
from django.db import transaction
from rest_framework.exceptions import ValidationError
from ecmwf.opendata import Client

import os
import time
import numpy as np
import xarray as xr
import logging
import json

from core_predictive.models import EMCWFRequest

from core_predictive.constants import (
    PERU_BBOX, 
    ECMWF_DEFAULT_MODEL, 
    ECMWF_DEFAULT_RESOL,
    ECMWF_DEFAULT_SOURCE,
    ECMWF_PARAMETER,
    ECMWF_STREAM,
    ECMWF_TYPE,
)
from places.services import DistrictService


logger = logging.getLogger(__name__)

class ECMWFDataService:
    """
        Servicio de Ingesta y Geoprocesamiento de Pronósticos Operativos (ECMWF Open Data).
        Soporta los modelos IFS (Físico) y AIFS (Basado en Inteligencia Artificial).
        
        Alineado a las especificaciones oficiales de ECMWF Confluence:
        https://confluence.ecmwf.int/spaces/DAC/pages/272310539/
        https://confluence.ecmwf.int/spaces/DAC/pages/272310539/ECMWF+open+data+real-time+forecasts+from+IFS+and+AIFS 

        Página de archivos a descargar:
        - https://data.ecmwf.int/forecasts/20260726/00z/ifs/0p25/oper/
    """

    def __init__(self, 
        model: str = ECMWF_DEFAULT_MODEL, 
        resol: str = ECMWF_DEFAULT_RESOL, 
        sources: list[str] = ECMWF_DEFAULT_SOURCE
    ):
        """
            Inicializa el cliente de ECMWF Open Data.
            
            `@param model:` 'ifs' (Modelo HRES operacional) o 'aifs-single' (Modelo AIFS de IA) - Se utiliza el modelo debido a su capacidad de predicción cada hora
            `@param resol:` Resolución espacial ('0p25' por defecto)
            `@param source:` Fuente de datos ('ecmwf' o 'cds' o 'aws' o 'azure')
        """
        if model != "ifs":
            raise ValidationError("La extracción con resolución horaria de 1h requiere el modelo físico 'ifs'.")

        self.model = model
        self.resol = resol
        self.sources = sources

        self.grib2_storage_dir = self.__create_storage_path('grib2')
        self.geojson_storage_dir = self.__create_storage_path('geojson')

    def __create_storage_path(
        self,
        resource_type: str
    ) -> str:
        """
        Crea el directorio de almacenamiento para los archivos grib2 y geojson si no existe.
        """
        now = datetime.now()
        sub_dir = os.path.join(
            getattr(settings, 'ECMWF_STORAGE_DIR', '/app/storage'),
            resource_type,
            now.strftime('%Y'),
            now.strftime('%m'),
            now.strftime('%d')
        )
        os.makedirs(sub_dir, exist_ok=True)

        return sub_dir

    def execute_download_grib2(
        self, 
        request_code: str,
        total_hours: int = 48, 
    ) -> dict[str, str | None]:
        """
            Ejecuta la descarga del binario GRIB2 desde ECMWF Open Data y extrae 
            las series temporales de precipitación (mm) para el área o punto de interés.
            
            `@param total_hours:` Horas totales a evaluar (default: 168)
            `@return:` Diccionario con la serie temporal procesada e información del raster
        """
        if total_hours > 90:
            raise ValidationError("La cantidad de horas totales excede el máximo permitido por el modelo IFS de ECMWF Open Data.")

        # === Rango de saltos del modelo ===
        steps = list(range(0, total_hours + 1, 3))
        
        # === Definición de fechas y horas de ejecución ===
        datetime_config = [
            {"date": 0, "time": 12},   # Ejecución hoy 12Z
            {"date": 0, "time": 0},    # Ejecución hoy 00Z
            {"date": -1, "time": 12},  # Ejecución ayer 12Z
            {"date": -1, "time": 0},   # Ejecución ayer 00Z
        ]
        
        output_grib = None
        download_success = False

        tag = f"request_{request_code}"

        # === Solicitud al servicio ECMWF Open Data ===
        for dt_cfg in datetime_config:
            # === Recorremos las fuentes de datos disponibles (Revisar: constants.py) ===
            for src in self.sources:
                client = Client(source=src, model=self.model, resol=self.resol)
                
                # === Payload (Información técnica del modelo) de la solicitud ===
                request_payload = {
                    "stream": ECMWF_STREAM,
                    "type": ECMWF_TYPE,
                    "param": ECMWF_PARAMETER,
                    "date": dt_cfg["date"],  
                    "time": dt_cfg["time"],            
                    "step": steps
                }
                
                # === Nombre del archivo ===
                file_name = f"ecmwf_{self.model}_tp_{tag}_date{dt_cfg['date']}_time{dt_cfg['time']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.grib2"

                # === Ruta de almacenamiento local ===
                output_grib = os.path.join(self.grib2_storage_dir, file_name)

                # === Solicitud al servicio ECMWF Open Data ===
                try:
                    logger.info(f"[ECMWF] Solicitando datos desde'{src}' (date={dt_cfg['date']}, time={dt_cfg['time']}, step={steps})...")

                    client.retrieve(request=request_payload, target=output_grib)

                    # === Validación ===
                    if os.path.exists(output_grib) and os.path.getsize(output_grib) > 0:
                        logger.info(f"[ECMWF I/O] Descarga exitosa guardada en: {output_grib}")
                        download_success = True
                        break

                except Exception as e:
                    logger.warning(f"[ECMWF Aviso] La ejecución con date={dt_cfg['date']} no está lista o falló (HTTP 404). Reintentando... {str(e)}")
                    if os.path.exists(output_grib):
                        os.remove(output_grib)

        if not download_success:
            raise ValidationError("No fue posible obtener el archivo GRIB2 en la ejecución actual o la ejecución anterior en ECMWF.")

        return {
            "file_path": output_grib,
            "file_name": os.path.basename(output_grib) if output_grib else None
        }

    def process_grib2_to_geojson(
        self,
        grib_path: str
    ) -> dict[str, str | None]:
        """
            El método nos permite convertir el binario GRIB2 a una FeatureCollection
            GeoJSON (EPSG:4326) representando cada celda ráster como un polígono.
        """
        if not os.path.exists(grib_path):
            raise ValidationError(f"El archivo GRIB2 no existe en la ruta especificada: {grib_path}")

        try:
            # === Apertura del archivo GRIB2 ===
            with xr.open_dataset(grib_path, engine="cfgrib") as ds:
                # === Conversión de coordenadas longitude a rango [-180, 180] ===
                ds = ds.assign_coords(longitude=(((ds.longitude + 180) % 360) - 180))
                ds = ds.sortby("longitude")

                # === Rebanado espacial de la matriz con xarray (Limitado a Perú) ===
                north, west, south, east = PERU_BBOX[0], PERU_BBOX[1], PERU_BBOX[2], PERU_BBOX[3]
                lat_slice = slice(north, south) if ds.latitude[0] > ds.latitude[-1] else slice(south, north)
                lon_slice = slice(west, east)

                ds_cropped = ds.sel(latitude=lat_slice, longitude=lon_slice)

                # === Verificación de que el rebanado se realizó correctamente ===
                if ds_cropped.dims["latitude"] == 0 or ds_cropped.dims["longitude"] == 0:
                    raise ValidationError("El rebanado espacial no se realizó correctamente. No se encontraron celdas cubiertas por Perú.")
                
                # === Conversión de milímetros ===
                tp_accum_mm = ds_cropped["tp"] * 1000.0 
                
                # === Desacumulación incremental entre pasos de 3 horas ===
                tp_diff = tp_accum_mm.diff(dim="step", label="upper") 
                
                # === Concatenación del primer paso con la diferencia ===
                # first_step = tp_accum_mm.islice(step=0)
                first_step = tp_accum_mm.isel(step=0)
                tp_incremental_3h = xr.concat([first_step, tp_diff], dim="step")
                
                # === Conversión a tasa de intensidad promedio horaria (mm/h) ===
                tp_rate_mm_h = tp_incremental_3h / 3.0 

                # === Coordenadas geodésicas (WGS84) ===
                lats = tp_rate_mm_h.latitude.values 
                
                # === Normalización de longitudes hacia WGS 4326 (ECMWF usa 0 a 360, pero el estándar WGS 4326 utiliza -180 a 180) ===
                lons = tp_rate_mm_h.longitude.values
                lons_normalized = np.where(lons > 180, lons - 360, lons) 

                # === Resolución espacial para cálculo del Bounding Box del polígono ===
                res_deg = 0.25 # Resolución espacial
                half_res = res_deg / 2.0 # Apotema de 0.125 grados

                # === Construcción de marcas de tiempo absolutas (UTC) ===
                run_time = ds.time.values.astype('M8[ms]').astype(datetime)
                step_hours = [int(s / np.timedelta64(1, 'h')) for s in tp_rate_mm_h.step.values]
                
                # === Formato de marcas de tiempo ===
                timestamps = [(run_time + np.timedelta64(h, 'h')).strftime("%Y-%m-%d %H:00 UTC") for h in step_hours]

                features = []

                # === Geoprocesamiento Vectorial: Construcción Batch de Celdas Poligonales ===
                for i, lat in enumerate(lats):
                    for j, lon in enumerate(lons_normalized):
                        series_vals = tp_rate_mm_h.values[:, i, j]
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
                                "timestamps": timestamps,
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

    def save_geojson_to_disk(self, geojson_data: dict, grib_path: str) -> dict[str, str]:
        """
            Escribe la estructura GeoJSON final (ya enriquecida) en el sistema de archivos.
        """
        base_name = os.path.basename(grib_path)
        json_file_name = base_name.replace(".grib2", ".geojson")
        output_geojson_path = os.path.join(self.geojson_storage_dir, json_file_name)
        
        with open(output_geojson_path, 'w', encoding='utf-8') as f:
            json.dump(geojson_data, f, ensure_ascii=False)
        
        logger.info(f"[ECMWF I/O] GeoJSON persistido exitosamente en: {output_geojson_path}")

        return {
            'file_name': json_file_name,
            'file_path': output_geojson_path,
        }

    def is_run_already_processed(self, date_offset: str, run_time: str) -> bool:
        """
            Verifica en la BD si la corrida (Fecha + Hora UTC) ya fue descargada y procesada
            exitosamente en la tabla EMCWFRequest para evitar I/O redundante.
        """
        
        search_pattern = f"date{date_offset}_time{run_time}"
        
        return EMCWFRequest.objects.filter(
            file_name__contains=search_pattern,
            status="COMPLETED"
        ).exists()

class ECMWFIntersectionService:
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
                        "district_id": dist_data.id,
                        "district_name": dist_data.name,
                        "ubigeo": dist_data.ubigeo,
                        "thresholds": dist_data.thresholds
                    })

            feature_properties = feature.get("properties", {})
            feature_properties["intersected_districts"] = intersected_districts if intersected_districts else []
            feature["properties"] = feature_properties

            enriched_features.append(feature)

        logger.info("[Spatial Intersect] Intersección vectorial completada con éxito.")
        return enriched_features

class ECMWFRequestService:
    """
        Servicio de Orquestación y Persistencia en BD:
        Vincular la entidad PostGIS EMCWFRequest con los métodos I/O y de geoprocesamiento
        de ECMWFOpenDataService.
    """

    def __init__(self, ecmwf_request_instance: EMCWFRequest):
        """
        Inicializa el orquestador vinculando una instancia de la BD.
        `@param ecmwf_request_instance:` Registro del modelo EMCWFRequest (PostGIS)
        """
        self.request_obj = ecmwf_request_instance
        self.data_service = ECMWFDataService()

    def process_request(self, total_hours: int = 48) -> dict:
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
            raise ValidationError("La instancia de EMCWFRequest debe estar previamente registrada en la BD.")

        # === Establecemos el Request en PROCESSING ===
        self.request_obj.status = "PROCESSING"
        self.request_obj.save(update_fields=['status'])

        start_time = time.time()

        try:
            # === Ejecutamos la descarga desde ECMWFOpenDataService === 
            logger.info(f"[Orquestador BD] Iniciando ingesta I/O para Request Code: {self.request_obj.request_code}")

            download_result = self.data_service.execute_download_grib2(
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
            geojson_result = self.data_service.process_grib2_to_geojson(grib_path=file_path)
            
            # === Intersección Espacial Topológica contra PostGIS ===
            logger.info(f"[Orquestador BD] Intersectando celdas con la base de datos de distritos...")
            geojson_result["features"] = ECMWFIntersectionService.map_grid_cells_to_districts(
                geojson_features=geojson_result.get("features", [])
            )
            
            # === Guardamos el GeoJSON final en disco ===
            geojson_storage_result = self.data_service.save_geojson_to_disk(
                geojson_data=geojson_result,
                grib_path=file_path
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