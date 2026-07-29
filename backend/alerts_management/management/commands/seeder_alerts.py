from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth import get_user_model

from alerts_management.models import (
    Alert, AlertHistory, AlertStatusPhase, AlertNotification, 
    AlertResult, NotificationChannel, NotificationType
)
from core_predictive.models import NaturalPhenomena, ThresholdsNaturalPhenomena, Threshold
from places.models import District

User = get_user_model()

class Command(BaseCommand):
    help = 'Seed para poblar la tabla de alertas con ejemplos variados.'

    @transaction.atomic
    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.MIGRATE_HEADING("==== Iniciando carga de seeder_alerts ==== "))

        now = timezone.now()
        
        # Buscar usuario para el registro histórico, o crearlo si no existe
        system_user = User.objects.filter(is_superuser=True).first()
        if not system_user:
            system_user = User.objects.create_superuser('admin_alerts', 'admin@alerts.com', 'admin')

        # Buscar el fenómeno de Lluvias Intensas
        phenomena = NaturalPhenomena.objects.filter(name="LLUVIAS INTENSAS").first()
        if not phenomena:
            self.stdout.write(self.style.ERROR("No se encontró el fenómeno LLUVIAS INTENSAS. Corre seed_core_predictive primero."))
            return

        # Obtenemos un distrito base para relacionar los umbrales
        district = District.objects.first()
        if not district:
            self.stdout.write(self.style.ERROR("No se encontró ningún distrito. Por favor carga los distritos primero."))
            return

        # Definir 5 alertas de prueba variando el umbral y el estado
        alerts_data = [
            {
                'threshold_name': 'EXTREMADAMENTE LLUVIOSO',
                'status': 'CONFIRMADO',
                'phase': 'EN PROCESO DE ATENCIÓN'
            },
            {
                'threshold_name': 'MUY LLUVIOSO',
                'status': 'PREDICHO',
                'phase': None
            },
            {
                'threshold_name': 'LLUVIOSO',
                'status': 'EN ESPERA DE CONFIRMACIÓN',
                'phase': None
            },
            {
                'threshold_name': 'MODERADAMENTE LLUVIOSO',
                'status': 'NO CONFIRMADO',
                'phase': None
            },
            {
                'threshold_name': 'EXTREMADAMENTE LLUVIOSO',
                'status': 'CONFIRMADO',
                'phase': 'EN ESPERA DE REPORTE'
            }
        ]

        for i, data in enumerate(alerts_data):
            threshold = Threshold.objects.filter(name=data['threshold_name']).first()
            if not threshold:
                self.stdout.write(self.style.ERROR(f"No se encontró el Threshold {data['threshold_name']}"))
                continue

            max_thresh = ThresholdsNaturalPhenomena.objects.filter(
                district=district, 
                natural_phenomena=phenomena, 
                threshold=threshold
            ).first()

            if not max_thresh:
                self.stdout.write(self.style.ERROR(f"No se encontró ThresholdsNaturalPhenomena para {data['threshold_name']}"))
                continue

            # Tiempos simulados
            start_time = now + timedelta(hours=i)
            end_time = start_time + timedelta(hours=4)
            # Asegurar un valor numérico para la intensidad máxima
            max_intensity = max_thresh.min_value if max_thresh.min_value else 20.0

            # 1. Crear Alerta
            alert = Alert.objects.create(
                natural_phenomena=phenomena,
                code=Alert.generate_next_code(),
                max_intensity_mm_h=max_intensity,
                max_threshold=max_thresh,
                start_time_utc=start_time,
                end_time_utc=end_time
            )

            # 2. Buscar AlertStatusPhase
            if data['phase']:
                status_phase = AlertStatusPhase.objects.filter(
                    alert_status__name=data['status'],
                    alert_phase__name=data['phase']
                ).first()
            else:
                status_phase = AlertStatusPhase.objects.filter(
                    alert_status__name=data['status'],
                    alert_phase__isnull=True
                ).first()

            if not status_phase:
                self.stdout.write(self.style.ERROR(f"No se encontró AlertStatusPhase para Estado: {data['status']}, Fase: {data['phase']}"))
                continue

            # 3. Crear Histórico
            history = AlertHistory.objects.create(
                alert=alert,
                alert_status_phase=status_phase,
                created_by=system_user
            )

            # 4. Crear Notificación
            AlertNotification.objects.create(
                alert_history=history,
                channel=NotificationChannel.TELEGRAM,
                notification_type=NotificationType.INITIAL,
                is_sent=True,
                sent_at=now - timedelta(minutes=5)
            )

            # 5. Crear Resultado solo para la primera alerta (AlertResult)
            if i == 0:
                AlertResult.objects.create(
                    alert=alert,
                    has_damage=True,
                    damage_report="Se reportó obstrucción en la captación de la planta de tratamiento debido a deslizamiento.",
                    taken_actions="Se envió cuadrilla para limpieza de la rejilla de captación."
                )

        self.stdout.write(self.style.SUCCESS("Se insertaron 5 alertas correctamente (incluyendo históricos, notificaciones y resultado para una de ellas)."))
