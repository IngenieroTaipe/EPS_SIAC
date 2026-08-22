import logging
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

from alerts_management.models import (
    Alert, AlertHistory, AlertStatusPhase, AlertStatus, AlertPhase,
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
                    - 'PREDICHO'
                    - 'EN ESPERA DE CONFIRMACIÓN'
                    - 'NO CONFIRMADO'
                    - 'CONFIRMADO'
                
                - `phase_name` (`Optional[str]`): Nombre de la fase objetivo
                    - 'EN ESPERA DE REPORTE'
                    - 'EN PROCESO DE ATENCIÓN'
                    - 'ATENDIDO'
                
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

        if status_name == "CONFIRMADO" and (not phase_name or phase_name == "SIN FASE"):
            phase_name = cls.DEFAULT_CONFIRMED_PHASE
            
        with transaction.atomic():
            # === Obtener estado/fase actual de la alerta ===
            current_history = AlertHistory.objects.filter(alert=alert).order_by('-created_at').first()

            if status_name == "CONFIRMADO" and (not phase_name or phase_name == "SIN FASE"):
                phase_name = 'EN ESPERA DE REPORTE'
            
            status, phase = cls._get_status_phase_instance(status_name, phase_name)

            # === Validar las reglas estrictas del diagrama de transición ===
            if current_history:
                if current_history.status == status and current_history.phase == phase:
                    logger.info(
                        f"[StateMachine] Alerta #{alert.code} ya se encuentra en "
                        f"Estado: '{status_name}' | Fase: '{phase_name}'. Se omite la inserción."
                    )
                    # Opcional: Aplicar efectos secundarios en caso de actualización de payload
                    if payload:
                        cls._apply_state_side_effects(alert=alert, status=status, phase=phase, payload=payload)
                    return current_history

                cls._validate_transition_rules(current_history, status, phase)

            # === Crear la nueva línea en el histórico de bitácora ===
            new_history = AlertHistory.objects.create(
                alert=alert,
                status=status,
                phase=phase,
                created_by=user
            )

            # === Aplicar efectos secundarios por estado (Efectos de Dominio) ===
            cls._apply_state_side_effects(alert, status, phase, payload)

            #  === Disparar la Notificación ===
            notification_obj = cls._create_notification(new_history)

            # CONEXIÓN ASÍNCRONA: Se dispara al cerrar el commit en PostgreSQL
            if notification_obj:
                from alerts_management.tasks import send_telegram_notification_task
                transaction.on_commit(
                    lambda: send_telegram_notification_task.apply_async(
                        args=[notification_obj.id],
                        countdown=1
                    )
                )

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
                    
        status = AlertStatus.objects.filter(name=status_name).first() if status_name else None
        phase = AlertPhase.objects.filter(name=phase_name).first() if phase_name else None

        return status, phase

    @classmethod
    def _validate_transition_rules(
        cls, 
        current_history: AlertHistory, 
        status: AlertStatus, 
        phase: AlertPhase | None = None
    ) -> None:
        """
        Evalúa la matriz de permisos de transición y ventanas temporales de inmutabilidad 
        del ciclo de vida, integrando Estado y Fase Operativa de manera atómica.

        `@params`:
            - `alert`: Instancia de la alerta (Alert).
            - `current_history` (`AlertHistory`): Registro histórico activo de la alerta.
            - `status_name` (`str`): Estado destino.
            - `phase_name` (`str | None`): Fase destino.
            - `payload` (`dict | None`): Metadatos adicionales de la transición.
        """
        current_status = (
            current_history.status.name 
            if current_history and current_history.status 
            else "DESCONOCIDO"
        )
        
        current_phase = (
            current_history.phase.name 
            if current_history and current_history.phase 
            else "SIN FASE"
        )
        now = timezone.now()

        status_name = status.name if status else None
        phase_name = phase.name if phase else None

        # =========================================================================
        # VALIDAR COMBINACIÓN
        # =========================================================================
        params = {"alert_status": status}
        if phase:
            params["alert_phase"] = phase

        if not AlertStatusPhase.objects.filter(**params).exists():
            raise ValidationError(f"❌ La combinación Estado '{status_name}' y Fase '{phase_name}' no está registrada en el sistema.")

        # =========================================================================
        # RESTRICCIONES DE ESTADO (STATUS RULES)
        # =========================================================================
        if current_status == "PREDICHO" and status_name != "EN ESPERA DE CONFIRMACIÓN":
            raise ValidationError(f"Una alerta en estado '{current_status}' solo puede pasar a estado 'EN ESPERA DE CONFIRMACIÓN'.")

        # Ventana de arrepentimiento estricta (2 horas)
        if current_status == "NO CONFIRMADO" and status_name == "CONFIRMADO":
            time_in_no_confirmed = now - current_history.created_at
            if time_in_no_confirmed > timedelta(hours=2):
                raise ValidationError("Se superó la ventana operativa de 2 horas para confirmar esta alerta.")

        # Inmutabilidad descendente desde estados confirmados
        if current_status == "CONFIRMADO" and status_name in ["NO CONFIRMADO", "PREDICHO", "EN ESPERA DE CONFIRMACIÓN"]:
            raise ValidationError(f"Una alerta en estado '{current_status}' no puede degradarse a '{status_name}'.")

        # =========================================================================
        # RESTRICCIONES DE FASE (PHASE RULES)
        # =========================================================================
        
        target_phase = phase_name or current_phase

        # Bloqueo de retroceso desde fase ATENDIDO
        if current_phase == "ATENDIDO" and target_phase != "ATENDIDO":
            raise ValidationError("Una alerta en fase 'ATENDIDO' no puede regresar a fases operativas previas.")

        # Inmutabilidad temporal de cierre (Cierre definitivo a los 2 días)
        if current_phase == "ATENDIDO":
            time_since_attended = now - current_history.created_at
            if time_since_attended > timedelta(days=2):
                raise ValidationError("El ciclo de la alerta está sellado. Se superó el plazo de 2 días para modificar reportes históricos.")

        # =========================================================================
        # RESTRICCIONES CRUZADAS (STATE-PHASE COUPLING)
        # =========================================================================
        
        # Un evento no puede cerrarse (ATENDIDO) si sigue siendo una mera predicción
        if target_phase == "ATENDIDO" and status_name in ["PREDICHO", "EN ESPERA DE CONFIRMACIÓN"]:
            raise ValidationError("No se puede mover la alerta a fase 'ATENDIDO' sin antes haberla confirmado o descartado.")


    @classmethod
    def _apply_state_side_effects(
        cls,
        alert: Alert,
        status: AlertStatus | None = None,
        phase: AlertPhase | None = None,
        payload: dict | None = None
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

        status_name = status.name if status else None
        phase_name = phase.name if phase else None

        # === CASO: Entrada a Confirmado -> Instanciar o actualizar AlertResult ===
        if status_name == "CONFIRMADO":
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
                    raise ValidationError("REQUISITO OBLIGATORIO: Si declara que existieron daños, debe incluir la descripción en el reporte.")

                result_obj.has_damage = has_damage
                result_obj.damage_report = damage_report
                result_obj.save()
        
        # === CASO: Fase 'Atendido' -> Cierre definitivo ===
        if phase_name == "ATENDIDO":
            actions_taken = payload.get("taken_actions")
            damage_report = payload.get("damage_report", None)

            if not actions_taken and damage_report is not None :
                raise ValidationError("REQUISITO OBLIGATORIO: Debe registrar la descripción de las acciones tomadas o el reporte de daños para marcar como Atendido.")

            result_obj, _ = AlertResult.objects.get_or_create(alert=alert)
            result_obj.taken_actions = actions_taken
            result_obj.save()
    
    @classmethod
    def _create_notification(cls, history: AlertHistory):        
        #  === Disparar la Notificación ===
        notification_type = cls._resolve_notification_type(history.status)
        
        if notification_type:
            # == Registrar ==
            notification_obj = AlertNotification.objects.create(
                alert_history=history,
                channel=NotificationChannel.TELEGRAM,
                notification_type=notification_type,
                is_sent=False,
                notification_reason=f"Cambio de estado a {history.status.name} | Fase: {history.alert_phase.name}"
            )

            return notification_obj

        return None
    
    @staticmethod
    def _resolve_notification_type(status: AlertStatus) -> str:
        """Determina el tipo de notificación según el estado alcanzado."""
        mapping = {
            "PREDICHO": NotificationType.INITIAL,
        }
        return mapping.get(status.name)