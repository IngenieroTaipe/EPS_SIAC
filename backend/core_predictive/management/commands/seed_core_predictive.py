from places.models import District
from core_predictive.models import Variable
from django.core.management.base import BaseCommand
from django.db import transaction
from core_predictive.models import (
    VariableType, 
    UnitsMeasurement, 
    NaturalPhenomena, 
    Threshold,
    ThresholdsNaturalPhenomena
)

class Command(BaseCommand):
    help = 'Seed para poblar la tabla ComponentType'

    @transaction.atomic
    def handle(self, *args, **kwargs):
        self.stdout.write(
            self.style.MIGRATE_HEADING("==== Iniciando carga de seeders de Core Predictive ==== ")
        )

        # ==========================================================================
        # SEEDERS DE UNITSMEASUREMENT
        # ==========================================================================
        self.stdout.write(
            "Procesando UnitsMeasurement"
        )

        units_measurements = [
            {'name': 'MM/H', 'description': 'MILÍMETRO POR HORA.'},
            {'name': 'M/S', 'description': 'METRO POR SEGUNDO.'}
        ]

        for units_measurement in units_measurements:
            name = units_measurement['name'].upper()
            UnitsMeasurement.objects.update_or_create(
                name=name,
                defaults={
                    'description' : units_measurement['description']
                }
            )

        self.stdout.write(
            "UnitsMeasurements insertadas"
        )

        # ==========================================================================
        # SEEDERS DE TYPE VARIABLES
        # ==========================================================================
        self.stdout.write(
            self.style.MIGRATE_HEADING("Procesando Type Variables")
        )

        type_variables = [
            {'name': 'Climática', 'description': 'Variables relacionadas con el clima.'},
            {'name': 'Hidrológica', 'description': 'Variables relacionadas con el agua.'}
        ]

        for type_variable in type_variables:
            name = type_variable['name'].upper()
            VariableType.objects.update_or_create(
                name=name,
                defaults={
                    'description' : type_variable['description']
                }
            )

        self.stdout.write(
            "TypeVariables insertadas"
        )

        # ==========================================================================
        # SEEDERS DE VARIABLES
        # ==========================================================================
        self.stdout.write(
            self.style.MIGRATE_HEADING("Procesando Variables")
        )

        variables = [
            {'name': 'Precipitación Acumulada / Hora', 'description': 'Variable de Precipitación',
            'variable_type': 'CLIMÁTICA', 'unit_measurement': 'MM/H'},
        ]

        for variable in variables:
            name = variable['name'].upper()
            variable_type = VariableType.objects.filter(
                name=variable['variable_type']
            ).first()
            unit_measurement = UnitsMeasurement.objects.filter(
                name=variable['unit_measurement']
            ).first()
            Variable.objects.update_or_create(
                name=name,
                defaults={
                    'description' : variable['description'],
                    'variable_type': variable_type,
                    'unit_measurement': unit_measurement
                }
            )

        self.stdout.write(
            "Variables insertadas"
        )

        # ==========================================================================
        # SEEDERS DE THRESHOLDS
        # ==========================================================================
        self.stdout.write(
            self.style.MIGRATE_HEADING("Procesando Thresholds")
        )

        thresholds = [
            {'name': 'Extremadamente Lluvioso', 'description': 'Intensidad de lluvia muy alta.'},
            {'name': 'Muy Lluvioso', 'description': 'Intensidad de lluvia alta.'},
            {'name': 'Lluvioso', 'description': 'Intensidad de lluvia moderada.'},
            {'name': 'Moderadamente Lluvioso', 'description': 'Intensidad de lluvia baja.'}
        ]

        for threshold in thresholds:
            name = threshold['name'].upper()
            Threshold.objects.update_or_create(
                name=name,
                defaults={
                    'description' : threshold['description']
                }
            )

        self.stdout.write(
            "Thresholds insertadas"
        )


        # ==========================================================================
        # SEEDERS DE NATURALPHENOMENA
        # ==========================================================================
        self.stdout.write(
            "Procesando NaturalPhenomena"
        )

        natural_phenomenas = [
            {'name': 'Sequía', 'description': 'Fenómeno meteorológico caracterizado por la falta de agua en un periodo de tiempo.'},
            {'name': 'Lluvias Intensas', 'description': 'Fenómeno meteorológico caracterizado por la presencia de lluvias en un periodo de tiempo.'},
            {'name': 'Heladas', 'description': 'Fenómeno meteorológico caracterizado por la variación de temperaturas en un periodo de tiempo.'}
        ]

        for natural_phenomena in natural_phenomenas:
            name = natural_phenomena['name'].upper()
            NaturalPhenomena.objects.update_or_create(
                name=name,
                defaults={
                    'description' : natural_phenomena['description']
                }
            )

        self.stdout.write(
            "NaturalPhenomena insertadas"
        )

        # ==========================================================================
        # SEEDERS DE THRESHOLD NATURAL PHENOMENAS
        # ==========================================================================
        self.stdout.write(
            self.style.MIGRATE_HEADING("Procesando Threshold Natural Phenomean")
        )

        base_threshold_natural_phenomenas = [
            {
                'threshold': 'Extremadamente Lluvioso', 
                'natural_phenomena': 'Lluvias Intensas', 
                'variable': 'Precipitación Acumulada / Hora',
                'min_value': 10.1,
                'max_value': None
            },
            {
                'threshold': 'Muy Lluvioso', 
                'natural_phenomena': 'Lluvias Intensas', 
                'variable': 'Precipitación Acumulada / Hora',
                'min_value': 7.5,
                'max_value': 10.1
            },
            {
                'threshold': 'Lluvioso', 
                'natural_phenomena': 'Lluvias Intensas', 
                'variable': 'Precipitación Acumulada / Hora',
                'min_value': 3.2,
                'max_value': 7.5
            },
            {
                'threshold': 'Moderadamente Lluvioso', 
                'natural_phenomena': 'Lluvias Intensas', 
                'variable': 'Precipitación Acumulada / Hora',
                'min_value': 1.6,
                'max_value': 3.2
            }
        ]

        districts = District.objects.all()

        for threshold_data in base_threshold_natural_phenomenas:
            threshold = Threshold.objects.filter(
                name=threshold_data['threshold'].upper()
            ).first()
            natural_phenomena = NaturalPhenomena.objects.filter(
                name=threshold_data['natural_phenomena'].upper()
            ).first()
            variable = Variable.objects.filter(
                name=threshold_data['variable'].upper()
            ).first()
            
            for district in districts:
                if not district:
                    continue
                ThresholdsNaturalPhenomena.objects.update_or_create(
                    district=district,
                    threshold=threshold,
                    natural_phenomena=natural_phenomena,
                    variable=variable,
                    defaults={
                        'min_value' : threshold_data['min_value'],
                        'max_value' : threshold_data['max_value']
                    }
                )

        self.stdout.write(
            "ThresholdNaturalPhenomean insertadas"
        )