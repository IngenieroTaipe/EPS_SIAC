"""
    Management command para disparar MANUALMENTE una corrida GFS anterior.

    Uso típico (cold-start):
        Cuando el sistema acaba de desplegarse y solo existe UNA corrida
        COMPLETED en la DB (la "latest"), el endpoint `/window-18h/` recicla
        esa misma corrida como "previous" → el timeline muestra 18 slots pero
        los 6 HISTORIC están "duplicados" (mismos timestamps que los 6
        primeros FORECAST). Para tener un HISTORIC real hace falta una
        SEGUNDA corrida COMPLETED con `date_range_start` anterior.

    Esta command descarga + ingiere + clasifica una corrida NOAA específica
    (por defecto la inmediatamente anterior a la latest actual) y la persiste
    como GFSRequest COMPLETED. Reproduce exactamente el mismo pipeline que
    Celery (`run_scheduled_gfs_download` + `ForecastRainRequestService`),
    pero de forma síncrona y con un `request_code` arbitrario.

    Cómo invocar (desde WSL, dentro del contenedor `eps_siac_api`):

        docker exec -it eps_siac_api python manage.py seed_previous_run

    Parámetros opcionales:
        --run-hour 12      # fuerza el run 12Z de hoy (default: 6)
        --date 2026-08-05  # fuerza otra fecha (default: hoy UTC)
        --hours 12         # pasos horarios a descargar (default: GFS_TOTAL_HOURS_FORECAST)

    Ejemplo (correr el 12Z de hoy):
        docker exec -it eps_siac_api python manage.py seed_previous_run --run-hour 12

    Notas:
        - NOAA tarda ~3h36min en publicar `f012` desde el run. Si le pides
          el 18Z de hoy y todavía no lo publicó, fallará con ValidationError.
          Usa un run que ya exista en S3 (típicamente el 12Z o el 06Z).
        - La corrida generada queda en estado COMPLETED y el builder
          `/window-18h/` la usará automáticamente como "previous" la próxima
          vez que el endpoint sirva la ventana.
        - Es idempotente respecto al request_code: si ya existe COMPLETED,
          el `is_data_already_processed` del task devuelve SKIP; aquí
          omitimos esa verificación y forzamos el pipeline (porque se asume
          que el operador sabe lo que hace).
"""

from datetime import datetime, timedelta, timezone
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone as django_timezone

from core_predictive.constants import GFS_TOTAL_HOURS_FORECAST, GFS_RUN_HOURS
from core_predictive.services.request_factory import GFSRequestFactory
from core_predictive.services.forecast_orchestrator_service import ForecastRainRequestService


class Command(BaseCommand):
    help = (
        'Descarga + ingiere + clasifica MANUALMENTE una corrida GFS anterior '
        'para poblar el HISTORIC del timeline cuando solo existe una corrida '
        'COMPLETED en la DB (cold-start). Reproduce el mismo pipeline que '
        'Celery (`run_scheduled_gfs_download`) pero de forma síncrona.'
    )

    def add_arguments(self, parser):
        """ Argumentos opcionales para forzar un run/hora/fecha específicos. """
        parser.add_argument(
            '--run-hour',
            type=int,
            default=None,
            help='Hora UTC del run NOAA a forzar (0, 6, 12 o 18). '
                 'Default: el run inmediatamente anterior al actual.',
        )
        parser.add_argument(
            '--date',
            type=str,
            default=None,
            help='Fecha UTC del run en formato YYYY-MM-DD. '
                 'Default: hoy UTC (o ayer si el run anterior cruzó medianoche).',
        )
        parser.add_argument(
            '--hours',
            type=int,
            default=GFS_TOTAL_HOURS_FORECAST,
            help=f'Número de pasos horarios a descargar (default: {GFS_TOTAL_HOURS_FORECAST}).',
        )

    def handle(self, *args, **options):
        """ Orquesta la descarga manual y la persistencia en PostGIS. """

        # ──────────────────────────────────────────────────────────────
        # 1. Determinar el run NOAA objetivo (fecha + hora UTC)
        # ──────────────────────────────────────────────────────────────
        now_utc = django_timezone.now()

        run_hour = options['run_hour']
        if run_hour is None:
            # Default: el run inmediatamente anterior al actual.
            # Ej: si ahora son las 17 UTC (run actual = 12Z), el anterior = 06Z.
            current_hour = now_utc.hour
            previous_runs = [h for h in GFS_RUN_HOURS if h < current_hour]
            if previous_runs:
                run_hour = previous_runs[-1]
                # Si no hay run anterior hoy (current_hour < 6), tomar el 18Z de ayer.
                run_date = now_utc - timedelta(days=1) if not previous_runs else now_utc
            else:
                # Si ahora son las 0-5 UTC, el run anterior es el 18Z de ayer.
                run_hour = 18
                run_date = now_utc - timedelta(days=1)
        else:
            run_date = now_utc

        # Override de fecha si el usuario pasó --date
        if options['date']:
            try:
                run_date = datetime.strptime(options['date'], '%Y-%m-%d').replace(tzinfo=timezone.utc)
            except ValueError:
                raise CommandError(
                    f"Formato de fecha inválido: '{options['date']}'. "
                    f"Esperado: YYYY-MM-DD (ej. 2026-08-05)."
                )

        # Validar run_hour
        if run_hour not in GFS_RUN_HOURS:
            raise CommandError(
                f"run-hour inválido: {run_hour}. Valores válidos: {GFS_RUN_HOURS}."
            )

        # Construir el código y la fecha base del run NOAA
        date_str = run_date.strftime('%Y%m%d')
        run_time_str = f"{run_hour:02d}Z"
        request_code = f"AUTO_{date_str}_{run_time_str}"

        # El `now_utc` que pasamos al factory debe ser el instante de inicio
        # del run NOAA (para que `date_range_start` quede truncado al run-hour,
        # no al momento actual en que se ejecuta este comando).
        run_start_utc = run_date.replace(
            hour=run_hour,
            minute=0,
            second=0,
            microsecond=0,
        )

        total_hours = options['hours']

        # ──────────────────────────────────────────────────────────────
        # 2. Log de inicio
        # ──────────────────────────────────────────────────────────────
        self.stdout.write(
            self.style.MIGRATE_HEADING(
                f"\n{'=' * 70}\n"
                f"  Descarga MANUAL GFS — {request_code}\n"
                f"  Fecha run NOAA (UTC): {run_start_utc.isoformat()}\n"
                f"  Pasos horarios: {total_hours} (f001..f{total_hours:03d})\n"
                f"{'=' * 70}"
            )
        )

        # ──────────────────────────────────────────────────────────────
        # 3. Crear/Recuperar el GFSRequest en estado PENDING
        # ──────────────────────────────────────────────────────────────
        self.stdout.write("\n[1/4] Creando GFSRequest PENDING...")

        try:
            request_obj, var_id, phenom_id = GFSRequestFactory.get_or_create_pending_request(
                request_code=request_code,
                now_utc=run_start_utc,  # truncado al run-hour, no "ahora"
            )
        except Exception as e:
            raise CommandError(
                f"Error al crear GFSRequest para {request_code}: {e}"
            )

        self.stdout.write(
            f"  ✓ GFSRequest #{request_obj.id} — {request_obj.request_code} "
            f"(status={request_obj.status})"
        )

        # ──────────────────────────────────────────────────────────────
        # 4. Ejecutar el pipeline completo (descarga → ingest → clusters)
        # ──────────────────────────────────────────────────────────────
        self.stdout.write(
            f"\n[2/4] Iniciando pipeline (descarga NOAA → PostGIS → DBSCAN)..."
        )
        self.stdout.write(
            f"  Esto puede tardar 1-3 minutos (depende de NOAA y DBSCAN)."
        )

        orchestrator = ForecastRainRequestService(
            gfs_request_instance=request_obj,
            target_variable_id=var_id,
            natural_phenomena_id=phenom_id,
        )

        try:
            result = orchestrator.process_request(total_hours=total_hours)
        except Exception as e:
            # El orquestador ya marcó el request como FAILED internamente.
            raise CommandError(
                f"\nPipeline falló para {request_code}: {e}\n"
                f"Verifica que NOAA ya haya publicado el run (delay ~3h36min) "
                f"y que la fecha/hora sean correctas."
            )

        # ──────────────────────────────────────────────────────────────
        # 5. Reporte final
        # ──────────────────────────────────────────────────────────────
        self.stdout.write(
            self.style.SUCCESS(
                f"\n{'=' * 70}\n"
                f"  ✓ Corrida {request_code} COMPLETADA exitosamente\n"
                f"{'=' * 70}\n"
                f"  - request_id: {result.get('request_id')}\n"
                f"  - request_code: {result.get('request_code')}\n"
                f"  - status: {result.get('status')}\n"
                f"  - total_active_cells: {result.get('total_active_cells')}\n"
                f"  - file: {result.get('metrics', {}).get('file_name', '—')}\n"
                f"  - download_time: {result.get('metrics', {}).get('download_time_seconds', 0)}s\n"
                f"\n  El endpoint /window-18h/ ahora usará esta corrida como "
                f"'previous' (HISTORIC) si su fecha_range_start es anterior "
                f"a la 'latest' actual."
            )
        )