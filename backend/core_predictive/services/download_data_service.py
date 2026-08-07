import os
import re
import logging
from datetime import timedelta
import numpy as np
# pyrefly: ignore [missing-import]
import xarray as xr

from django.utils import timezone
from rest_framework.exceptions import ValidationError

# pyrefly: ignore [missing-import]
from herbie import Herbie, FastHerbie

from core_predictive.models import GFSRequest
from core_predictive.constants import (
    PERU_BBOX, 
    GFS_DEFAULT_RESOL,
    GFS_RUN_HOURS,
    GFS_TOTAL_HOURS_FORECAST,
)
from core_predictive.services.storage_service import StorageService

logger = logging.getLogger(__name__)


class GFSDataService(StorageService):
    """
        La clase se encarga del Servicio de Ingesta y Geoprocesamiento de los Pronósticos Operativos de la NOAA (GFS).
        Ello se realiza por medio de un conjunto de responsabilidades atómicas establecidas de la siguiente manera:
            - Construye la matriz de ejecuciones nominales (UTC) de los modelos GFS.
            - Descarga los archivos GRIB2 desde AWS S3.
            - Rebanado por BBOX de los archivos NetCDF.
            - Ensamblado del archivo NetCDF final.
    """

    def __init__(self, resol: str = GFS_DEFAULT_RESOL):
        self.resol = resol
        self.grib2_storage_dir = self.create_storage_path('grib2')

    def is_data_already_processed(self, request_code: str) -> bool:
        """ 
            Se encarga de verificar en la BD si la ejecución de descarga de datos ya fue procesada exitosamente en PostGIS. 
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
            El método Orquestador Principal se encarga de coordinar la descarga por lotes
            y ensamblado de pasadas horarias de la NOAA GFS.

            === FIX ===
            Antes: iteraba por una matriz de runs (18Z hoy, 12Z hoy, 06Z hoy, ... ayer)
            cayendo en "fallback" al primer run que existiera. Eso disfrazaba el
            `request_code` (ej. AUTO_..._18Z) con datos del run 12Z y rompía el eje
            temporal del timeline (.solapamiento de timestamps HISTORIC/FORECAST).
            Ahora: parsea `request_code` (ej. `AUTO_20260805_18Z`), extrae fecha+run-hour
            objetivo e intenta ÚNICAMENTE ese run. Si NOAA no publicó todavía, lanza
            `ValidationError` y Celery reintenta en 30 min (configurado en `tasks.py`).
        """
        if total_hours > 120:
            raise ValidationError("El máximo de horas permitido para paso horario de 1h en GFS es 120h.")

        # === Parseo del run objetivo desde el request_code ===
        # Formato esperado: "AUTO_YYYYMMDD_HHZ" (ej. "AUTO_20260805_18Z").
        match = re.match(r"^AUTO_(\d{4})(\d{2})(\d{2})_(\d{2})Z$", request_code)
        if not match:
            raise ValidationError(
                f"request_code inválido, no se puede parsear el run objetivo: '{request_code}'. "
                f"Formato esperado: AUTO_YYYYMMDD_HHZ (ej. AUTO_20260805_18Z)."
            )
        y, mo, d, hh = match.groups()
        run_date = f"{y}{mo}{d}"
        run_hour = hh
        run_label = f"{run_date} {run_hour}Z"
        herbie_date_str = f"{y}-{mo}-{d} {run_hour}:00"
        tag = f"request_{request_code}"

        logger.info(f"[NOAA GFS] Evaluando ejecución {run_label} ({total_hours}h)...")

        # === Descarga remota desde AWS S3 vía FastHerbie ===
        # Se lanza `ValidationError` si NOAA aún no publicó el run; Celery reintenta.
        local_files = self._fetch_remote_dataset(herbie_date_str, total_hours, run_label)

        # === Procesamiento, Normalización y Rebanado por BBOX de cada paso ===
        datasets = self._process_and_crop_steps(local_files)

        # === Concatenación y Ensamblado del NetCDF Comprimido Final ===
        output_file = self._assemble_and_save_netcdf(datasets, tag, run_date, run_hour)

        logger.info(f"[NOAA GFS] Archivo NetCDF generado exitosamente: {output_file}")

        return {
            "file_path": output_file,
            "file_name": os.path.basename(output_file)
        }

    # =========================================================================
    # MÉTODOS PRIVADOS ESPECIALIZADOS (SEGREGACIÓN DE RESPONSABILIDADES)
    # =========================================================================

    def _build_execution_matrix(self) -> list[dict]:
        """
            === DEPRECATED / NO USADO en `execute_download_data` ===
            Se conserva como documentación de los runs nominales NOAA (00/06/12/18Z,
            hoy y ayer) y por si a futuro se requiere un fallback explícito controlado.
            NO BORRAR: algunos tests pueden referenciarlo; el loop en `execute_download_data`
            ya no lo consume desde el fix anti-disfraz (ref. tasks.py / commit anti-fallback).
        """
        return [
            {"date_offset": 0, "time": GFS_RUN_HOURS[3]},   # 18Z Hoy
            {"date_offset": 0, "time": GFS_RUN_HOURS[2]},   # 12Z Hoy
            {"date_offset": 0, "time": GFS_RUN_HOURS[1]},   # 06Z Hoy
            {"date_offset": 0, "time": GFS_RUN_HOURS[0]},   # 00Z Hoy
            {"date_offset": -1, "time": GFS_RUN_HOURS[3]},  # 18Z Ayer
            {"date_offset": -1, "time": GFS_RUN_HOURS[2]},  # 12Z Ayer
            {"date_offset": -1, "time": GFS_RUN_HOURS[1]},  # 06Z Ayer
            {"date_offset": -1, "time": GFS_RUN_HOURS[0]},  # 00Z Ayer
        ]

    def _fetch_remote_dataset(self, herbie_date_str: str, total_hours: int, run_label: str) -> list:
        """
            Verifica la disponibilidad del último step y ejecuta la descarga
            Byte-Range con FastHerbie.

            === FIX ===
            Antes: si `idx_df.empty`, devolvía `[]` silenciosamente → el caller caía
            al "fallback" (descargar el run anterior y guardarlo como el nuevo).
            Ahora: lanzar `ValidationError` para que Celery `self.retry()` reintente
            en 30 min (configurado en `tasks.py`). Esto evita el "disfraz" del run.
            También captura el `ValueError` que Herbie levanta internamente cuando
            el `.idx` no fue publicado todavía (lo normaliza a `ValidationError`
            con mensaje claro, para que el log de Celery sea legible).
        """
        h_check = Herbie(
            herbie_date_str,
            model="gfs",
            product=f"pgrb2.{self.resol}",
            fxx=total_hours,
            priority=['aws']
        )

        try:
            idx_df = h_check.inventory(search=":APCP:surface:")
        except ValueError as e:
            # Herbie raises ValueError cuando el `.idx` no existe en S3 todavía.
            # Lo normalizamos a `ValidationError` con mensaje legible.
            raise ValidationError(
                f"NOAA no ha publicado el run {run_label} todavía. "
                f"El archivo `.idx` no fue encontrado en AWS S3 (Herbie: {str(e)[:80]}). "
                f"Reintentar en algunos minutos."
            )

        if idx_df is None or idx_df.empty:
            # === FIX: fallar honesto en vez de devolver [] silencioso ===
            # NOAA aún no publicó el archivo `.idx` para este run.
            # El retry policy de Celery se encarga de reintentar en 30 min.
            raise ValidationError(
                f"NOAA no ha publicado el run {run_label} todavía. "
                f"El archivo `.idx` no fue encontrado en AWS S3. "
                f"Reintentar en algunos minutos."
            )

        logger.info(f"[AWS S3 Byte-Range] Descargando {total_hours} pasos temporales (:APCP:surface:)...")

        FH = FastHerbie(
            DATES=[herbie_date_str],
            model="gfs",
            product=f"pgrb2.{self.resol}",
            fxx=range(1, total_hours + 1),
            priority=['aws']
        )

        return FH.download(search=":APCP:surface:")

    def _process_and_crop_steps(self, local_files: list) -> list[xr.Dataset]:
        """ 
            Procesa cada binario descargado, normaliza longitudes a [-180, 180] y rebana por BBOX. 
        """
        datasets = []
        north, west, south, east = PERU_BBOX

        for step, file in enumerate(local_files, start=1):
            ds_step = xr.open_dataset(file, engine="cfgrib")

            # === Normalizar Longitud al estándar EPSG:4326 ===
            ds_step = ds_step.assign_coords(
                longitude=((ds_step.longitude + 180) % 360) - 180
            ).sortby("longitude")

            lat_slice = (
                slice(north, south)
                if ds_step.latitude.values[0] > ds_step.latitude.values[-1]
                else slice(south, north)
            )
            lon_slice = slice(west, east)

            ds_step = ds_step.sel(latitude=lat_slice, longitude=lon_slice)
            ds_step = ds_step.expand_dims(step=[step])

            # === Cargar el dataset en memoria y cerrar el descriptor de archivo ===
            datasets.append(ds_step.load())
            ds_step.close()

        return datasets

    def _assemble_and_save_netcdf(
        self, 
        datasets: list[xr.Dataset], 
        tag: str, 
        run_date: str, 
        run_hour: str
    ) -> str:
        """ 
            Concatena la dimensión temporal 'step' y persiste en disco NetCDF4 con compresión zlib. 
        """
        # === Concatenar la dimensión temporal 'step' ===
        ds_final = xr.concat(datasets, dim="step", combine_attrs="override")
        ds_final = ds_final.sortby("step")
        ds_final = ds_final.transpose("step", "latitude", "longitude")

        # === Generación del nombre y ruta del archivo NetCDF4 ===
        now_str = timezone.now().strftime('%Y%m%d_%H%M%S')
        file_name = f"gfs_{self.resol}_tp_{tag}_date_{run_date}_time_{run_hour}Z_{now_str}.nc"
        output_file = os.path.join(self.grib2_storage_dir, file_name)

        # === Compresión del archivo NetCDF4 con zlib ===
        encoding = {
            var: {"zlib": True, "complevel": 5}
            for var in ds_final.data_vars
        }

        # === Guardar el archivo NetCDF4 ===
        ds_final.to_netcdf(output_file, encoding=encoding)
        ds_final.close()

        return output_file