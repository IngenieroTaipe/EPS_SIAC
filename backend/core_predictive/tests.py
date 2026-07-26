from django.utils import timezone
from datetime import timedelta
from places.models import Department
from places.models import Province
import os
import django
import json

# Configuración del entorno de Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'EPS_SelvaCentral.settings')
django.setup()

from core_predictive.services import ECMWFDataService
from django.test import TestCase

from core_predictive.tasks import run_scheduled_ecmwf_download
from unittest.mock import patch, MagicMock
from datetime import datetime

from django.test import TestCase, override_settings
from django.conf import settings
from django.contrib.gis.geos import Polygon, MultiPolygon

from core_predictive.models import EMCWFRequest
from places.models import District

import numpy as np
import xarray as xr
from unittest.mock import patch, MagicMock

from core_predictive.services import (
    ECMWFDataService,
    ECMWFIntersectionService,
    ECMWFRequestService
)

class ECMWFPredictiveServiceTests(TestCase):
    def setUp(self):
        """
        Configuración del entorno de prueba (Fixtures y setup de coordenadas).
        Coordenadas de prueba: Infraestructura en Selva Central (Chanchamayo WGS84).
        """
        self.latitude = -11.0522
        self.longitude = -75.3311
        self.service = ECMWFDataService()

    def test_fetch_operational_precipitation(self):
        print("Iniciando prueba unitaria del servicio ECMWF Open Data...")

        try:
            # data = self.service.execute_download_grib2(
            #     "12345678",
            #     24,
            # )
            
            # print("PRUEBA EXITOSA")
            # print(f"Archivo GRIB2 en disco: {data['file_path']}")
            # print(f"Formato GeoJSON: {data['geojson']['type']}")
            # print(f"Cantidad de Features: {len(data['geojson']['features'])}")
            
            # # Guardar una copia local del GeoJSON resultante para inspección en QGIS
            # output_json = "/tmp/test_output.geojson"
            # with open(output_json, "w") as f:
            #     json.dump(data['geojson'], f, indent=2)
                
            # print(f"GeoJSON exportado para visualización GIS en: {output_json}")
            print(f"GeoJSON exportado para visualización GIS en:")

        except Exception as e:
            print(f"FALLÓ LA PRUEBA: {str(e)}")

class ECMWFServicesTestCase(TestCase):
    """
    Suite de Pruebas de Integración y Geoprocesamiento Espacial para la suite ECMWF.
    Evalúa la descarga I/O, la vectorización Bounding Box (PERU_BBOX),
    la intersección topológica con PostGIS y la persistencia atómica.
    """

    def setUp(self):
        """
        Configuración del entorno geodésico de prueba:
        Creación de un distrito catastral de prueba en Pichanaki (EPS Chanchamayo).
        """
        peru_bbox_polygon = Polygon((
        (-81.5, -18.5),
        (-68.5, -18.5),
        (-68.5, 0.5),
        (-81.5, 0.5),
        (-81.5, -18.5)
        ), srid=4326)

        # 1. Instanciar Departamento (12 - JUNÍN)
        self.department, _ = Department.objects.get_or_create(
            ubigeo='12',
            defaults={'name': 'JUNÍN'}
        )

        # 2. Instanciar Provincia (1203 - CHANCHAMAYO)
        self.province, _ = Province.objects.get_or_create(
            ubigeo='1203',
            defaults={
                'name': 'CHANCHAMAYO',
                'department': self.department
            }
        )
        
        # Polígono geodésico en WGS84 (EPSG:4326) que intersecta la grilla de prueba
        pichanaki_geom = Polygon((
            (-75.25, -11.25),
            (-74.75, -11.25),
            (-74.75, -10.75),
            (-75.25, -10.75),
            (-75.25, -11.25)
        ), srid=4326)
        
        self.district = District.objects.create(
            ubigeo='120304',
            name='Pichanaki',
            province=self.province,
            geometry='MULTIPOLYGON(((-75.25 -11.25, -74.75 -11.25, -74.75 -10.75, -75.25 -10.75, -75.25 -11.25)))'
        )

        # Mock de umbrales retornado por DistrictService
        self.district_threshold_data = MagicMock()
        self.district_threshold_data.name = self.district.name
        self.district_threshold_data.ubigeo = self.district.ubigeo
        self.district_threshold_data.geometry = self.district.geometry
        self.district_threshold_data.thresholds = [
            {
                "threshold_name": "Lluvia Intensa",
                "phenomena_name": "Precipitación",
                "min_value": 5.0,
                "max_value": 15.0
            }
        ]
        now = timezone.now()
        self.date_range_start = now
        self.date_range_end = now + timedelta(hours=48)

        # Creación de la instancia de solicitud en BD
        self.request_code = "TEST_REQ_20260726_001"
        self.request_obj, _ = EMCWFRequest.objects.get_or_create(
                request_code=self.request_code,
                defaults={
                    "status": "PENDING",
                    "file_name": f"pending_{self.request_code}",
                    "date_range_start": self.date_range_start,  # Atributo requerido para resolver IntegritisError
                    "date_range_end": self.date_range_end,
                    "geom_bounds": peru_bbox_polygon,
                    "file_size_mb": 100,
                    "download_time_seconds": 1
                }
        )

        self.test_storage_dir = os.path.join(settings.BASE_DIR, 'test_storage_tmp')

    def tearDown(self):
        """
        Limpieza de archivos físicos generados durante la prueba.
        """
        if os.path.exists(self.test_storage_dir):
            import shutil
            shutil.rmtree(self.test_storage_dir, ignore_errors=True)

    @override_settings(ECMWF_STORAGE_DIR='/tmp/test_ecmwf_storage')
    @patch('core_predictive.services.Client')
    def test_execute_download_grib2_success(self, mock_ecmwf_client):
        """
        Prueba I/O: Verifica la descarga exitosa del binario GRIB2 y la creación
        de la estructura jerárquica de almacenamiento (YYYY/MM/DD).
        """
        mock_client_instance = MagicMock()
        mock_ecmwf_client.return_value = mock_client_instance

        # Simular escritura física del binario GRIB2 al invocar client.retrieve
        def mock_retrieve(request, target):
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with open(target, 'wb') as f:
                f.write(b'GRIB_HEADER_SIMULATED_BINARY_CONTENT')

        mock_client_instance.retrieve.side_effect = mock_retrieve

        data_service = ECMWFDataService()
        result = data_service.execute_download_grib2(
            request_code=self.request_code,
            total_hours=24
        )

        self.assertIsNotNone(result["file_path"])
        self.assertTrue(os.path.exists(result["file_path"]))
        self.assertIn("grib2", result["file_path"])

    @patch('xarray.open_dataset')
    def test_process_grib2_to_geojson_with_peru_bbox_slicing(self, mock_xr_open):
        """
        Prueba Geodésica: Verifica que el geoprocesamiento aplique el rebanado (PERU_BBOX),
        calcule la intensidad promedio horaria (mm/h) y construya polígonos válidos.
        """
        # 1. Vectores de Coordenadas (EPSG:4326) dentro de PERU_BBOX (0.5, -81.5, -18.5, -68.5)
        lats = np.array([-10.0, -11.0])       # Longitud = 2
        lons = np.array([-75.0, -74.0])       # Longitud = 2
        steps = np.array([np.timedelta64(0, 'h'), np.timedelta64(3, 'h')])  # Longitud = 2

        # 2. Matriz 3D de precipitación acumulada en metros (shape EXACTO: [2, 2, 2])
        # Importante: Las dimensiones deben calzar exactamente con (len(steps), len(lats), len(lons))
        tp_data = np.ones((len(steps), len(lats), len(lons))) * 0.003  # 3mm de lluvia

        # 3. Construcción del Dataset sin conflictos de dimensión
        ds_mock = xr.Dataset(
            data_vars={"tp": (("step", "latitude", "longitude"), tp_data)},
            coords={
                "step": steps,
                "latitude": lats,
                "longitude": lons,
                "time": np.datetime64('2026-07-26T00:00:00')
            }
        )

        # Simulación del contexto 'with xr.open_dataset(...) as ds:'
        mock_xr_open.return_value.__enter__.return_value = ds_mock

        fake_grib_path = "/tmp/test_sample.grib2"
        os.makedirs(os.path.dirname(fake_grib_path), exist_ok=True)
        with open(fake_grib_path, 'wb') as f:
            f.write(b'DUMMY_GRIB_DATA')

        try:
            data_service = ECMWFDataService()
            geojson_res = data_service.process_grib2_to_geojson(fake_grib_path)

            # 4. Asserts de Estructura Vectorial
            self.assertEqual(geojson_res["type"], "FeatureCollection")
            self.assertEqual(len(geojson_res["features"]), 4)  # 2 lats * 2 lons = 4 polígonos

            first_feature = geojson_res["features"][0]
            self.assertEqual(first_feature["geometry"]["type"], "Polygon")
            self.assertEqual(len(first_feature["geometry"]["coordinates"][0]), 5)  # Polígono cerrado
            self.assertIn("intensity_mm_h", first_feature["properties"])

        finally:
            if os.path.exists(fake_grib_path):
                os.remove(fake_grib_path)

    @patch('places.services.DistrictService.get_district_thresholds')
    def test_map_grid_cells_to_districts_intersection(self, mock_get_thresholds):
        """
        Prueba Topológica (ST_Intersects):
        Verifica que la malla de celdas reconozca la colisión espacial con el distrito
        e inyecte los umbrales correspondientes.
        """
        mock_get_thresholds.return_value = [self.district_threshold_data]

        # Feature de prueba posicionado sobre la geometría del distrito Pichanaki (-75.0, -11.0)
        sample_features = [{
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-75.125, -11.125],
                    [-74.875, -11.125],
                    [-74.875, -10.875],
                    [-75.125, -10.875],
                    [-75.125, -11.125]
                ]]
            },
            "properties": {
                "centroid": [-75.0, -11.0]
            }
        }]

        enriched_features = ECMWFIntersectionService.map_grid_cells_to_districts(sample_features)

        self.assertEqual(len(enriched_features), 1)
        intersected = enriched_features[0]["properties"]["intersected_districts"]
        self.assertEqual(len(intersected), 1)
        self.assertEqual(intersected[0]["district_name"], "Pichanaki")
        self.assertEqual(intersected[0]["thresholds"][0]["threshold_name"], "Lluvia Intensa")
    
# core_predictive/tests.py (Reemplazar test_orchestrator_full_pipeline_process_request)
    @override_settings(ECMWF_STORAGE_DIR='/tmp/test_ecmwf_storage')
    @patch('core_predictive.services.ECMWFDataService.execute_download_grib2')
    @patch('core_predictive.services.ECMWFDataService.process_grib2_to_geojson')
    @patch('places.services.DistrictService.get_district_thresholds')
    def test_orchestrator_full_pipeline_process_request(
        self, 
        mock_get_thresholds, 
        mock_process_geojson, 
        mock_download
    ):
        """
        Prueba de Orquestación (End-to-End):
        Verifica la ejecución del método `process_request` de `ECMWFRequestService`,
        la transición de estados en la BD y la actualización de métricas de auditoría.
        """
        # 1. Objeto de datos con tipos NATIVOS de Python y mapeo explícito de ubigeo (evita MagicMock en JSON)
        class DummyDistrictThreshold:
            def __init__(self, district):
                self.id = district.ubigeo       # CORRECCIÓN: Usar ubigeo como ID para evitar AttributeError
                self.name = district.name
                self.ubigeo = district.ubigeo
                self.geometry = district.geometry
                self.thresholds = [
                    {
                        "threshold_name": "Lluvia Intensa",
                        "phenomena_name": "Precipitación",
                        "min_value": 5.0,
                        "max_value": 15.0
                    }
                ]

        mock_get_thresholds.return_value = [DummyDistrictThreshold(self.district)]

        # 2. Mock de Descarga GRIB2
        fake_grib_path = "/tmp/test_ecmwf_storage/grib2/2026/07/26/test.grib2"
        os.makedirs(os.path.dirname(fake_grib_path), exist_ok=True)
        with open(fake_grib_path, 'wb') as f:
            f.write(b'GRIB_FILE_CONTENT_MOCK')

        mock_download.return_value = {
            "file_path": fake_grib_path,
            "file_name": "test.grib2"
        }

        # 3. Mock de GeoJSON Base con tipos escalares puros (JSON Serializable)
        mock_process_geojson.return_value = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [-75.125, -11.125],
                        [-74.875, -11.125],
                        [-74.875, -10.875],
                        [-75.125, -10.875],
                        [-75.125, -11.125]
                    ]]
                },
                "properties": {
                    "centroid": [-75.0, -11.0],
                    "intensity_mm_h": [1.5, 2.0],
                    "accumulated_period_mm": 10.5
                }
            }]
        }

        # 4. Ejecución del Orquestador
        orchestrator = ECMWFRequestService(ecmwf_request_instance=self.request_obj)
        response = orchestrator.process_request(total_hours=24)

        # 5. Verificación de Persistencia en BD y Disco
        self.request_obj.refresh_from_db()
        self.assertEqual(self.request_obj.status, "COMPLETED")
        self.assertEqual(self.request_obj.file_name, "test.grib2")
        self.assertTrue(os.path.exists(self.request_obj.geojson_path))
        self.assertEqual(response["status"], "COMPLETED")

        # Limpieza de archivos de prueba
        if os.path.exists(fake_grib_path):
            os.remove(fake_grib_path)