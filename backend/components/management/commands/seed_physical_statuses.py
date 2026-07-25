from django.core.management.base import BaseCommand
from django.db import transaction
from components.models import PhysicalStatus
 
class Command(BaseCommand):
    help = 'Seed para poblar la tabla PhysicalStatus'

    @transaction.atomic
    def handle(self, *args, **kwargs):
        self.stdout.write(
            self.style.MIGRATE_HEADING("Iniciando carga de seeders de Estados Fisicos")
        )

        self.stdout.write(
            "Procesando Estados Fisicos"
        )

        physical_statuses = [
            {'code': 'B', 'name': 'Bueno', 'description': 'Componente en buen estado físico.'},
            {'code': 'R', 'name': 'Regular', 'description': 'Componente en estado regular.'},
            {'code': 'M', 'name': 'Malo', 'description': 'Componente en mal estado.'}
        ]

        for physical_status in physical_statuses:
            PhysicalStatus.objects.update_or_create(
                code=physical_status['code'],
                defaults=physical_status
            )

        self.stdout.write(
            "Estados Fisicos insertados"
        )

        self.stdout.write(
            self.style.SUCCESS("Seeding completado exitosamente")
        )