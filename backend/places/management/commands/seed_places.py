from django.core.management.base import BaseCommand
from django.db import transaction
from places.models import Department, Province, District, Sector

from pathlib import Path
import json

class Command(BaseCommand):
    help = 'Seeder para poblar los ubigeos político-administrativos relacionados a la la Provincia de Chanchamayo.'

    @transaction.atomic
    def handle(self, *args, **kwargs):
        path_dir = Path(__file__).resolve().parent.parent.parent / 'data'

        departments_path = path_dir / 'Departments/departments.json'
        provinces_path = path_dir / 'Provinces/provinces.json'
        districts_path = path_dir / 'Districts/districts_part.json'
        sectors_path = path_dir / 'Sectors/sectors.json'

        for file in [departments_path, provinces_path, districts_path]:
            if (not file.exists()):
                self.stderr.write(
                    self.style.ERROR(f"Error de Entorno: No se encontró el archivo '{file.name}' en la ruta'{dir}'.")
                )
                return

        self.stdout.write(
            self.style.MIGRATE_HEADING("Iniciando carga de seeders de places")
        )

        # ======= DEPARTAMENTOS =======  
        self.stdout.write(
            "Procesando Departamentos"
        )

        with open(departments_path, 'r', encoding='UTF-8') as f:
            departments_data = json.load(f)

        dept_cache = {}
        dept_count = 0
        for department in departments_data:
            ubigeo = str(department['ubigeo']).zfill(2)
            department_obj, created = Department.objects.update_or_create(
                ubigeo = ubigeo,
                defaults = {
                    'name': department['name'].strip().upper()
                }
            )
            dept_cache[ubigeo] = department_obj

            if (created):
                dept_count+=1

        self.stdout.write(
            "Departamentos insertados"
        )

        # ======= PROVINCIAS =======  
        self.stdout.write(
            "Procesando Provincias"
        )

        with open(provinces_path, 'r', encoding='UTF-8') as f:
            provinces_data = json.load(f)

        prov_cache = {}
        prov_count = 0

        for province in provinces_data:
            ubigeo = str(province['ubigeo']).zfill(4)
            province_obj, created = Province.objects.update_or_create(
                ubigeo = ubigeo,
                defaults = {
                    'department' : dept_cache.get(province['department_ubigeo']),
                    'name': province['name'].strip().upper()
                }
            )

            prov_cache[ubigeo] = province_obj

            if (created):
                prov_count+=1

        self.stdout.write(
            "Provincias insertadas"
        )

        # ======= DISTRITOS =======  
        self.stdout.write(
            "Procesando Distritos"
        )

        with open(districts_path, 'r', encoding='UTF-8') as f:
            districts_data = json.load(f)

        dist_count = 0
        dist_cache = {}

        for district in districts_data:
            ubigeo = str(district['ubigeo']).zfill(6)
            district_obj, created = District.objects.update_or_create(
                ubigeo = ubigeo,
                defaults = {
                    'province': prov_cache.get(district['province_ubigeo']),
                    'name': district['name'].strip().upper()
                }
            )

            dist_cache[ubigeo] = district_obj

            if (created):
                dist_count+=1

        self.stdout.write(
            "Distritos insertados"
        )

        # ======= SECTORES =======  
        self.stdout.write(
            "Procesando Sectores"
        )

        with open(sectors_path, 'r', encoding='UTF-8') as f:
            sectors_data = json.load(f)

        sector_count = 0

        for sector in sectors_data:
            code = str(sector['code']).zfill(3)
            sector_obj, created = Sector.objects.update_or_create(
                code = code,
                defaults = {
                    'district': dist_cache.get(sector['district_ubigeo']),
                    'name': sector['name'].strip().upper(),
                    'status': sector['status'],
                    'observations': sector['observations']
                }
            )

            if (created):
                sector_count+=1

        self.stdout.write(
            "Sectores insertados"
        )


        self.stdout.write(
            self.style.SUCCESS("Seeding completado exitosamente")
        )
