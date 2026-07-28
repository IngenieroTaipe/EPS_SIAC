import os
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
            El método Orquestador Principal se encarga de coordinar la descarga por lotes y ensamblado de pasadas horarias de la NOAA GFS.
        """
        if total_hours > 120:
            raise ValidationError("El máximo de horas permitido para paso horario de 1h en GFS es 120h.")

        # === Generación de la Matriz de ejecuciones nominales (UTC) === 
        datetime_config = self._build_execution_matrix()
        now_utc = timezone.now()

        tag = f"request_{request_code}"
        output_file = None

        # === Iteración sobre ejecuciones nominales (18Z, 12Z, 06Z, 00Z de hoy y ayer) === 
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
                continue

            herbie_date_str = run_datetime.strftime('%Y-%m-%d %H:00')
            run_date = run_datetime.strftime('%Y%m%d')
            run_hour = f"{dt_cfg['time']:02d}"

            logger.info(f"[NOAA GFS] Evaluando ejecución {run_date} {run_hour}Z ({total_hours}h)...")

            try:
                # === Descarga remota desde AWS S3 vía FastHerbie ===
                local_files = self._fetch_remote_dataset(herbie_date_str, total_hours)
                
                if not local_files:
                    logger.warning(f"[NOAA GFS] Ejecución {run_date} {run_hour}Z aún no disponible en AWS S3.")
                    continue

                # === Procesamiento, Normalización y Rebanado por BBOX de cada paso ===
                datasets = self._process_and_crop_steps(local_files)

                # === Concatenación y Ensamblado del NetCDF Comprimido Final ===
                output_file = self._assemble_and_save_netcdf(datasets, tag, run_date, run_hour)

                logger.info(f"[NOAA GFS] Archivo NetCDF generado exitosamente: {output_file}")
                
                return {
                    "file_path": output_file,
                    "file_name": os.path.basename(output_file)
                }

            except Exception as e:
                logger.warning(f"[NOAA GFS Warning] Falló el procesamiento de {run_date} {run_hour}Z: {str(e)}")
                if output_file and os.path.exists(output_file):
                    os.remove(output_file)

        raise ValidationError(f"No fue posible obtener el paquete completo de {total_hours}h desde AWS S3.")

    # =========================================================================
    # MÉTODOS PRIVADOS ESPECIALIZADOS (SEGREGACIÓN DE RESPONSABILIDADES)
    # =========================================================================

    def _build_execution_matrix(self) -> list[dict]:
        """
            Se encarga de construir la matriz de ejecuciones nominales (18Z, 12Z, 06Z, 00Z). 
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

    def _fetch_remote_dataset(self, herbie_date_str: str, total_hours: int) -> list:
        """ 
            Verifica la disponibilidad del último step y ejecuta la descarga 
            Byte-Range con FastHerbie. 
        """
        h_check = Herbie(
            herbie_date_str,
            model="gfs",
            product=f"pgrb2.{self.resol}",
            fxx=total_hours,
            priority=['aws']
        )

        idx_df = h_check.inventory(search=":APCP:surface:")
        if idx_df.empty:
            return []

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