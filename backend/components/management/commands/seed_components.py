from components.models import Criticality
from components.models import PhysicalStatus
from django.core.management.base import BaseCommand
from django.db import transaction
from components.models import Component

from components.models import ComponentType, OperationalStatus
from places.models import District

from pathlib import Path
import json

class Command(BaseCommand):
    help = 'Seed para poblar la tabla Components'

    @transaction.atomic
    def handle(self, *args, **kwargs):
        self.stdout.write(
            self.style.MIGRATE_HEADING("Iniciando carga de seeders de components")
        )

        path_dir = Path(__file__).resolve().parent.parent.parent / 'data'

        components_path = path_dir / 'components.json'

        if (not components_path.exists()):
            self.stderr.write(
                self.style.ERROR(f"Error de Entorno: No se encontró el archivo '{components_path.name}' en la ruta'{dir}'.")
            )
            return

        # ======= COMPONENTES =======  
        self.stdout.write(
            "Procesando Components"
        )

        with open(components_path, 'r', encoding='UTF-8') as f:
            components_data = json.load(f)

        comp_cache = {}
        comp_count = 0

        for component in components_data:
            district = District.objects.filter(ubigeo = component['district_ubigeo']).first()
            type = ComponentType.objects.filter(name = component['type_name'].upper()).first()
            physical_status = PhysicalStatus.objects.filter(name = component['physical_status']).first()
            operational_status = OperationalStatus.objects.get(code=component['operational_status'])
            
            comp_obj, created = Component.objects.update_or_create(
                code = component['code'],
                defaults = {
                    'district': district,
                    'type': type,
                    'specification': component['specification'],
                    'name': component['name'].upper(),
                    'operational_status': operational_status,
                    'physical_status': physical_status
                }
            )

            if (created):
                comp_count+=1

        self.stdout.write(
            "Components insertados"
        )