import logging
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

from alerts_management.models import (
    Alert, AlertHistory, AlertStatusPhase, 
    AlertResult, AlertNotification, NotificationChannel, NotificationType
)

logger = logging.getLogger(__name__)


class AlertStateMachineService:
    """
        Clase que gestiona la lógica de la máquina de estados de las alertas.
        
        Contiene los métodos necesarios para ejecutar transiciones de estado de forma segura
        y controlada, aplicando las reglas de negocio establecidas.
    """

    @classmethod
    def transition_to_state_phase(
        cls, 
        alert: Alert, 
        status_name: str, 
        phase_name: str = None, 
        user=None, 
        payload: dict = None
    ) -> AlertHistory:
        """
            Ejecuta una transición de estado/fase validando las reglas de negocio e inmutabilidad.
            
            `@params`:
                - `alert` (`Alert`): Instancia de la alerta que ejecutará la transición.
                
                - `status_name` (`str`): Nombre del estado objetivo
                    - 'Predicho'
                    - 'En Espera de Confirmación'
                    - 'No Confirmado'
                    - 'Confirmado'
                
                - `phase_name` (`Optional[str]`): Nombre de la fase objetivo
                    - 'En Espera de Reporte'
                    - 'En Proceso de Atención'
                    - 'Atendido'
                
                - `user` (`Optional[User]`): Instancia del usuario autenticado que solicita la transición (None si es ejecutado por el sistema/Celery).

                - `payload` (`Optional[Dict[str, Any]]`): Diccionario con los atributos de dominio requeridos según el estado/fase destino:
                    - `real_start_time` (`datetime | str, opcional`): Fecha y hora real de inicio del fenómeno (ISO-8601 UTC o datetime). Usado en estado 'Confirmado'.
                    - `has_damage` (`bool, opcional`): Indica si el fenómeno causó daños materiales en la infraestructura. Usado en 'En Proceso de Atención'.
                    - `damage_report` (`str, opcional`): Descripción detallada del reporte de daños. Obligatorio si 'has_damage' es True.
                    - `taken_actions` (`str, opcional`): Descripción técnica de las acciones operativas ejecutadas para resolver la incidencia. Obligatorio en fase 'Atendido'.
            
            `@return`:
                - `AlertHistory`: Registro histórico de bitácora creado para la nueva transición.
            
            `@raises`:
                - `ValidationError`: Si la combinación Estado/Fase no existe en el sistema.
                
                - `ValidationError`: Si se violan las reglas de negocio de la máquina de estados.
        """
        payload = payload or {}

        if status_name == "Confirmado" and (not phase_name or phase_name == "Sin Fase"):
            phase_name = cls.DEFAULT_CONFIRMED_PHASE
            
        with transaction.atomic():
            # === Obtener combinaciones Fase - Estado ===
            target_status_phase = cls._get_status_phase_instance(status_name, phase_name)
            
            # === Obtener estado/fase actual de la alerta ===
            current_history = AlertHistory.objects.filter(alert=alert).order_by('-created_at').first()
            
            # === Validar las reglas estrictas del diagrama de transición ===
            if current_history:
                cls._validate_transition_rules(alert, current_history, status_name, phase_name, payload)

            # === Crear la nueva línea en el histórico de bitácora ===
            new_history = AlertHistory.objects.create(
                alert=alert,
                alert_status_phase=target_status_phase,
                created_by=user
            )

            # === Aplicar efectos secundarios por estado (Efectos de Dominio) ===
            cls._apply_state_side_effects(alert, status_name, phase_name, payload)

            logger.info(f"✅ [StateMachine] Alerta #{alert.code} migró a Estado: '{status_name}' | Fase: '{phase_name}'")
            return new_history

    @staticmethod
    def _get_status_phase_instance(
        status_name: str, 
        phase_name: str = None
    ) -> AlertStatusPhase:
        """
            Obtiene la instancia de la combinación Estado/Fase.
        
            `@params`:
                - `status_name` (`str`): Nombre del estado ('Predicho', 'Confirmado', etc.).
                - `phase_name` (`Optional[str]`): Nombre de la fase ('En Espera de Reporte', 'Atendido', etc.).

            `@return`:
                - `AlertStatusPhase`: Objeto de relación único encontrado en la base de datos.
            
            `@raises`:
                - `ValidationError`: Si la combinación Estado/Fase no existe en el sistema.
        """
        try:
            params = {"alert_status__name": status_name}
            if phase_name:
                params["alert_phase__name"] = phase_name
            
            return AlertStatusPhase.objects.get(**params)
        
        except AlertStatusPhase.DoesNotExist:
            raise ValidationError(f"❌ La combinación Estado '{status_name}' y Fase '{phase_name}' no está registrada en el sistema.")

    @classmethod
    def _validate_transition_rules(
        cls, 
        current_history: AlertHistory, 
        target_status: str, 
    ):
        """
            Evalúa la matriz de permisos de transición y ventanas temporales de inmutabilidad del ciclo de vida.

            `@params`:
                - `current_history` (`AlertHistory`): Registro histórico actual de la alerta.
                - `target_status` (`str`): Estado al cual se intenta transicionar.
        """
        current_status = current_history.alert_status_phase.alert_status.name
        current_phase = current_history.alert_status_phase.alert_phase.name
        now = timezone.now()

        # === RESTRICCIÓN: De 'No Confirmado' a 'Confirmado' solo dentro de las 2 horas posteriores ===
        if current_status == "No Confirmado" and target_status == "Confirmado":
            time_in_no_confirmed = now - current_history.created_at
            if time_in_no_confirmed > timedelta(hours=2):
                raise ValidationError("❌ Se superó la ventana de arrepentimiento de 2 horas para confirmar esta alerta.")

        # === RESTRICCIÓN: Una vez en 'Confirmado', NO se puede volver a 'No Confirmado' ni 'Predicho' ===
        if current_status == "Confirmado" and target_status in ["No Confirmado", "Predicho", "En Espera de Confirmación"]:
            raise ValidationError("❌ Una alerta en estado Confirmado no puede regresar a estados previos de predicción.")

        # === RESTRICCIÓN: Fase 'Atendido' es inmutable (Cierre definitivo) ===
        if current_phase == "Atendido":
            time_since_attended = now - current_history.created_at
            if time_since_attended > timedelta(days=2):
                raise ValidationError("❌ El ciclo de la alerta está Atendido y sellado. Se superó el plazo de 2 días para modificar reportes.")

    @classmethod
    def _apply_state_side_effects(
        cls,
        alert: Alert,
        payload: dict,
        status_name: str,
        phase_name: str = None
    ):
        """
            Aplica las transformaciones de dominio y escrituras en base de datos asociadas a la transición (Alert y AlertResult).

            `@params`:
                - `alert` (`Alert`): Alerta sobre la cual se aplicarán los efectos de dominio.
                
                - `payload` (`Dict[str, Any]`): Contenedor de atributos de entrada para la fase/estado:
                    - `real_start_time` (`datetime | str, opcional`): Hora real del fenómeno. Se usa si status_name == 'Confirmado'. Valor por defecto: timezone.now().
                    - `has_damage` (`bool, opcional`): Determina si hubo daños. Se procesa si está presente en el payload.
                    - `damage_report` (`str, opcional`): Texto explicativo del daño. Requerido si 'has_damage' es True.
                    - `taken_actions` (`str, opcional`): Texto explicativo de las acciones de atención. Requerido si phase_name == 'Atendido'.
                
                - `status_name` (`str`): Nombre del estado destino.
                - `phase_name` (`Optional[str]`): Nombre de la fase destino.
        """
        now = timezone.now()

        # === CASO: Entrada a Confirmado -> Instanciar o actualizar AlertResult ===
        if status_name == "Confirmado":
            real_start_time = payload.get("real_start_time", now)
            
            # Ajustar la hora de inicio real en la Alerta Padre
            alert.start_time_utc = real_start_time
            alert.save()

            # === CASO: Fase 'En Proceso de Atención' ===
                # Creamos el resultado del reclamo
            result_obj, _ = AlertResult.objects.get_or_create(alert=alert)

                # Solo si el payload incluye explícitamente la evaluación de daños se actualiza
            if "has_damage" in payload:
                has_damage = payload.get("has_damage", False)
                damage_report = payload.get("damage_report", None)

                if has_damage and not damage_report:
                    raise ValidationError("❌ REQUISITO OBLIGATORIO: Si declara que existieron daños, debe incluir la descripción en el reporte.")

                result_obj.has_damage = has_damage
                result_obj.damage_report = damage_report
                result_obj.save()
        
        # === CASO: Fase 'Atendido' -> Cierre definitivo ===
        if phase_name == "Atendido":
            actions_taken = payload.get("taken_actions")
            if not actions_taken:
                raise ValidationError("❌ REQUISITO OBLIGATORIO: Debe registrar la descripción de las acciones tomadas para marcar como Atendido.")

            result_obj, _ = AlertResult.objects.get_or_create(alert=alert)
            result_obj.taken_actions = actions_taken
            result_obj.save()
            
            # === Marcar end_time_utc final en la Alerta ===
            alert.end_time_utc = now
            alert.save()