from django.urls import path, include
from rest_framework.routers import DefaultRouter
from alerts_management.views import (
    AlertStatusViewSet,
    AlertPhaseViewSet,
    AlertStatusPhaseViewSet,
    AlertViewSet, 
    AlertHistoryViewSet, 
    AlertNotificationViewSet,
    AlertResultViewSet
)

router = DefaultRouter()
router.register(r'alert-status', AlertStatusViewSet, basename='alert-status')
router.register(r'alert-phase', AlertPhaseViewSet, basename='alert-phase')
router.register(r'alert-status-phase', AlertStatusPhaseViewSet, basename='alert-status-phase')
router.register(r'alert', AlertViewSet, basename='alert')
router.register(r'alert-history', AlertHistoryViewSet, basename='alert-history')
router.register(r'alert-notification', AlertNotificationViewSet, basename='alert-notification')
router.register(r'alert-result', AlertResultViewSet, basename='alert-result')

urlpatterns = [
    path('', include(router.urls)),
]