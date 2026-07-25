from django.urls import path, include
from rest_framework.routers import DefaultRouter

from organization.views import (
    OrganicUnitViewSet,
    BranchViewSet,
    BranchesOrganicUnitViewSet,
    RolesUnitViewSet,
    MemberViewSet,
    WorkerViewSet
)

router = DefaultRouter()
router.register(r'branches', BranchViewSet, basename='branch')
router.register(r'organic-units', OrganicUnitViewSet, basename='organic-unit')
router.register(r'branches-organic-units', BranchesOrganicUnitViewSet, basename='branches-organic-unit')
router.register(r'workers', WorkerViewSet, basename='worker')
router.register(r'members', MemberViewSet, basename='member')
router.register(r'roles-units', RolesUnitViewSet, basename='roles-unit')

urlpatterns = [
    path('', include(router.urls)),
]