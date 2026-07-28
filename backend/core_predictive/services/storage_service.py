from datetime import datetime, timedelta
from django.conf import settings

import os

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
