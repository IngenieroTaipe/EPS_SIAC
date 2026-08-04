from django.core.management.base import BaseCommand
from django.db import transaction
from places.models import District, Sector
from organization.models import Branch

from pathlib import Path
import json

class Command(BaseCommand):
    help = 'Seeder para poblar las dependencias (Unidades Operativas) de la EPS Selva Central.'

    @transaction.atomic
    def handle(self, *args, **kwargs):
        path_dir = Path(__file__).resolve().parent.parent.parent / 'data'

        branches_path = path_dir / 'branches.json'

        for file in [branches_path]:
            if (not file.exists()):
                self.stderr.write(
                    self.style.ERROR(f"Error de Entorno: No se encontró el archivo '{file.name}' en la ruta'{dir}'.")
                )
                return

        self.stdout.write(
            self.style.MIGRATE_HEADING("Iniciando carga de seeders de places")
        )

        # ======= UNIDADES OPERATIVAS =======  
        self.stdout.write(
            "Procesando Unidades Operativas"
        )

        with open(branches_path, 'r', encoding='UTF-8') as f:
            branches_data = json.load(f)

        branch_cache = {}
        branch_count = 0
        for branch in branches_data:
            code = str(branch['code']).zfill(3)
            branch_obj, created = Branch.objects.update_or_create(
                code = code,
                defaults = {
                    'name': branch['name'].strip().upper(),
                    'acronym': branch['acronym'].strip().upper(),
                    'district_id': branch['district'],
                    'status': branch['status'],
                    'observations': branch['observations']
                }
            )
            branch_cache[code] = branch_obj

            if (created):
                branch_count+=1

        self.stdout.write(
            f"{branch_count} Unidades Operativas insertadas"
        )

        self.stdout.write(
            self.style.SUCCESS("Seeding completado exitosamente")
        )
