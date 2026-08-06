from rest_framework import viewsets, permissions
from drf_spectacular.utils import extend_schema_view, extend_schema
from django.contrib.auth.models import User

from authentication.serializers import UserCreateSerializer


@extend_schema_view(
    list=extend_schema(tags=['Authentication / Users'], summary="Listar usuarios"),
    retrieve=extend_schema(tags=['Authentication / Users'], summary="Obtener detalle de un usuario"),
    create=extend_schema(tags=['Authentication / Users'], summary="Registrar un nuevo usuario"),
    update=extend_schema(tags=['Authentication / Users'], summary="Actualizar un usuario"),
    partial_update=extend_schema(tags=['Authentication / Users'], summary="Actualizar parcialmente un usuario"),
    destroy=extend_schema(tags=['Authentication / Users'], summary="Eliminar un usuario"),
)
class UserViewSet(viewsets.ModelViewSet):
    """
        Controlador de Lectura/Escritura para Usuarios.
        - Solo accesible por administradores (is_staff o is_superuser).
        - Permite gestionar el ciclo de vida de los usuarios del sistema y
          su asignación de grupos (roles).
        - El endpoint no reemplaza al login (dj-rest-auth) ni al perfil
          del propio usuario (`/auth/user/`); solo permite administración.
    """
    queryset = User.objects.all().order_by('id')
    serializer_class = UserCreateSerializer
    permission_classes = [permissions.IsAdminUser]
    http_method_names = ['get', 'post', 'patch', 'delete']