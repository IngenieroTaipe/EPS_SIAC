from django.urls import path, include
from rest_framework.routers import DefaultRouter

from authentication.views import UserViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    path('', include(router.urls)),
    path('', include('dj_rest_auth.urls')),  # Login, logout, user, password, etc.
]