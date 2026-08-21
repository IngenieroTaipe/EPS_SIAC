from django.core.management.base import BaseCommand
from django.db import transaction
from components.models import Criticality
 
class Command(BaseCommand):
    help = 'Seed para poblar la tabla Criticality'

    @transaction.atomic
    def handle(self, *args, **kwargs):
        self.stdout.write(
            self.style.MIGRATE_HEADING("Iniciando carga de seeders de criticalities")
        )

        self.stdout.write(
            "Procesando Criticalities"
        )

        criticalities = [
            {'name': 'Alta', 'severity_level': 3, 'description': 'Componente de alta criticidad frente a fenómenos climáticos.'},
            {'name': 'Media', 'severity_level': 2, 'description': 'Componente de media criticidad frente a fenómenos climáticos.'},
            {'name': 'Baja', 'severity_level': 1, 'description': 'Componente de baja criticidad frente a fenómenos climáticos.'}
        ]

        for criticality in criticalities:
            name = criticality['name'].upper()
            Criticality.objects.update_or_create(
                name=name,
                defaults={
                    'severity_level': criticality['severity_level'],
                    'description': criticality['description']
                }
            )

        self.stdout.write(
            "Criticalities insertadas"
        )

        self.stdout.write(
            self.style.SUCCESS("Seeding completado exitosamente")
        )