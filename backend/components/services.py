import logging

from components.models import Component

logger = logging.getLogger(__name__)

class ComponentService:
    @staticmethod
    def get_coordinates():
        components_coordinates = Component.objects.filter(
            coords_relation__coords__isnull=False
        ).values_list(
            'coords_relation__coords'
        )
        return components_coordinates