import type {
  BackendAlertListItem,
  BackendAlertDetail,
} from '@/services/apiAlerts';
import type {
  AlertaHistorica,
  EstadoAlertaHistorica,
  UmbralPrecipitacion,
} from './types';

// ============================================================================
// Mapeo de nombres del backend → slugs del frontend
// ============================================================================

/**
 * Mapea el nombre del estado/fase que devuelve el backend (puede venir en
 * mayúsculas, minúsculas o título) al slug que usa el frontend.
 *
 * El backend devuelve `status` y `phase` como strings a partir del
 * `AlertDetailSerializer.get_status()` / `get_phase()`, que leen el
 * `AlertHistory.status.name` más reciente. Los nombres en BD son los
 * definidos en el seeder (normalmente en mayúsculas: "PREDICHO", etc.).
 */
const BACKEND_STATUS_MAP: Record<string, EstadoAlertaHistorica> = {
  'PREDICHO':                   'predicho',
  'EN ESPERA DE CONFIRMACIÓN':  'en-espera-confirmacion',
  'EN ESPERA DE CONFIRMACION':  'en-espera-confirmacion', // variante sin tilde
  'NO CONFIRMADO':              'no-confirmado',
  'CONFIRMADO':                 'confirmado',
  'EN ESPERA DE REPORTE':       'en-espera-reporte',
  'EN PROCESO DE ATENCIÓN':     'en-proceso-atencion',
  'EN PROCESO DE ATENCION':     'en-proceso-atencion', // variante sin tilde
  'ATENDIDO':                   'atendido',
};

/**
 * Mapea el nombre del umbral devuelto por el backend (StringRelatedField del
 * ThresholdsNaturalPhenomena) al slug que usa el frontend.
 */
const BACKEND_THRESHOLD_MAP: Record<string, UmbralPrecipitacion> = {
  'MODERADAMENTE LLUVIOSO': 'moderadamente-lluvioso',
  'LLUVIOSO':               'lluvioso',
  'MUY LLUVIOSO':           'muy-lluvioso',
  'EXTREMADAMENTE LLUVIOSO':'extremadamente-lluvioso',
};

function resolveEstado(backendName: string | undefined | null): EstadoAlertaHistorica {
  if (!backendName) return 'predicho';
  return BACKEND_STATUS_MAP[backendName.toUpperCase().trim()] ?? 'predicho';
}

function resolveUmbral(backendName: string | undefined | null): UmbralPrecipitacion {
  if (!backendName) return 'moderadamente-lluvioso';
  return BACKEND_THRESHOLD_MAP[backendName.toUpperCase().trim()] ?? 'moderadamente-lluvioso';
}

/**
 * Combina status + phase del backend para derivar el EstadoAlertaHistorica
 * más preciso. El backend separa estado ("CONFIRMADO" / "NO CONFIRMADO") y
 * fase ("EN ESPERA DE REPORTE", "EN PROCESO DE ATENCIÓN", "ATENDIDO").
 *
 * Regla:
 *   - Si phase mapea a algo distinto de 'predicho', usamos la fase (es más granular).
 *   - Si no, usamos el status.
 */
function resolveEstadoFromStatusAndPhase(
  status: string | undefined | null,
  phase: string | undefined | null,
): EstadoAlertaHistorica {
  const fromPhase = phase ? BACKEND_STATUS_MAP[phase.toUpperCase().trim()] : undefined;
  if (fromPhase && fromPhase !== 'predicho') return fromPhase;
  return resolveEstado(status);
}

// ============================================================================
// Adaptadores: Backend → Frontend
// ============================================================================

/**
 * Mapea un item del listado (`BackendAlertListItem`) al tipo `AlertaHistorica`
 * que consumen la tabla y el panel del mapa.
 *
 * El listado NO incluye status/phase/result/historic, así que usamos valores
 * por defecto (predicho, sin historial). Para ver los datos completos, el
 * usuario hace clic en "editar" y se carga el detalle.
 */
export function mapAlertListToFrontend(item: BackendAlertListItem): AlertaHistorica {
  const district = '—'; // El listado no incluye distritos; se muestra al ver detalle.

  return {
    id: item.code,
    unidadOperativa: '—', // No disponible en listado
    distrito: district,
    estado: 'predicho', // El listado no tiene status; se asume predicho
    fenomeno: 'Precipitación',
    umbral: resolveUmbral(item.max_threshold),
    fechaCreacion: item.start_time_local ?? new Date().toISOString(),
    fechaNotificacion: item.start_time_local ?? new Date().toISOString(),
    fechaPrediccionInicio: item.start_time_local ?? new Date().toISOString(),
    fechaRealInicio: undefined,
    historico: [{ estado: 'predicho', fecha: item.start_time_local ?? new Date().toISOString() }],
  };
}

/**
 * Mapea el detalle completo (`BackendAlertDetail`) al tipo `AlertaHistorica`.
 * Incluye status, phase, historial, resultado y fenómeno.
 */
export function mapAlertDetailToFrontend(detail: BackendAlertDetail): AlertaHistorica {
  const estado = resolveEstadoFromStatusAndPhase(detail.status, detail.phase);

  // Reconstruir historial a partir de historic_alert
  const historico = (detail.historic_alert ?? []).map((h) => ({
    estado: resolveEstadoFromStatusAndPhase(h.status_name, h.phase_name),
    fecha: detail.start_time_local ?? new Date().toISOString(),
  }));

  // Extraer distrito del primer cluster con affected_districts
  const distrito = detail.clusters?.[0]?.affected_districts?.[0] ?? '—';

  // Mapear resultado
  let reporteDanos;
  let reporteAcciones;

  if (detail.result) {
    reporteDanos = {
      descripcion: detail.result.damage_report ?? '',
      huboDanos: detail.result.has_damage ?? false,
      fechaRegistro: detail.start_time_local ?? new Date().toISOString(),
    };
    if (detail.result.taken_actions) {
      reporteAcciones = {
        descripcion: detail.result.taken_actions,
        fechaFinalizacion: detail.end_time_local ?? new Date().toISOString(),
      };
    }
  }

  return {
    id: detail.code,
    unidadOperativa: distrito, // Usamos distrito como unidad operativa (mejor aproximación)
    distrito,
    estado,
    fenomeno: detail.natural_phenomena?.name ?? 'Precipitación',
    umbral: resolveUmbral(detail.max_threshold),
    fechaCreacion: detail.start_time_local ?? new Date().toISOString(),
    fechaNotificacion: detail.start_time_local ?? new Date().toISOString(),
    fechaPrediccionInicio: detail.start_time_local ?? new Date().toISOString(),
    fechaRealInicio: detail.start_time_local ?? undefined,
    fechaFinalizacion: detail.end_time_local ?? undefined,
    historico: historico.length > 0
      ? historico
      : [{ estado, fecha: detail.start_time_local ?? new Date().toISOString() }],
    reporteDanos,
    reporteAcciones,
  };
}
