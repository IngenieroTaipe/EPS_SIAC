from datetime import timedelta
from django.db import transaction
from django.contrib.gis.geos import Polygon
from core_predictive.models import GFSRequest, Variable, NaturalPhenomena
from core_predictive.constants import GFS_TOTAL_HOURS_FORECAST, PERU_BBOX

class GFSRequestFactory:
    """ 
        Servicio encargado de instanciar entidades PostGIS y verificar dependencias base.
    """

    @staticmethod
    def get_or_create_pending_request(request_code: str, now_utc) -> tuple[GFSRequest, int, int]:
        """ 
            Crea el expediente padre en PostgreSQL y retorna los IDs de configuración base.
        """

        # ============================
        # Recuperación de variables base de negocio
        # ============================
        variable_obj = Variable.objects.get(name="PRECIPITACIÓN ACUMULADA / HORA")
        phenomenon_obj = NaturalPhenomena.objects.get(name="LLUVIAS INTENSAS")

        # ============================
        # Construcción del Bounding Box de Perú (EPSG:4326)
        # ============================
        north, west, south, east = PERU_BBOX[0], PERU_BBOX[1], PERU_BBOX[2], PERU_BBOX[3]
        peru_bbox = Polygon((
            (west, south),
            (east, south),
            (east, north),
            (west, north),
            (west, south)
        ), srid=4326)

        date_end = now_utc + timedelta(hours=GFS_TOTAL_HOURS_FORECAST)

        with transaction.atomic():
            request_obj, _ = GFSRequest.objects.get_or_create(
                request_code=request_code,
                defaults={
                    "status": "PENDING",
                    "file_name": f"pending_{request_code}",
                    "date_range_start": now_utc,
                    "date_range_end": date_end,
                    "geom_bounds": peru_bbox
                }
            )

        return request_obj, variable_obj.id, phenomenon_obj.id