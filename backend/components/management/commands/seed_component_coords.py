from django.core.management.base import BaseCommand
from django.db import transaction
from components.models import Component, ComponentCoord, Criticality, ComponentType
from places.models import District
from django.contrib.gis.geos import Point

class Command(BaseCommand):
    help = 'Seed para poblar la tabla ComponentCoord'

    @transaction.atomic
    def handle(self, *args, **kwargs):
        self.stdout.write(
            self.style.MIGRATE_HEADING("Iniciando carga de seeders de component_coords")
        )

        # Ubigeo de Pichanaqui
        ubigeo_pichanaqui = "120303"
        district = District.objects.filter(ubigeo=ubigeo_pichanaqui).first()

        if not district:
            self.stderr.write(self.style.ERROR(f"Error: No se encontró el distrito con ubigeo {ubigeo_pichanaqui}"))
            return

        coords_data = [
            {
                "type_name": "Reservorio",
                "code": "0002",
                "criticality_name": "ALTA",
                "coords": [-74.8700, -10.9200]
            },
            {
                "type_name": "Planta de Tratamiento de Agua Potable",
                "code": "0003",
                "criticality_name": "ALTA",
                "coords": [-74.8750, -10.9250]
            },
            {
                "type_name": "Planta de Tratamiento de Agua Potable",
                "code": "0005",
                "criticality_name": "ALTA",
                "coords": [-74.8800, -10.9300]
            },
            {
                "type_name": "Planta de Tratamiento de Aguas Residuales",
                "code": "0005",
                "criticality_name": "MEDIA",
                "coords": [-74.8600, -10.9100]
            },
            {
                "type_name": "Planta de Tratamiento de Aguas Residuales",
                "code": "0012",
                "criticality_name": "MEDIA",
                "coords": [-74.8650, -10.9150]
            }
        ]

        self.stdout.write("Procesando ComponentCoords")

        count = 0
        for data in coords_data:
            c_type = ComponentType.objects.filter(name=data["type_name"].upper()).first()
            if not c_type:
                self.stderr.write(self.style.WARNING(f"Tipo de componente no encontrado: {data['type_name']}"))
                continue

            component = Component.objects.filter(
                district=district,
                type=c_type,
                code=data["code"]
            ).first()

            if not component:
                self.stderr.write(self.style.WARNING(f"Componente no encontrado: {data['type_name']} {data['code']}"))
                continue

            criticality = Criticality.objects.filter(name=data["criticality_name"]).first()
            if not criticality:
                self.stderr.write(self.style.WARNING(f"Criticidad no encontrada: {data['criticality_name']}"))
                continue

            point = Point(data["coords"][0], data["coords"][1], srid=4326)

            ComponentCoord.objects.update_or_create(
                component=component,
                defaults={
                    "criticality": criticality,
                    "coords": point
                }
            )
            count += 1

        self.stdout.write(f"Se actualizaron/crearon {count} ComponentCoords.")
        self.stdout.write(self.style.SUCCESS("Seeding completado exitosamente"))
