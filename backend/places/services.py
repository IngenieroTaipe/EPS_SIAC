from django.core.exceptions import ValidationError
from places.models import District
import logging

logger = logging.getLogger(__name__)

class DistrictService:
    @staticmethod
    def get_district_thresholds() -> int:
        """
            Busca todos los distritos que poseen geometría en BD y precarga los umbrales asociados.
            
            `@return:` QuerySet de distritos con datos precargados
        """
        districts = District.objects.filter(
            geometry__isnull=False
        ).prefetch_related(
            'thresholds_district__threshold',
            'thresholds_district__natural_phenomena'
        )
        return districts