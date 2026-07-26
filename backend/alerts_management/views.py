from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema_view, extend_schema
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
    AlertSerializer,
    AlertHistorySerializer,
    AlertNotificationSerializer,
    AlertResultSerializer,
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
    list=extend_schema(tags=['Alerts / Alert'], summary="Listar Alertas"),
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
    serializer_class = AlertSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        'natural_phenomena',
        'branch'
    ]
    search_fields = [
        'natural_phenomena__name',
        'branch__name'
    ]
    ordering_fields = [
        'natural_phenomena__name',
        'branch__name' 
    ]
    ordering = ['id']

    def get_queryset(self):
        return Alert.objects.select_related(
            'natural_phenomena',
            'branch'
        ).all() 

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
        'alert_status_phase'
    ]
    search_fields = [
        'alert',
        'alert_status_phase'

        'alert__code',
    ]
    ordering_fields = [
        'alert',
        'alert_status_phase'
    ]
    ordering = ['id']

    def get_queryset(self):
        return AlertHistory.objects.select_related(
            'alert',
            'alert_status_phase'
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