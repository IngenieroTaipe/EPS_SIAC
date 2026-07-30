from django.urls import path, include
from rest_framework.routers import DefaultRouter
from alerts_management.views import (
    AlertStatusViewSet,
    AlertPhaseViewSet,
    AlertViewSet, 
    AlertTransitionViewSet,
    AlertUpdateResultViewSet
)

router = DefaultRouter()
router.register(r'statuses', AlertStatusViewSet, basename='alert-status')
router.register(r'phases', AlertPhaseViewSet, basename='alert-phase')
router.register(r'alerts', AlertViewSet, basename='alert')
router.register(r'transitions', AlertTransitionViewSet, basename='alert-transition')
router.register(r'update-results', AlertUpdateResultViewSet, basename='alert-update-result')

urlpatterns = [
    path('', include(router.urls)),
]