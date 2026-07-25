from django.core.management.base import BaseCommand
from django.db import transaction
from components.models import ComponentType

class Command(BaseCommand):
    help = 'Seed para poblar la tabla ComponentType'

    @transaction.atomic
    def handle(self, *args, **kwargs):
        self.stdout.write(
            self.style.MIGRATE_HEADING("Iniciando carga de seeders de component_types")
        )

        self.stdout.write(
            "Procesando ComponentTypes"
        )

        component_types = [
            {'name': 'Captación', 'description': 'Instalación de captación de agua.'},
            {'name': 'Reservorio', 'description': 'Estructura de almacenamiento de agua.'},
            {'name': 'Estación de Bombeo', 'description': 'Instalación de bombeo de agua.'},
            {'name': 'Planta de Tratamiento de Agua Potable', 'description': 'Instalación de tratamiento de agua potable.'},
            {'name': 'Planta de Tratamiento de Aguas Residuales', 'description': 'Instalación de tratamiento de aguas residuales.'},
            {'name': 'Unidades de Desinfección', 'description': 'Unidades de desinfección de agua.'},
            {'name': 'Punto de Purgado de Redes', 'description': 'Puntos de purgado de redes.'},
            {'name': 'Línea de Conducción', 'description': 'Instalación de transporte de agua (Planta de Tratamiento - Reservorio).'},
            {'name': 'Línea de Aducción', 'description': 'Instalación de conducción de agua (Captación - Planta de Tratamiento).'},
        ]

        for component_type in component_types:
            ComponentType.objects.update_or_create(
                name=component_type['name'],
                defaults=component_type
            )

        self.stdout.write(
            "ComponentTypes insertadas"
        )

        self.stdout.write(
            self.style.SUCCESS("Seeding completado exitosamente")
        )