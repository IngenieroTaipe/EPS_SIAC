import os
from celery import Celery

# === Establece la variable de entorno predeterminada para la configuración de Django ===
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'EPS_SelvaCentral.settings')

# === Instancia la aplicación Celery ===
app = Celery('EPS_SelvaCentral')

# === Configuración del Celery ===
app.config_from_object('django.conf:settings', namespace='CELERY')

# === Descubre automáticamente archivos 'tasks.py' dentro de todas las aplicaciones ===
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """
        Tarea de diagnóstico para verificar la conectividad del Broker.
    """
    print(f'Request Diagnóstico: {self.request!r}')