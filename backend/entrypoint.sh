#!/bin/bash
set -e

echo "=== Empezando Inicialización ==="
echo "Esperando a PostgreSQL..."

# === CONTROL DE ROL: Solo el contenedor API ejecuta migraciones y seeders ===
if [ "$CONTAINER_ROLE" = "api" ]; then
    echo "Aplicando Migraciones..."
    python manage.py makemigrations --noinput
    python manage.py migrate --noinput

    echo "Aplicando Seeders..."
    python manage.py seed_auths
    python manage.py seed_places
    python manage.py seed_geo_info
    python manage.py seed_organization
    python manage.py seed_component_types
    python manage.py seed_criticalities
    python manage.py seed_operational_statuses
    python manage.py seed_physical_statuses
    python manage.py seed_components
    python manage.py seed_component_coords
    python manage.py seed_core_predictive
    python manage.py seed_alerts_management
    # python manage.py seed_alerts
    #python manage.py shell -c "from core_predictive.tasks import run_scheduled_gfs_download; result = run_scheduled_gfs_download(); print(result)"

    # python manage.py shell -c "from alerts_management.tasks import dispatch_hourly_alerts_task; dispatch_hourly_alerts_task();"
    # python manage.py shell -c "from alerts_management.tasks import process_state_machine_timeouts_task; process_state_machine_timeouts_task();"
    # python manage.py shell -c "from alerts_management.tasks import process_forecast_and_adapt_alerts_task; result = process_forecast_and_adapt_alerts_task(1); print(result)"

    echo "=== [ROLE: API] Inicialización de Base de Datos Completada ==="
else
    echo "[ROLE: $CONTAINER_ROLE] Omitiendo migraciones/seeders (Delegado a la API)."
fi
echo "=== Inicialización completada. Arrancando servidor... ==="
exec "$@"
