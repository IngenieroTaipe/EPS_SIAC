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
            physical_status = (
                PhysicalStatus.objects.filter(code=component['physical_status']).first()
                if component.get('physical_status')
                else None
            )
            operational_status = OperationalStatus.objects.get(code=component['operational_status'])

            # === FIX idempotencia con soft-delete ===
            # `objects` (SoftDeleteManager) filtra las filas borradas, así que
            # un `update_or_create` no ve un componente eliminado por un
            # usuario e intenta INSERTarlo de nuevo → viola la constraint
            # única (district, type, code), que TAMBIÉN aplica a filas
            # borradas → IntegrityError → el entrypoint (set -e) mataba el
            # contenedor en cada arranque.
            # Solución: buscar con `all_objects` (incluye borrados):
            #   - No existe → crear (primera vez).
            #   - Existe activo → refrescar defaults (idempotente).
            #   - Existe borrado → RESPETAR el delete del usuario (ni
            #     revivir ni duplicar).
            existing = Component.all_objects.filter(
                code=component['code'],
                district=district,
                type=type,
            ).first()

            if existing is None:
                Component.objects.create(
                    code=component['code'],
                    district=district,
                    type=type,
                    specification=component['specification'],
                    name=component['name'].upper(),
                    operational_status=operational_status,
                    physical_status=physical_status,
                )
                comp_count += 1
            elif existing.deleted_at is None:
                existing.specification = component['specification']
                existing.name = component['name'].upper()
                existing.operational_status = operational_status
                existing.physical_status = physical_status
                existing.save()

        self.stdout.write(
            "Components insertados"
        )