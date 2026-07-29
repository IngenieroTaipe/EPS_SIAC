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
    python manage.py seed_component_types
    python manage.py seed_criticalities
    python manage.py seed_operational_statuses
    python manage.py seed_physical_statuses
    python manage.py seed_components
    python manage.py seed_component_coords
    python manage.py seed_core_predictive
    python manage.py shell -c "from core_predictive.tasks import run_scheduled_gfs_download; result = run_scheduled_gfs_download(); print(result)"

    echo "=== [ROLE: API] Inicialización de Base de Datos Completada ==="
else
    echo "[ROLE: $CONTAINER_ROLE] Omitiendo migraciones/seeders (Delegado a la API)."
fi
echo "=== Inicialización completada. Arrancando servidor... ==="
exec "$@"