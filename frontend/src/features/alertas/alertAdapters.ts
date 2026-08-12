import type {
  BackendAlertListItem,
  BackendAlertDetail,
} from '@/services/apiAlerts';
import type { BackendBranch } from '@/services/apiOrganization';
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
export function resolveEstadoFromStatusAndPhase(
  status: string | undefined | null,
  phase: string | undefined | null,
): EstadoAlertaHistorica {
  const fromPhase = phase ? BACKEND_STATUS_MAP[phase.toUpperCase().trim()] : undefined;
  if (fromPhase && fromPhase !== 'predicho') return fromPhase;
  return resolveEstado(status);
}

// ============================================================================
// Helpers de Unidad Operativa (Branch) — ubigeo → nombre de la branch
// ============================================================================

/**
 * Construye un mapa `ubigeo → branch.name` a partir de la lista de branches
 * activas. La branch (Sucursal) representa una **Unidad Operativa** de la
 * EPS, asociada a un distrito (vía `district.ubigeo`).
 *
 * Solo se incluyen branches `status=true` (operativas) y cuyas `district`
 * venga como objeto `{ ubigeo, name }` (caso del `BranchSerializer` del
 * backend). Las branches con `district` como string plano se ignoran
 * (no se puede resolver el ubigeo).
 */
export function buildBranchByUbigeo(branches: BackendBranch[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const b of branches) {
    if (b.status === false) continue;
    if (typeof b.district === 'string') continue; // sin ubigeo resoluble
    if (!b.district?.ubigeo || !b.name) continue;
    map.set(b.district.ubigeo, b.name);
  }
  return map;
}

/**
 * Resuelve el label "Unidad Operativa" para una alerta a partir de los
 * UBIGEOs afectados que aporta la alerta.
 *
 * Reglas (según UX decidido):
 *   - Si ningún ubigeo está en una branch → devuelve '' (el sheet lo
 *     oculta porque la alerta no afecta a ninguna unidad operativa).
 *   - Si hay 1 branch → devuelve su nombre.
 *   - Si hay N branches → devuelve `'${primera} (y N más)'` con el
 *     recuento de las demás (compacto + informativo).
 *
 * Uso típico en `mapAlertListToFrontend(item, branchByUbigeo)`:
 *   ```
 *   const ubigeos = item.alert_clusters.flatMap((c) =>
 *     c.affected_ubigeos?.map((u) => u.ubigeo).filter(Boolean) ?? [],
 *   );
 *   const unidadOperativa = resolveUnidadOperativa(ubigeos, branchByUbigeo);
 *   ```
 */
export function resolveUnidadOperativa(
  ubigeos: string[],
  branchByUbigeo: Map<string, string>,
): string {
  if (!ubigeos.length) return '';

  // Se resuelven todos los ubigeos con una branch asociada, SIN duplicados
  // (varios clusters pueden afectar el mismo ubigeo).
  const matches: string[] = [];
  const seen = new Set<string>();
  for (const ubigeo of ubigeos) {
    if (!ubigeo || seen.has(ubigeo)) continue;
    const branchName = branchByUbigeo.get(ubigeo);
    if (!branchName) continue;
    // Evita duplicados también por nombre: un ubigeo distinto puede mapear
    // a la misma branch si la branch cubre varios distritos. En la práctica
    // esto no ocurre (1 distrito = 1 nombre único de branch) pero seguro:
    if (matches.includes(branchName)) continue;
    matches.push(branchName);
    seen.add(ubigeo);
  }

  if (matches.length === 0) return '';
  if (matches.length === 1) return matches[0];
  return `${matches[0]} (y ${matches.length - 1} más)`;
}

/**
 * Recolecta los UBIGEOs afectados por todos los clusters de un item de
 * alerta del backend (campo `affected_ubigeos` que entrega el
 * `AlertListSerializer`). Devuelve un array único (sin duplicados).
 */
function collectAffectedUbigeos(item: BackendAlertListItem): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const cluster of item.alert_clusters ?? []) {
    for (const u of cluster.affected_ubigeos ?? []) {
      if (!u?.ubigeo || seen.has(u.ubigeo)) continue;
      seen.add(u.ubigeo);
      out.push(u.ubigeo);
    }
  }
  return out;
}

// ============================================================================
// Adaptadores: Backend → Frontend
// ============================================================================

/**
 * Mapea un item del listado (`BackendAlertListItem`) al tipo `AlertaHistorica`
 * que consumen la tabla y el panel del mapa.
 *
 * Usa `historic_alert` (la bitácora de transiciones que regresa el listado)
 * para derivar el estado actual de la alerta y reconstruir el histórico
 * completo con timestamps reales. Antes se hardcodeaba `predicho`, lo que
 * falseaba tanto el chip de estado en el tabular como el icono del marker
 * y el listado "Histórico de estados" del `AlertaDetailSheet`.
 *
 * El detalle del backend (`AlertDetailSerializer`) incluye distritos y
 * reportes extra; este adapter solo usa lo que viene en el listado. Si
 * el usuario necesita el resto, hace clic en "Editar alerta" y se carga
 * el detalle.
 */
export function mapAlertListToFrontend(
  item: BackendAlertListItem,
  branchByUbigeo?: Map<string, string>,
): AlertaHistorica {
  // El backend ordena `historic_alert` desc por `created_at`; el primer
  // item es el estado actual. Si por algum motivo está vacío, caemos a
  // `predicho` (valor por defecto del adapter).
  const latest = item.historic_alert?.[0];
  const estado = latest
    ? resolveEstadoFromStatusAndPhase(latest.status_name, latest.phase_name)
    : 'predicho';

  // Reconstruir el histórico con timestamps reales del backend.
  const historico = (item.historic_alert ?? []).map((h) => ({
    estado: resolveEstadoFromStatusAndPhase(h.status_name, h.phase_name),
    fecha: h.created_at,
  }));

  // Unidad Operativa real: resuelta via ubigeo → branch.name.
  // Si la alerta no afecta a ninguna branch (ningún distrito afectado
  // está habilitado como UO), devolvemos '' para que el sheet lo oculte.
  const ubigeos = collectAffectedUbigeos(item);
  const unidadOperativa = branchByUbigeo
    ? resolveUnidadOperativa(ubigeos, branchByUbigeo)
    : '—';

  return {
    id: item.code,
    backendId: item.id,
    unidadOperativa,
    distrito: '', // No se muestra en el sheet; se ocultó para priorizar UO.
    estado,
    fenomeno: item.natural_phenomena_name ?? 'Precipitación',
    umbral: resolveUmbral(item.max_threshold),
    fechaCreacion: item.start_time_local ?? new Date().toISOString(),
    fechaNotificacion: item.start_time_local ?? new Date().toISOString(),
    fechaPrediccionInicio: item.start_time_local ?? new Date().toISOString(),
    fechaRealInicio: undefined,
    historico: historico.length > 0
      ? historico
      : [{ estado, fecha: item.start_time_local ?? new Date().toISOString() }],
  };
}

/**
 * Mapea el detalle completo (`BackendAlertDetail`) al tipo `AlertaHistorica`.
 * Incluye status, phase, historial, resultado y fenómeno.
 *
 * `branchByUbigeo` (opcional) permite resolver la Unidad Operativa real a
 * partir de los `affected_districts[].ubigeo` que vienen en cada cluster
 * del detalle. Si no se pasa, `unidadOperativa` queda como '—' (la página
 * de edición lo gestiona cargando branches en paralelo).
 */
export function mapAlertDetailToFrontend(
  detail: BackendAlertDetail,
  branchByUbigeo?: Map<string, string>,
): AlertaHistorica {
  // El serializer de detalle del backend NO expone `status`/`phase` a nivel
  // top-level (ver `AlertDetailSerializer.Meta.fields`); solo vienen dentro
  // de `historic_alert[]` ordenado desc por `created_at`. El primer item
  // representa el estado actual → lo usamos para derivar `estado`.
  // El fallback 'predicho' es solo para el caso (teóricamente imposible)
  // en que llegue un detalle sin histórico.
  const latest = detail.historic_alert?.[0];
  const estado = latest
    ? resolveEstadoFromStatusAndPhase(latest.status_name, latest.phase_name)
    : 'predicho';

  // Reconstruir historial a partir de historic_alert (con timestamp real de cada transición).
  const historico = (detail.historic_alert ?? []).map((h) => ({
    estado: resolveEstadoFromStatusAndPhase(h.status_name, h.phase_name),
    fecha: h.created_at ?? detail.start_time_local ?? new Date().toISOString(),
  }));

  // Recolectar UBIGEOs afectados por todos los clusters del detalle.
  // Cada cluster trae `affected_districts: [{ ubigeo, name }, ...]`.
  const ubigeos: string[] = [];
  const seen = new Set<string>();
  for (const c of detail.clusters ?? []) {
    for (const d of c.affected_districts ?? []) {
      if (!d?.ubigeo || seen.has(d.ubigeo)) continue;
      seen.add(d.ubigeo);
      ubigeos.push(d.ubigeo);
    }
  }

  // Resolver Unidad Operativa via branches. Si no hay branches cargadas,
  // dejamos '—' para que la UI muestre el placeholder clásico (la página
  // de edición normalmente pasa branches reales, así que rara vez cae aquí).
  const unidadOperativa = branchByUbigeo
    ? resolveUnidadOperativa(ubigeos, branchByUbigeo)
    : '—';

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
    backendId: detail.id,
    unidadOperativa,
    distrito: '', // No se muestra en la UI; se ocultó para priorizar UO.
    estado,
    fenomeno: detail.natural_phenomena_name ?? 'Precipitación',
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
