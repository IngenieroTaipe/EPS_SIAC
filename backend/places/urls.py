from django.urls import path, include
from rest_framework import routers
from places.views import (
    DepartmentViewSet,
    ProvinceViewSet,
    DistrictViewSet,
    SectorViewSet
)

router = routers.DefaultRouter()
router.register(r'departments', DepartmentViewSet, basename='department')
router.register(r'provinces', ProvinceViewSet, basename='province')
router.register(r'districts', DistrictViewSet, basename='district')
router.register(r'sectors', SectorViewSet, basename='sector')

urlpatterns = [
    path('', include(router.urls))
]