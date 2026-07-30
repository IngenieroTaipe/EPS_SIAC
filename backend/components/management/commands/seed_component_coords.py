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

        coords_data = [
            # ==== PICHANAQUI ====
            {
                "ubigeo": "120303",
                "type_name": "Reservorio",
                "code": "0002",
                "criticality_name": "ALTA",
                "coords": [[-74.8700, -10.9200]]
            },
            {
                "ubigeo": "120303",
                "type_name": "Planta de Tratamiento de Agua Potable",
                "code": "0003",
                "criticality_name": "ALTA",
                "coords": [[-74.8750, -10.9250]]
            },
            {
                "ubigeo": "120303",
                "type_name": "Planta de Tratamiento de Agua Potable",
                "code": "0005",
                "criticality_name": "ALTA",
                "coords": [[-74.8800, -10.9300]]
            },
            {
                "ubigeo": "120303",
                "type_name": "Planta de Tratamiento de Aguas Residuales",
                "code": "0005",
                "criticality_name": "MEDIA",
                "coords": [[-74.8600, -10.9100]]
            },
            {
                "ubigeo": "120303",
                "type_name": "Planta de Tratamiento de Aguas Residuales",
                "code": "0012",
                "criticality_name": "MEDIA",
                "coords": [[-74.8650, -10.9150]]
            },
            # ==== OXAPAMPA ====
            {
                "ubigeo": "190301",
                "type_name": "Reservorio",
                "code": "0001",
                "criticality_name": "ALTA",
                "coords": [[-75.4050, -10.5750]]
            },
            {
                "ubigeo": "190301",
                "type_name": "Línea de Conducción",
                "code": "0002",
                "criticality_name": "ALTA",
                "coords": [
                    [-75.4050, -10.5750],
                    [-75.4040, -10.5760],
                    [-75.4030, -10.5770],
                    [-75.4020, -10.5780],
                    [-75.4010, -10.5790],
                    [-75.4000, -10.5800],
                    [-75.3990, -10.5810],
                    [-75.3980, -10.5820],
                    [-75.3970, -10.5830],
                    [-75.3960, -10.5840]
                ]
            }
        ]

        self.stdout.write("Procesando ComponentCoords")

        # Limpiar coordenadas previas de los componentes en la lista para evitar duplicados en re-runs
        for data in coords_data:
            c_type = ComponentType.objects.filter(name=data["type_name"].upper()).first()
            if c_type:
                comp = Component.objects.filter(district__ubigeo=data["ubigeo"], type=c_type, code=data["code"]).first()
                if comp:
                    ComponentCoord.objects.filter(component=comp).delete()

        count = 0
        for data in coords_data:
            district = District.objects.filter(ubigeo=data["ubigeo"]).first()
            if not district:
                self.stderr.write(self.style.WARNING(f"Distrito no encontrado: {data['ubigeo']}"))
                continue

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

            for coord_pair in data["coords"]:
                point = Point(coord_pair[0], coord_pair[1], srid=4326)

                ComponentCoord.objects.create(
                    component=component,
                    criticality=criticality,
                    coords=point
                )
                count += 1

        self.stdout.write(f"Se actualizaron/crearon {count} ComponentCoords.")
        self.stdout.write(self.style.SUCCESS("Seeding completado exitosamente"))
