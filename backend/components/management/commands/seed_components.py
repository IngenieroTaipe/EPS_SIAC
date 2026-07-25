from django.core.management.base import BaseCommand
from django.db import transaction
from components.models import Component


class Command(BaseCommand):
    help = 'Seed para poblar la tabla Components'

    @transaction.atomic
    def handle(self, *args, **kwargs):
        self.stdout.write(
            self.style.MIGRATE_HEADING("Iniciando carga de seeders de components")
        )

        self.stdout.write(
            "Procesando Components"
        )

        components = [
            {   
                'sector': '7',
                'type': 'Captación',
                'code': 'CAP-001',
                'specification': 'Captación de agua del río Chillón',
                'operational_status': 'Operativo',
                'physical_status': 'Bueno',
                'criticality': 'Alta',
                'volume': 1000,
            }
        ]