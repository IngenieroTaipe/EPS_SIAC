from django.core.management.base import BaseCommand
from django.db import transaction
from places.models import Departments, Provinces, Districts, Sectors

class Command(BaseCommand):
    help = 'Seeder para poblar los ubigeos político-administrativos relacionados a la la Provincia de Chanchamayo.'

    @transaction.atomic
    def handle(self, *args, **kwargs):
        departments = [
            {'ubigeo': '12'}
        ]

        department, created = Departments.objects.get_or_create(
            ubigeo = '12',
            name = 'Junín'
        )