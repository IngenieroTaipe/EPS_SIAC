from places.models import District
from core_predictive.models import Variable
from django.core.management.base import BaseCommand
from django.db import transaction
from alerts_management.models import (
    AlertStatus,
    AlertPhase,
    AlertStatusPhase
)

class Command(BaseCommand):
    help = 'Seed para poblar las tablas del módulo de Alerts Management'

    @transaction.atomic
    def handle(self, *args, **kwargs):
        self.stdout.write(
            self.style.MIGRATE_HEADING("==== Iniciando carga de seeders de Alerts Management ==== ")
        )

        # ==========================================================================
        # SEEDERS DE ALERT STATUS
        # ==========================================================================
        self.stdout.write(
            self.style.MIGRATE_HEADING("Procesando Alert Status")
        )

        alert_statuses = [
            {'name': 'Predicho', 'description': 'Alerta generada.'},
            {'name': 'En Espera de Confirmación', 'description': 'Alerta en espera de confirmación.'},
            {'name': 'Confirmado', 'description': 'Alerta confirmada.'},
            {'name': 'No Confirmado', 'description': 'Alerta no confirmada.'}
        ]

        for alert_status in alert_statuses:
            name = alert_status['name'].upper()
            AlertStatus.objects.update_or_create(
                name=name,
                defaults={
                    'description' : alert_status['description']
                }
            )

        self.stdout.write(
            "AlertStatus insertadas"
        )

        # ==========================================================================
        # SEEDERS DE ALERT PHASE
        # ==========================================================================
        self.stdout.write(
            self.style.MIGRATE_HEADING("Procesando Alert Phase")
        )

        alert_phases = [
            {'name': 'En espera de Reporte', 'description': 'Alerta en espera de reporte (consolidación de los daños generados por el fenómeno natural).'},
            {'name': 'En proceso de atención', 'description': 'Alerta en proceso de atención (por parte de la EPS).'},
            {'name': 'Atendido', 'description': 'Alerta atendida (Daños reparados y EPS con operaciones normales).'}
        ]

        for alert_phase in alert_phases:
            name = alert_phase['name'].upper()
            AlertPhase.objects.update_or_create(
                name=name,
                defaults={
                    'description' : alert_phase['description']
                }
            )

        self.stdout.write(
            "AlertPhase insertadas"
        )

        # ==========================================================================
        # SEEDERS DE ALERT STATUS PHASES
        # ==========================================================================
        self.stdout.write(
            self.style.MIGRATE_HEADING("Procesando Alert Status Phases")
        )

        # d: indica que el estado no tiene fase asignada (solo existe como estado independiente) (no se asignará una fase, pero debemos agregar algo para no tener problemas en la lectura posteriormente)
        alert_status_phases = [
            {'alert_status': 'PREDICHO', 'alert_phase': 'd'},
            {'alert_status': 'EN ESPERA DE CONFIRMACIÓN', 'alert_phase':'d'},
            {'alert_status': 'CONFIRMADO', 'alert_phase': 'EN ESPERA DE REPORTE'},
            {'alert_status': 'CONFIRMADO', 'alert_phase': 'EN PROCESO DE ATENCIÓN'},
            {'alert_status': 'CONFIRMADO', 'alert_phase': 'ATENDIDO'},
            {'alert_status': 'NO CONFIRMADO', 'alert_phase':'d'}
        ]

        for alert_status_phase in alert_status_phases:
            alert_status = AlertStatus.objects.filter(
                name=alert_status_phase['alert_status']
            ).first()
            alert_phase = AlertPhase.objects.filter(
                name=alert_status_phase['alert_phase']
            ).first()
            AlertStatusPhase.objects.update_or_create(
                alert_status=alert_status,
                alert_phase=alert_phase,
            )

        self.stdout.write(
            "AlertStatusPhases insertadas"
        )