# places/management/commands/seed_geo_info.py
from pathlib import Path
from django.core.management.base import BaseCommand
from django.contrib.gis.gdal import DataSource
from django.contrib.gis.geos import GEOSGeometry, MultiPolygon, Polygon
from places.models import Department, Province, District


class Command(BaseCommand):
    help = 'Acopla geometrías vectoriales a los UBIGEOs existentes mediante coincidencia de nombres.'

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.MIGRATE_HEADING('=== Iniciando Asignación de Geometría por Nombre ===')
        )

        base_dir = Path('/app/places/data')
        
        # ==== INSERTAR DEPARTAMENTOS ====
        dept_shp = base_dir / 'Departments/Departamentos.shp'

        if dept_shp.exists():
            ds = DataSource(str(dept_shp))
            layer = ds[0]
            updated_count = 0

            for feature in layer:
                name_val = str(feature.get('DEPARTAMEN')).strip().upper()
                geom_gdal = feature.geom

                # Convertir GDAL Geometry a GEOSGeometry de Django
                geos_geom = GEOSGeometry(geom_gdal.wkt, srid=4326)
                
                # Normalizar a MultiPolygon
                if isinstance(geos_geom, Polygon):
                    geos_geom = MultiPolygon(geos_geom, srid=4326)

                # Coincidencia por nombre (Case-Insensitive)
                dept = Department.objects.filter(name__iexact=name_val).first()
                if dept:
                    dept.geometry = geos_geom
                    dept.save(update_fields=['geometry'])
                    updated_count += 1

            self.stdout.write(self.style.SUCCESS(f'✓ Departamentos actualizados con geometría: {updated_count}'))

        # ==== INSERTAR PROVINCIAS ====
        prov_shp = base_dir / 'Provinces/Provincias.shp'
        if prov_shp.exists():
            ds = DataSource(str(prov_shp))
            layer = ds[0]
            updated_prov = 0

            for feature in layer:
                prov_name = str(feature.get('PROVINCIA')).strip().upper()
                dept_name = str(feature.get('DEPARTAMEN')).strip().upper()
                
                geom_gdal = feature.geom
                geos_geom = GEOSGeometry(geom_gdal.wkt, srid=4326)

                if isinstance(geos_geom, Polygon):
                    geos_geom = MultiPolygon(geos_geom, srid=4326)

                # Búsqueda precisa: Provincia en su respectivo Departamento para evitar ambigüedades
                province = Province.objects.filter(
                    name__iexact=prov_name,
                    department__name__iexact=dept_name
                ).first()

                if province:
                    province.geometry = geos_geom
                    province.save(update_fields=['geometry'])
                    updated_prov += 1

            self.stdout.write(
                self.style.SUCCESS(f'✓ Provincias actualizadas con geometría: {updated_prov}')
            )

        # ==== INSERTAR DISTRITOS ====
        dist_shp = base_dir / 'Districts/Distritos.shp'
        if dist_shp.exists():
            ds = DataSource(str(dist_shp))
            layer = ds[0]
            updated_dist = 0

            for feature in layer:
                dist_name = str(feature.get('DISTRITO')).strip().upper()
                prov_name = str(feature.get('PROVINCIA')).strip().upper()
                
                geom_gdal = feature.geom
                geos_geom = GEOSGeometry(geom_gdal.wkt, srid=4326)

                if isinstance(geos_geom, Polygon):
                    geos_geom = MultiPolygon(geos_geom, srid=4326)

                # Búsqueda precisa: Distrito en su respectiva Provincia para evitar ambigüedades
                district = District.objects.filter(
                    name__iexact=dist_name,
                    province__name__iexact=prov_name
                ).first()

                if district:
                    district.geometry = geos_geom
                    district.save(update_fields=['geometry'])
                    updated_dist += 1

            self.stdout.write(
                self.style.SUCCESS(f'✓ Distritos actualizados con geometría: {updated_dist}')
            )