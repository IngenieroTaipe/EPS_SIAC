from django.core.management.base import BaseCommand
from django.db import transaction
from components.models import OperationalStatus
 

class Command(BaseCommand):
    help = 'Seed para poblar la tabla OperationalStatus'

    @transaction.atomic
    def handle(self, *args, **kwargs):
        self.stdout.write(
            self.style.MIGRATE_HEADING("Iniciando carga de seeders de Estados Operativos")
        )

        self.stdout.write(
            "Procesando Estados Operativos"
        )

        operational_statuses = [
            {'code': '001', 'name': 'Operativo', 'description': 'El componente se encuentra en operación normal.'},
            {'code': '002', 'name': 'Inoperativo', 'description': 'El componente no se encuentra en operación.'},
            {'code': '003', 'name': 'En Reserva', 'description': 'El componente se encuentra en reserva.'}
        ]

        for operational_status in operational_statuses:
            OperationalStatus.objects.update_or_create(
                code=operational_status['code'],
                defaults=operational_status
            )

        self.stdout.write(
            "Estados Operativos insertados"
        )

        self.stdout.write(
            self.style.SUCCESS("Seeding completado exitosamente")
        )