from rest_framework.permissions import BasePermission, SAFE_METHODS

class IsAdminUserOrReadOnly(BasePermission):
    """
        Clase de Permiso Personalizada:
        - Otorga acceso de LECTURA pública (GET, HEAD, OPTIONS) a cualquier usuario.
        - Otorga acceso de ESCRITURA (POST, PUT, PATCH, DELETE) únicamente a administradores (is_staff / is_superuser).
    """
    def has_permission(self, request, view):
        
        # === Habilitar lectura pública ===
        if request.method in SAFE_METHODS:
            return True

        # === Habilitar permiso ADMIN y STAFF ===
        return bool(
            request.user and 
            request.user.is_authenticated and 
            (request.user.is_staff or request.user.is_superuser)
        )