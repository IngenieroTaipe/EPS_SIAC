import type {
  BackendAlertListItem,
  BackendAlertDetail,
  BackendAlertMapItem,
  BackendOperationalUbigeo,
} from '@/services/apiAlerts';
import type { BackendBranch } from '@/services/apiOrganization';
import type {
  AlertaHistorica,
  EstadoAlertaHistorica,
  UmbralPrecipitacion,
} from './types';
import { ESTADOS_EN_MAPA, type Alerta, type EstadoAlerta } from '@/features/mapa/types/alerta';

// ============================================================================
// Mapeo de nombres del backend → slugs del frontend
// ============================================================================

/**
 * Mapea el nombre del estado/fase que devuelve el backend (puede venir en
 * mayúsculas, minúsculas o título) al slug que usa el frontend.
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
 * ThresholdsNaturalPhenomena) al slug que usa el frontend. El backend puede
 * anexar el nivel (ej. "MUY LLUVIOSO (Nivel 3)") — el match es por prefijo.
 */
const BACKEND_THRESHOLD_PREFIXES: Array<[string, UmbralPrecipitacion]> = [
  ['MODERADAMENTE LLUVIOSO', 'moderadamente-lluvioso'],
  ['EXTREMADAMENTE LLUVIOSO', 'extremadamente-lluvioso'],
  ['MUY LLUVIOSO', 'muy-lluvioso'],
  ['LLUVIOSO', 'lluvioso'],
];

function resolveEstado(backendName: string | undefined | null): EstadoAlertaHistorica {
  if (!backendName) return 'predicho';
  return BACKEND_STATUS_MAP[backendName.toUpperCase().trim()] ?? 'predicho';
}

function resolveUmbral(backendName: string | undefined | null): UmbralPrecipitacion {
  if (!backendName) return 'moderadamente-lluvioso';
  const u = backendName.toUpperCase().trim();
  for (const [prefix, slug] of BACKEND_THRESHOLD_PREFIXES) {
    if (u.startsWith(prefix)) return slug;
  }
  return 'moderadamente-lluvioso';
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
 * UBIGEOs afectados que aporta la alerta (`operational_ubigeos`).
 *
 * Reglas (según UX decidido):
 *   - Si ningún ubigeo está en una branch → devuelve '' (el sheet lo
 *     oculta porque la alerta no afecta a ninguna unidad operativa).
 *   - Si hay 1 branch → devuelve su nombre.
 *   - Si hay N branches → devuelve `'${primera} (y N más)'` con el
 *     recuento de las demás (compacto + informativo).
 */
export function resolveUnidadOperativa(
  ubigeos: string[],
  branchByUbigeo: Map<string, string>,
): string {
  if (!ubigeos.length) return '';

  // Se resuelven todos los ubigeos con una branch asociada, SIN duplicados
  // (varios ubigeos pueden mapear a la misma branch).
  const matches: string[] = [];
  const seen = new Set<string>();
  for (const ubigeo of ubigeos) {
    if (!ubigeo || seen.has(ubigeo)) continue;
    const branchName = branchByUbigeo.get(ubigeo);
    if (!branchName) continue;
    if (matches.includes(branchName)) continue;
    matches.push(branchName);
    seen.add(ubigeo);
  }

  if (matches.length === 0) return '';
  if (matches.length === 1) return matches[0];
  return `${matches[0]} (y ${matches.length - 1} más)`;
}

/**
 * Recolecta los UBIGEOs de las unidades operativas afectadas por la alerta
 * (campo `operational_ubigeos` directo del listado/detalle). Devuelve un
 * array único (sin duplicados).
 */
function collectOperationalUbigeos(
  ubigeos: BackendOperationalUbigeo[] | undefined,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of ubigeos ?? []) {
    if (!u?.ubigeo || seen.has(u.ubigeo)) continue;
    seen.add(u.ubigeo);
    out.push(u.ubigeo);
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
 * Contrato post-cambios del backend: el listado trae `status_name` y
 * `phase_name` top-level (ya NO trae `historic_alert`) y
 * `operational_ubigeos` directo (ya NO trae `alert_clusters`). El histórico
 * se sintetiza con el estado actual (1 entrada); el detalle completo vive
 * en el retrieve (`alert_history`) y se muestra en la vista de edición.
 */
export function mapAlertListToFrontend(
  item: BackendAlertListItem,
  branchByUbigeo?: Map<string, string>,
): AlertaHistorica {
  const estado = resolveEstadoFromStatusAndPhase(item.status_name, item.phase_name);

  // Unidad Operativa real: resuelta via ubigeo → branch.name.
  const ubigeos = collectOperationalUbigeos(item.operational_ubigeos);
  const unidadOperativa = branchByUbigeo
    ? resolveUnidadOperativa(ubigeos, branchByUbigeo)
    : '—';

  const fecha = item.start_time_local ?? new Date().toISOString();

  return {
    id: item.code,
    backendId: item.id,
    unidadOperativa,
    distrito: '', // No se muestra en el sheet; se ocultó para priorizar UO.
    estado,
    fenomeno: item.natural_phenomena_name ?? 'Precipitación',
    umbral: resolveUmbral(item.max_threshold),
    fechaCreacion: fecha,
    fechaNotificacion: fecha,
    fechaPrediccionInicio: fecha,
    fechaRealInicio: undefined,
    // El listado ya no trae historial: sintetizamos 1 entrada con el
    // estado actual (el sheet lo muestra como "Histórico (1)").
    historico: [{ estado, fecha }],
  };
}

/**
 * Mapea el detalle completo (`BackendAlertDetail`) al tipo `AlertaHistorica`.
 * Incluye `alert_history` (renombrado desde `historic_alert` por el
 * backend), UO desde `operational_ubigeos` y resultado/reportes.
 *
 * `branchByUbigeo` (opcional) permite resolver la Unidad Operativa real a
 * partir de los `operational_ubigeos[].ubigeo` del detalle. Si no se pasa,
 * `unidadOperativa` queda como '—' (la página de edición lo gestiona
 * cargando branches en paralelo).
 */
export function mapAlertDetailToFrontend(
  detail: BackendAlertDetail,
  branchByUbigeo?: Map<string, string>,
): AlertaHistorica {
  // El serializer de detalle NO expone `status`/`phase` top-level; el
  // estado actual viene en `alert_history[0]` (desc por created_at).
  const latest = detail.alert_history?.[0];
  const estado = latest
    ? resolveEstadoFromStatusAndPhase(latest.status_name, latest.phase_name)
    : 'predicho';

  // Reconstruir historial con timestamps reales de cada transición.
  const historico = (detail.alert_history ?? []).map((h) => ({
    estado: resolveEstadoFromStatusAndPhase(h.status_name, h.phase_name),
    fecha: h.created_at ?? detail.start_time_local ?? new Date().toISOString(),
  }));

  // UO desde operational_ubigeos (directo en el detalle).
  const ubigeos = collectOperationalUbigeos(detail.operational_ubigeos);
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

  // ── Fechas reales (no confundir con la hora del fenómeno) ──────────
  // Fecha de creación = `created_at` de la transición MÁS ANTIGUA del
  // historial (cuando la alerta NACIÓ — se generó la predicción).
  // `start_time_local` es la hora (futura) del fenómeno y NO sirve como
  // "cuándo se predijo": usaba a dar tiempos transcurridos negativos.
  // El backend entrega `alert_history` desc por created_at, pero
  // ordenamos explícitamente por robustez.
  const sortedHistory = [...(detail.alert_history ?? [])].sort((x, y) =>
    x.created_at < y.created_at ? -1 : x.created_at > y.created_at ? 1 : 0,
  );
  const fechaCreacion =
    sortedHistory[0]?.created_at ?? detail.start_time_local ?? new Date().toISOString();

  // Fecha de notificación = la `sent_at` MÁS ANTIGUA de las notificaciones
  // ya enviadas (las pendientes con sent_at null se ignoran).
  const sentDates = (detail.alert_notification ?? [])
    .map((n) => n.sent_at)
    .filter((s): s is string => !!s);
  const fechaNotificacion =
    sentDates.length > 0
      ? sentDates.reduce((min, s) => (s < min ? s : min))
      : fechaCreacion;

  return {
    id: detail.code,
    backendId: detail.id,
    unidadOperativa,
    distrito: '', // No se muestra en la UI; se ocultó para priorizar UO.
    estado,
    fenomeno: detail.natural_phenomena_name ?? 'Precipitación',
    umbral: resolveUmbral(detail.max_threshold),
    fechaCreacion,
    fechaNotificacion,
    // "Predicción inicio" = hora PREDICHA de la lluvia (GFS, hora en punto).
    fechaPrediccionInicio: detail.start_time_local ?? new Date().toISOString(),
    // "Inicio real del fenómeno" = hora reportada al CONFIRMAR (campo
    // propio del backend). Undefined si aún no fue confirmada → el sheet
    // oculta el campo.
    fechaRealInicio: detail.real_start_time_local ?? undefined,
    fechaFinalizacion: detail.end_time_local ?? undefined,
    historico: historico.length > 0
      ? historico
      : [{ estado, fecha: detail.start_time_local ?? new Date().toISOString() }],
    reporteDanos,
    reporteAcciones,
  };
}

// ============================================================================
// Adaptador del endpoint `/alerts/alerts/map` (visor cartográfico)
// ============================================================================

/**
 * Adaptador de la capa ligera de alertas para el mapa
 * (`GET /alerts/alerts/map/`). Un marker por alerta, posicionado en el
 * `representative_point` del clúster más severo (decisión del backend en
 * SQL — ya no se calcula el centroide en el frontend).
 *
 * El backend ya excluye del payload las alertas 'NO CONFIRMADO' y las
 * 'ATENDIDO' antiguas; el check local con `ESTADOS_EN_MAPA` es defensivo.
 */
export function adaptarAlertasMap(items: BackendAlertMapItem[]): Alerta[] {
  const alertas: Alerta[] = [];
  for (const it of items) {
    // `representative_point` es un GeoJSON Point DIRECTO: las coords van
    // top-level (`coordinates: [lng, lat]`), como emite `ST_AsGeoJSON` del
    // builder (el docstring del builder muestra un Feature, pero el SQL
    // real no lo envuelve). Tolerante a ambas formas por robustez.
    const rp = it.representative_point as
      | { type: string; coordinates?: [number, number] }
      | { type: string; geometry?: { coordinates?: [number, number] } }
      | null;
    const coords = rp
      ? ('coordinates' in rp && rp.coordinates) || ('geometry' in rp && rp.geometry?.coordinates) || null
      : null;
    if (!coords) continue;
    const [lng, lat] = coords;

    const estado = resolveEstadoFromStatusAndPhase(
      it.status_name,
      it.phase_name,
    ) as EstadoAlerta;

    // Defensivo: el SQL del backend ya filtra, pero re-chequeamos por si
    // el contrato evoluciona.
    if (!ESTADOS_EN_MAPA.has(estado)) continue;

    alertas.push({
      id: it.code,
      componenteId: '',
      estado,
      lat,
      lng,
      mensaje: `Intensidad: ${it.max_intensity_mm_h} mm/h`,
      nivel: it.max_threshold ?? it.natural_phenomena_name ?? 'Precipitación',
      fecha: it.start_time_local ?? new Date().toISOString(),
    });
  }
  return alertas;
}
