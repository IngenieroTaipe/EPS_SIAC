from django.urls import path, include
from rest_framework import routers
from core_predictive.views import (
    GFSRequestViewSet,
    NaturalPhenomenaViewSet,
    VariableTypeViewSet,
    UnitsMeasurementViewSet,
    VariableViewSet,
    NaturalPhenomenasVariablesViewSet,
    ThresholdsNaturalPhenomenaViewSet,
    GFSActiveCellViewSet
)

router = routers.DefaultRouter()

router.register(r'gfs-requests', GFSRequestViewSet, basename='gfs-request')
router.register(r'gfs-active-cells', GFSActiveCellViewSet, basename='gfs-active-cells')
router.register(r'natural-phenomenas', NaturalPhenomenaViewSet, basename='natural-phenomenas')
router.register(r'variable-types', VariableTypeViewSet, basename='variable-type')
router.register(r'units-measurements', UnitsMeasurementViewSet, basename='units-measurement')
router.register(r'variables', VariableViewSet, basename='variable')
router.register(r'natural-phenomenas-variables', NaturalPhenomenasVariablesViewSet, basename='natural-phenomenas-variables')
router.register(r'thresholds-natural-phenomenas', ThresholdsNaturalPhenomenaViewSet, basename='thresholds-natural-phenomenas')

urlpatterns = [
    path('', include(router.urls))
]