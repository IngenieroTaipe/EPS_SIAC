from typing import Optional, Dict, Any
from django.core.cache import cache

class GISCacheManager:
    """
        La clase nos permite la gestión de datos en Caché.
        Responsabilidad: Abstraer la persistencia temporal en Caché (En el proyecto el gestor de caché es Redis).
    """

    @staticmethod
    def get(key: str) -> Optional[Dict[str, Any]]:
        return cache.get(key)

    @staticmethod
    def set(key: str, value: Dict[str, Any], timeout_seconds: int = 21600) -> None:
        cache.set(key, value, timeout=timeout_seconds)

    @staticmethod
    def invalidate(key: str) -> None:
        cache.delete(key)