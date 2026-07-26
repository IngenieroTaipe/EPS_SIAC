#!/bin/bash
set -e

echo "=== Empezando Inicialización ==="
echo "Esperando a PostgreSQL..."

echo "Aplicando Migraciones..."
python manage.py makemigrations
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
python manage.py seed_core_predictive

echo "=== Inicialización completada. Arrancando servidor... ==="
exec "$@"