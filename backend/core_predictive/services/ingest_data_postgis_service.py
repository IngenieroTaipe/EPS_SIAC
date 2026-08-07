import os
import logging
import numpy as np
# pyrefly: ignore [missing-import]
import xarray as xr
import zoneinfo
from datetime import datetime, timedelta

from typing import Dict, Any, List, Tuple
from django.db import transaction
from django.core.exceptions import ValidationError
from django.contrib.gis.geos import Polygon

from core_predictive.models import GFSRequest, GFSActiveCell
from core_predictive.constants import (
    PERU_BBOX, 
    MIN_THRESHOLD_MM_H,
    TARGET_GRID_RES,
    GFS_NATIVE_GRID_RES
)

logger = logging.getLogger(__name__)


class InsertDataToPostGIS:
    """
        La clase se encarga de la ingesta de datos en PostGIS, aplicando las siguientes fases:
        - Lectura de datos
        - Rebanado BBOX
        - Resampling
        - Vectorización Topológica
        - Bulk Persistencia
    """

    def process_and_ingest_raster(
        self,
        gfs_request: GFSRequest,
        file_path: str,
        smooth_raster: bool = True,
        min_threshold_mm_h: float = MIN_THRESHOLD_MM_H
    ) -> Dict[str, Any]:
        """ 
            Método Orquestador Público del Geoprocesamiento.
        """
        if not os.path.exists(file_path):
            raise ValidationError(f"El archivo binario no existe en la ruta: {file_path}")

        try:
            # === Lectura, Normalización de Longitudes y Rebanado BBOX ===
            tp_rate_cropped = self._read_and_crop_dataset(file_path)

            # === Resampling y Suavizado Espacial (0.25° a 0.10°) ===
            tp_rate_resampled, res_deg = self._resample_raster(tp_rate_cropped, smooth_raster)

            # === Transformación de Matriz Ráster a Polígonos GEOS ===
            staging_objects = self._build_geometry_cells(
                tp_rate_resampled=tp_rate_resampled,
                res_deg=res_deg,
                gfs_request=gfs_request,
                min_threshold_mm_h=min_threshold_mm_h
            )

            # === Inserción Masiva Transaccional en PostGIS (Bulk Create) ===
            total_persisted = self._persist_cells_to_postgis(gfs_request, staging_objects)

            logger.info(f"[PostGIS Ingest] Persistidas {total_persisted} celdas en gfs_active_cells para {gfs_request.request_code}")

            return {
                "request_code": gfs_request.request_code,
                "total_active_cells": total_persisted,
                "status": "SUCCESS"
            }

        except Exception as e:
            logger.error(f"[GFS Error] Falló el geoprocesamiento del binario: {str(e)}")
            raise ValidationError(f"Error en el geoprocesamiento del binario a PostGIS: {str(e)}")

    # =========================================================================
    # =========================================================================
    # MÉTODOS PRIVADOS ESPECIALIZADOS (SEGREGACIÓN DE RESPONSABILIDADES)
    # =========================================================================

    def _read_and_crop_dataset(self, file_path: str) -> xr.DataArray:
        """
            El método nos permite abrir el archivo binario, ajustar CRS/Coordenadas a [-180, 180] y rebanar por PERU_BBOX.
        """

        # === Establecemos el tipo de archivo a procesar ===
        is_netcdf = file_path.endswith('.nc')
        engine = "netcdf4" if is_netcdf else "cfgrib"
        backend_kwargs = {} if is_netcdf else {'filter_by_keys': {'typeOfLevel': 'surface'}}

        ds = xr.open_dataset(file_path, engine=engine, backend_kwargs=backend_kwargs)

        # === Normalización de longitud al rango geodésico estándar WGS84 ===
        if 'longitude' in ds.coords:
            ds = ds.assign_coords(longitude=(((ds.longitude + 180) % 360) - 180))
            ds = ds.sortby("longitude")

        # === Rebanado por BBOX (Recorte Geográfico) ===
        north, west, south, east = PERU_BBOX[0], PERU_BBOX[1], PERU_BBOX[2], PERU_BBOX[3]
        lat_slice = slice(north, south) if ds.latitude[0] > ds.latitude[-1] else slice(south, north)
        lon_slice = slice(west, east)

        ds_cropped = ds.sel(latitude=lat_slice, longitude=lon_slice)

        if ds_cropped.sizes["latitude"] == 0 or ds_cropped.sizes["longitude"] == 0:
            raise ValidationError("El rebanado espacial no devolvió celdas válidas sobre el BBOX.")

        # === Extracción y Validación de Variables ===
        if "apcp" in ds_cropped:
            return ds_cropped["apcp"]
        elif "tp" in ds_cropped:
            return ds_cropped["tp"]
        else:
            raise KeyError("No se encontró la variable de precipitación ('apcp' o 'tp') en el dataset.")


    def _resample_raster(self, tp_rate: xr.DataArray, smooth_raster: bool) -> Tuple[xr.DataArray, float]:
        """
            El método nos permite aplicar interpolación lineal para incrementar resolución de malla a 0.10°.
        """

        # === Establecemos la resolución por defecto ===
        res_deg = GFS_NATIVE_GRID_RES

        if smooth_raster:
            # === Establecemos la resolución deseada ===
            res_deg = TARGET_GRID_RES
            
            new_lats = np.arange(
                tp_rate.latitude.max().item(), 
                tp_rate.latitude.min().item(), 
                -res_deg
            )
            new_lons = np.arange(
                tp_rate.longitude.min().item(), 
                tp_rate.longitude.max().item(), 
                res_deg
            )
            tp_rate = tp_rate.interp(latitude=new_lats, longitude=new_lons, method="linear")

        return tp_rate, res_deg

    def _build_geometry_cells(
        self,
        tp_rate_resampled: xr.DataArray,
        res_deg: float,
        gfs_request: GFSRequest,
        min_threshold_mm_h: float
    ) -> List[GFSActiveCell]:
        """
            El método nos permite transformar la matriz vectorial a objetos Polygon WGS84 (EPSG:4326).

            `@param tp_rate_resampled`: Xarray DataArray con la precipitación. Debe tener dimensiones 'latitude' y 'longitude'.
            `@param res_deg`: Resolución de la malla en grados.
            `@param gfs_request`: Objeto GFSRequest.
            `@param min_threshold_mm_h`: Umbral mínimo de precipitación en mm/h.

            `@return`: Lista de objetos GFSActiveCell.
        """

        # === Cálculo del offset para centrar las celdas ===
        half_res = res_deg / 2.0

        # === Transposición para asegurar el orden (Tiempo, Lat, Lon) ===
        time_dim = "step" if "step" in tp_rate_resampled.dims else "valid_time"
        tp_rate_resampled = tp_rate_resampled.sortby(time_dim)
        tp_rate_resampled = tp_rate_resampled.transpose(time_dim, "latitude", "longitude")

        timestamps_utc = []
        if "valid_time" in tp_rate_resampled.coords:
            time_vals = tp_rate_resampled.valid_time.values
            for idx, t in enumerate(time_vals):
                # Convertir numpy.datetime64 a segundos epoch
                epoch_sec = int(t.astype('M8[s]').astype('int64'))
                dt_utc = datetime.fromtimestamp(epoch_sec, tz=zoneinfo.ZoneInfo("UTC"))
                iso_utc_str = dt_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
                timestamps_utc.append((idx, epoch_sec, iso_utc_str))
        else:
            # Fallback en caso de usar dimensión de pasos (step)
            time_dim = "step" if "step" in tp_rate_resampled.dims else "valid_time"
            steps = tp_rate_resampled[time_dim].values
            start_dt = gfs_request.date_range_start
            
            for idx, s in enumerate(steps):
                step_hours = int(s)
                dt_step = start_dt + timedelta(hours=step_hours)
                epoch_sec = int(dt_step.timestamp())
                iso_utc_str = dt_step.strftime("%Y-%m-%dT%H:%M:%SZ")
                timestamps_utc.append((idx, epoch_sec, iso_utc_str))
                
        lats = tp_rate_resampled.latitude.values
        lons = tp_rate_resampled.longitude.values
        lons_normalized = np.where(lons > 180, lons - 360, lons)

        # === Ordenamiento de las series temporales ===
        sorted_tuples = sorted(timestamps_utc, key=lambda x: x[1])
        sorted_indices = [tup[0] for tup in sorted_tuples]
        sorted_timestamps_utc = [(tup[2]) for tup in sorted_tuples]
        
        data_matrix = tp_rate_resampled.values[sorted_indices, :, :]

        # === Inicializamos el buffer de objetos a persistir ===
        staging_objects: List[GFSActiveCell] = []

        # === Iteración sobre cada celda de la malla ===
        for i in range(len(lats)):
            lat = float(lats[i])
            for j in range(len(lons_normalized)):
                lon = float(lons_normalized[j])
                series_vals = data_matrix[:, i, j]

                cleaned_series = [
                    round(float(v), 2) if (not np.isnan(v) and v >= min_threshold_mm_h) else 0.0
                    for v in series_vals
                ]

                max_intensity = max(cleaned_series)

                # FILTRO DE CELDAS SECAS
                if max_intensity < min_threshold_mm_h:
                    continue

                min_x, max_x = round(lon - half_res, 4), round(lon + half_res, 4)
                min_y, max_y = round(lat - half_res, 4), round(lat + half_res, 4)

                # === Construcción de la Geometría Polygon (EPSG:4326) ===
                cell_polygon = Polygon((
                    (min_x, min_y),
                    (max_x, min_y),
                    (max_x, max_y),
                    (min_x, max_y),
                    (min_x, min_y)
                ), srid=4326)

                staging_objects.append(
                    GFSActiveCell(
                        gfs_request=gfs_request,
                        geometry=cell_polygon,
                        max_intensity_mm_h=max_intensity,
                        timestamps=sorted_timestamps_utc,
                        intensity_series=cleaned_series
                    )
                )

        return staging_objects

    def _persist_cells_to_postgis(self, gfs_request: GFSRequest, staging_objects: List[GFSActiveCell]) -> int:
        """
            El método elimina las celdas previas en staging e inserta masivamente (Bulk Create).
        """

        # === Si no hay objetos para persistir, retornamos 0 ===
        if not staging_objects:
            return 0

        with transaction.atomic():
            # === Eliminación transaccional de datos previos ===
            GFSActiveCell.objects.filter(gfs_request=gfs_request).delete()

            # === Inserción masiva optimizada ===
            GFSActiveCell.objects.bulk_create(staging_objects, batch_size=1000)

        return len(staging_objects)