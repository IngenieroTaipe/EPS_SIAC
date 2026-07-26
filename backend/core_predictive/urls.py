from django.urls import path, include
from rest_framework import routers
from core_predictive.views import (
    EMCWFRequestViewSet,
    NaturalPhenomenaViewSet,
    VariableTypeViewSet,
    UnitsMeasurementViewSet,
    VariableViewSet,
    NaturalPhenomenasVariablesViewSet,
    ThresholdsNaturalPhenomenasViewSet
)

router = routers.DefaultRouter()

router.register(r'emcwf-requests', EMCWFRequestViewSet, basename='emcwf-request')
router.register(r'natural-phenomenas', NaturalPhenomenaViewSet, basename='natural-phenomenas')
router.register(r'variable-types', VariableTypeViewSet, basename='variable-type')
router.register(r'units-measurements', UnitsMeasurementViewSet, basename='units-measurement')
router.register(r'variables', VariableViewSet, basename='variable')
router.register(r'natural-phenomenas-variables', NaturalPhenomenasVariablesViewSet, basename='natural-phenomenas-variables')
router.register(r'thresholds-natural-phenomenas', ThresholdsNaturalPhenomenasViewSet, basename='thresholds-natural-phenomenas')

urlpatterns = [
    path('', include(router.urls))
]