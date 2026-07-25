from django.urls import path, include
from rest_framework import routers
from components.views import (
    CriticalityViewSet,
    ComponentTypeViewSet,
    OperationalStatusViewSet,
    PhysicalStatusViewSet,
    ComponentViewSet,
    ComponentCoordViewSet,
)

router = routers.DefaultRouter()

router.register(r'criticalities', CriticalityViewSet, basename='criticality')
router.register(r'component-types', ComponentTypeViewSet, basename='component-type')
router.register(r'operational-statuses', OperationalStatusViewSet, basename='operational-status')
router.register(r'physical-statuses', PhysicalStatusViewSet, basename='physical-status')
router.register(r'components', ComponentViewSet, basename='component')
router.register(r'component-coords', ComponentCoordViewSet, basename='component-coord')

urlpatterns = [
    path('', include(router.urls))
]