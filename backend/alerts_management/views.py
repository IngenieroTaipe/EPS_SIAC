from rest_framework import viewsets, filters, views, status, mixins
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import extend_schema_view, extend_schema, OpenApiResponse, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from datetime import timedelta
from django.utils import timezone

from alerts_management.services.alert_state_machine_service import AlertStateMachineService
from alerts_management.constants import MINIMUM_HOURS_TO_START_FILTER

from alerts_management.models import (
    AlertStatus,
    AlertPhase,
    AlertStatusPhase,
    Alert,
    AlertHistory,
    AlertNotification,
    AlertResult
)
from alerts_management.serializers import (
    AlertStatusSerializer,
    AlertPhaseSerializer,
    AlertStatusPhaseSerializer,
    AlertListSerializer,
    AlertListSerializer,
    AlertDetailSerializer,
    AlertHistorySerializer,
    AlertNotificationSerializer,
    AlertResultSerializer,
    AlertTransitionSerializer,
    AlertResultUpdateSerializer
)

@extend_schema_view(
    list=extend_schema(tags=['Alerts / AlertStatus'], summary="Listar Estados de las Alertas"),
    retrieve=extend_schema(tags=['Alerts / AlertStatus'], summary="Obtener detalle de un Estado de Alerta"),
    create=extend_schema(tags=['Alerts / AlertStatus'], summary="Registrar un nuevo Estado de Alerta"),
    update=extend_schema(tags=['Alerts / AlertStatus'], summary="Actualizar un Estado de Alerta"),
    partial_update=extend_schema(tags=['Alerts / AlertStatus'], summary="Actualizar parcialmente un Estado de Alerta"),
    destroy=extend_schema(tags=['Alerts / AlertStatus'], summary="Eliminar un Estado de Alerta")
)
class AlertStatusViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura para los Estados de las Alertas.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Nombre.
        - Permite el ordenamiento en base a campos como: Nombre    
    """
    permission_classes = [IsAuthenticated]
    queryset = AlertStatus.objects.all()
    serializer_class = AlertStatusSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        'name'
    ]
    search_fields = [
        'name'
    ]
    ordering_fields = [
        'name'
    ]
    ordering = ['id']


@extend_schema_view(
    list=extend_schema(tags=['Alerts / AlertPhase'], summary="Listar Fases de las Alertas"),
    retrieve=extend_schema(tags=['Alerts / AlertPhase'], summary="Obtener detalle de un Fase de Alerta"),
    create=extend_schema(tags=['Alerts / AlertPhase'], summary="Registrar un nuevo Fase de Alerta"),
    update=extend_schema(tags=['Alerts / AlertPhase'], summary="Actualizar un Fase de Alerta"),
    partial_update=extend_schema(tags=['Alerts / AlertPhase'], summary="Actualizar parcialmente un Fase de Alerta"),
    destroy=extend_schema(tags=['Alerts / AlertPhase'], summary="Eliminar un Fase de Alerta")
)
class AlertPhaseViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura para las Fases de las Alertas.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Nombre.
        - Permite el ordenamiento en base a campos como: Nombre    
    """
    permission_classes = [IsAuthenticated]
    queryset = AlertPhase.objects.all()
    serializer_class = AlertPhaseSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        'name'
    ]
    search_fields = [
        'name'
    ]
    ordering_fields = [
        'name'
    ]
    ordering = ['id']


@extend_schema_view(
    list=extend_schema(tags=['Alerts / AlertStatusPhase'], summary="Listar Fases y Estados de las Alertas"),
    retrieve=extend_schema(tags=['Alerts / AlertStatusPhase'], summary="Obtener detalle de un Fase y Estado de Alerta"),
    create=extend_schema(tags=['Alerts / AlertStatusPhase'], summary="Registrar un nuevo Fase y Estado de Alerta"),
    update=extend_schema(tags=['Alerts / AlertStatusPhase'], summary="Actualizar un Fase y Estado de Alerta"),
    partial_update=extend_schema(tags=['Alerts / AlertStatusPhase'], summary="Actualizar parcialmente un Fase y Estado de Alerta"),
    destroy=extend_schema(tags=['Alerts / AlertStatusPhase'], summary="Eliminar un Fase y Estado de Alerta")
)
class AlertStatusPhaseViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura para las Fases y Estados de las Alertas.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Nombre.
        - Permite el ordenamiento en base a campos como: Nombre    
    """
    permission_classes = [IsAuthenticated]
    serializer_class = AlertStatusPhaseSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        'alert_status',
        'alert_phase'
    ]
    search_fields = [
        'alert_status__name',
        'alert_phase__name'
    ]
    ordering_fields = [
        'alert_status__name',
        'alert_phase__name'
    ]
    ordering = ['id']

    def get_queryset(self):
        return AlertStatusPhase.objects.select_related(
            'alert_status',
            'alert_phase'
        ).all()

@extend_schema_view(
    list=extend_schema(
        tags=['Alerts / Alert'], 
        summary="Listar Alertas",
        parameters=[
            OpenApiParameter(
                name='upcoming_only', 
                type=OpenApiTypes.BOOL, 
                location=OpenApiParameter.QUERY, 
                description="Filtrar alertas que inician en 6 o más horas a partir de ahora."
            )
        ]
    ),
    retrieve=extend_schema(tags=['Alerts / Alert'], summary="Obtener detalle de una Alerta"),
    create=extend_schema(tags=['Alerts / Alert'], summary="Registrar una nueva Alerta"),
    update=extend_schema(tags=['Alerts / Alert'], summary="Actualizar una Alerta"),
    partial_update=extend_schema(tags=['Alerts / Alert'], summary="Actualizar parcialmente una Alerta"),
    destroy=extend_schema(tags=['Alerts / Alert'], summary="Eliminar una Alerta")
)
class AlertViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura para las Alertas.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Nombre.
        - Permite el ordenamiento en base a campos como: Nombre    
    """
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    

    filterset_fields = [
        'natural_phenomena'
    ]
    search_fields = [
        'natural_phenomena__name'
    ]
    ordering_fields = [
        'natural_phenomena__name'
    ]
    ordering = ['id']

    def get_queryset(self):
        qs = Alert.objects.select_related(
            'natural_phenomena'
        ).all() 

        upcoming_only = self.request.query_params.get('upcoming_only', 'false').lower() == 'true'
        if upcoming_only:
            threshold_time = timezone.now() + timedelta(hours=MINIMUM_HOURS_TO_START_FILTER)
            qs = qs.filter(start_time_utc__gte=threshold_time)
            
        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return AlertDetailSerializer

        return AlertListSerializer
        
@extend_schema_view(
    list=extend_schema(tags=['Alerts / AlertHistory'], summary="Listar Historial de Estados y Fases de las Alertas"),
    retrieve=extend_schema(tags=['Alerts / AlertHistory'], summary="Obtener detalle de un Historial de Estados y Fases de Alerta"),
    create=extend_schema(tags=['Alerts / AlertHistory'], summary="Registrar un nuevo Historial de Estados y Fases de Alerta"),
)
class AlertHistoryViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura para el Historial de Estados y Fases de las Alertas.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Nombre.
        - Permite el ordenamiento en base a campos como: Nombre    
    """
    permission_classes = [IsAuthenticated]
    http_method_name = ['get', 'post']
    serializer_class = AlertHistorySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        'alert',
        'status',
        'phase'
    ]
    search_fields = [
        'alert',
        'status',
        'phase'

        'alert__code',
    ]
    ordering_fields = [
        'alert',
        'status',
        'phase'
    ]
    ordering = ['id']

    def get_queryset(self):
        return AlertHistory.objects.select_related(
            'alert',
            'status',
            'phase'
        ).all() 

@extend_schema_view(
    list=extend_schema(tags=['Alerts / AlertNotification'], summary="Listar Notificaciones de las Alertas"),
    retrieve=extend_schema(tags=['Alerts / AlertNotification'], summary="Obtener detalle de una Notificación de Alerta"),
    create=extend_schema(tags=['Alerts / AlertNotification'], summary="Registrar una nueva Notificación de Alerta"),
    update=extend_schema(tags=['Alerts / AlertNotification'], summary="Actualizar una Notificación de Alerta"),
    partial_update=extend_schema(tags=['Alerts / AlertNotification'], summary="Actualizar parcialmente una Notificación de Alerta"),
    destroy=extend_schema(tags=['Alerts / AlertNotification'], summary="Eliminar una Notificación de Alerta")
)
class AlertNotificationViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura para las Notificaciones de las Alertas.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Nombre.
        - Permite el ordenamiento en base a campos como: Nombre    
    """
    permission_classes = [IsAuthenticated]
    http_method_name = ['get']
    serializer_class = AlertNotificationSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        'alert_history',
    ]
    search_fields = [
        'alert_history',
        'alert_history__alert__code'
    ]
    ordering_fields = [
        'alert_history',
        'alert_history__alert__code'
    ]
    ordering = ['id']

    def get_queryset(self):
        return AlertNotification.objects.select_related(
            'alert_history',
            'alert_history__alert'
        ).all() 

@extend_schema_view(
    list=extend_schema(tags=['Alerts / AlertResult'], summary="Listar Resultados de las Alertas"),
    retrieve=extend_schema(tags=['Alerts / AlertResult'], summary="Obtener detalle de un Resultado de Alerta"),
    create=extend_schema(tags=['Alerts / AlertResult'], summary="Registrar un nuevo Resultado de Alerta"),
    update=extend_schema(tags=['Alerts / AlertResult'], summary="Actualizar un Resultado de Alerta"),
    partial_update=extend_schema(tags=['Alerts / AlertResult'], summary="Actualizar parcialmente un Resultado de Alerta"),
    destroy=extend_schema(tags=['Alerts / AlertResult'], summary="Eliminar un Resultado de Alerta")
)
class AlertResultViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura para los Resultados de las Alertas.
        - Permite el uso de todos los métodos HTTP relacionados al CRUD (GET, CREATE, UPDATE, PATCH, DELETE). Los métodos de Lectura no requieren de autenticación, mientras que todos los demás métodos sí la requieren.
        - Los registros solo podrán ser eliminados si no tienen registros relacionados en otros modelos.
        - Permite la búsqueda en base a campos como: Nombre.
        - Permite el ordenamiento en base a campos como: Nombre    
    """
    permission_classes = [IsAuthenticated]
    serializer_class = AlertResultSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    
    filterset_fields = [
        'alert',
    ]
    search_fields = [
        'alert',
        'alert__code'
    ]
    ordering_fields = [
        'alert',
        'alert__code'
    ]
    ordering = ['alert']

    def get_queryset(self):
        return AlertResult.objects.select_related(
            'alert'
        ).all() 


class AlertTransitionViewSet(mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """
    ViewSet para actualizar el estado, fase y resultados de una Alerta (PUT / PATCH).
    """
    queryset = Alert.objects.all()
    serializer_class = AlertTransitionSerializer
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Actualizar reporte de daños y acciones tomadas",
        description=(
            "Permite modificar 'has_damage', 'damage_report' y 'taken_actions' "
            "exclusivamente para alertas en fase 'Atendido' dentro de las 48 horas posteriores al cierre."
        ),
        request=AlertResultUpdateSerializer,
        responses={
            200: OpenApiResponse(description="Reporte actualizado correctamente."),
            400: OpenApiResponse(description="Plazo de 48 horas superado o estado inválido."),
            404: OpenApiResponse(description="Resultado de alerta no encontrado.")
        }
    )
    def patial_update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        data = serializer.validated_data

        # === Extraer parámetros de actualización ===
        status_name = data.pop("status_name", None)
        phase_name = data.pop("phase_name", None)

        try:
            # Delegar la actualización de estado y campos de resultado al servicio de dominio
            AlertStateMachineService.transition_to_state_phase(
                alert=instance,
                status_name=status_name,
                phase_name=phase_name,
                user=request.user,
                payload=data
            )
            
            # Recargar la instancia con los campos actualizados
            instance.refresh_from_db()
            response_serializer = self.get_serializer(instance)
            
            return Response(response_serializer.data, status=status.HTTP_200_OK)

        except DjangoValidationError as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)

class AlertUpdateResultViewSet(mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """
    ViewSet para actualizar únicamente el resultado de una alerta (daños y acciones tomadas)
    dentro de la ventana de gracia de 2 días en fase 'Atendido'.
    """
    queryset = AlertResult.objects.all()
    serializer_class = AlertResultUpdateSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'alert_id'

    @extend_schema(
        summary="Transicionar estado/fase de la alerta",
        description=(
            "Actualiza el estado ('Confirmado', 'No Confirmado') y fase ('En Espera de Reporte', "
            "'En Proceso de Atención', 'Atendido') de una alerta, aplicando reglas FSM y efectos secundarios."
        ),
        request=AlertTransitionSerializer,
        responses={
            200: AlertTransitionSerializer,
            400: OpenApiResponse(description="Error de validación en FSM o payload inconsistente."),
            404: OpenApiResponse(description="Alerta no encontrada.")
        }
    )
    def partial_update(self, request, *args, **kwargs):
        alert_id = kwargs.get('alert_id')
        alert = get_object_or_404(Alert, pk=alert_id)
        result_instance = get_object_or_404(AlertResult, alert=alert)

        serializer = self.get_serializer(
            instance=result_instance,
            data=request.data,
            partial=True,
            context={'alert': alert}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response({
            "message": "Reporte de resultado actualizado correctamente dentro de la ventana de gracia.",
            "alert_code": alert.code,
            "has_damage": result_instance.has_damage,
            "damage_report": result_instance.damage_report,
            "taken_actions": result_instance.taken_actions
        }, status=status.HTTP_200_OK)