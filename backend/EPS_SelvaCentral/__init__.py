# Aseguramos que celery se instancie siempre que django arranque
from .celery import app as celery_app

__all__ = ('celery_app',)