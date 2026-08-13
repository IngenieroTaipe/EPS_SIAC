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
            # ==== 120301 (San Ramon / Chanchamayo area) ====
            {
                "ubigeo": "120301",
                "type_name": "Fuente",
                "code": "0001",
                "criticality_name": "ALTA",
                "coords": [[-75.3350, -11.1150]]
            },
            {
                "ubigeo": "120301",
                "type_name": "Fuente",
                "code": "0003",
                "criticality_name": "ALTA",
                "coords": [[-75.3360, -11.1160]]
            },
            {
                "ubigeo": "120301",
                "type_name": "Captación",
                "code": "0005",
                "criticality_name": "ALTA",
                "coords": [[-75.3370, -11.1170]]
            },
            {
                "ubigeo": "120301",
                "type_name": "Captación",
                "code": "0006",
                "criticality_name": "ALTA",
                "coords": [[-75.3380, -11.1180]]
            },
            {
                "ubigeo": "120301",
                "type_name": "Estación de Bombeo y Rebombeo de Agua Potable",
                "code": "0009",
                "criticality_name": "MEDIA",
                "coords": [[-75.3400, -11.1200]]
            },
            
            # ==== 120303 (Pichanaqui) ====
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
            # ==== CHANCHAMAYO (120301) — Fuentes, Captaciones, Estación de Bombeo ====
            {
                "ubigeo": "120301",
                "type_name": "Fuente",
                "code": "0001",
                "criticality_name": "MEDIA",
                "coords": [[-75.3050, -11.0580]]
            },
            {
                "ubigeo": "120301",
                "type_name": "Fuente",
                "code": "0003",
                "criticality_name": "MEDIA",
                "coords": [[-75.3150, -11.0630]]
            },
            {
                "ubigeo": "120301",
                "type_name": "Captación",
                "code": "0005",
                "criticality_name": "MEDIA",
                "coords": [[-75.3090, -11.0570]]
            },
            {
                "ubigeo": "120301",
                "type_name": "Captación",
                "code": "0006",
                "criticality_name": "MEDIA",
                "coords": [[-75.3120, -11.0530]]
            },
            {
                "ubigeo": "120301",
                "type_name": "Estación de Bombeo y Rebombeo de Agua Potable",
                "code": "0009",
                "criticality_name": "MEDIA",
                "coords": [[-75.3170, -11.0600]]
            },
            # ==== SAN RAMÓN (120305, distrito de la provincia de Chanchamayo) ====
            {
                "ubigeo": "120305",
                "type_name": "Estación de Bombeo y Rebombeo de Agua Potable",
                "code": "0008",
                "criticality_name": "MEDIA",
                "coords": [[-75.3480, -11.2080]]
            },
            {
                "ubigeo": "120303",
                "type_name": "Línea de Conducción",
                "code": "0015",
                "criticality_name": "ALTA",
                "coords": [
                    [-74.8700, -10.9200],
                    [-74.8680, -10.9180],
                    [-74.8690, -10.9160],
                    [-74.8670, -10.9140],
                    [-74.8650, -10.9120],
                    [-74.8640, -10.9090],
                    [-74.8620, -10.9060]
                ]
            },

            # ==== 190301 (Oxapampa) ====
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
                    [-75.4030, -10.5765],
                    [-75.4010, -10.5755],
                    [-75.3990, -10.5780],
                    [-75.3960, -10.5775],
                    [-75.3940, -10.5790],
                    [-75.3910, -10.5805]
                ]
            },
            {
                "ubigeo": "190301",
                "type_name": "Línea de Conducción",
                "code": "0003",
                "criticality_name": "ALTA",
                "coords": [
                    [-75.4050, -10.5750],
                    [-75.4070, -10.5770],
                    [-75.4060, -10.5790],
                    [-75.4080, -10.5810],
                    [-75.4090, -10.5830],
                    [-75.4110, -10.5840],
                    [-75.4130, -10.5860]
                ]
            },
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
