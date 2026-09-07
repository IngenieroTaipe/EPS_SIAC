import { httpClient } from './httpClient';
import { cachedGet, invalidateCachePrefix } from './requestCache';

// ============================================================================
// Helpers de paginación (consistentes con apiComponentes.ts)
// ============================================================================

interface PaginatedResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

// ============================================================================
// INTERFACES — Respuesta del listado (AlertListSerializer)
// ============================================================================

/** Entrada del historial de una alerta (subserializador AlertHistorySecondary). */
export interface BackendAlertHistoryEntry {
  status_name: string;
  phase_name: string;
  created_at: string;
}

/**
 * Ubigeo + nombre legible de una unidad operativa afectada por una alerta.
 * Viene DIRECTO en el listado y detalle (contrato post-cambios: antes vivía
 * anidado en `alert_clusters[].affected_ubigeos`, que ya no se expone).
 */
export interface BackendOperationalUbigeo {
  ubigeo: string;
  name: string | null;
}

export interface BackendAlertListItem {
  id: number;
  code: string;
  /** Nombre del fenómeno natural asociado (puede llegar nulo). */
  natural_phenomena_name: string | null;
  max_intensity_mm_h: number;
  max_threshold: string;
  /** Estado actual de la alerta (top-level; ya NO viene en historic_alert). */
  status_name: string | null;
  /** Fase actual de la alerta (top-level). */
  phase_name: string | null;
  start_time_local: string | null;
  end_time_local: string | null;
  /** Unidades operativas afectadas (ubigeo + nombre), directo. */
  operational_ubigeos: BackendOperationalUbigeo[];
}

// ============================================================================
// INTERFACES — Respuesta del detalle (AlertDetailSerializer)
// ============================================================================

export interface BackendAlertResult {
  has_damage: boolean;
  damage_report: string | null;
  taken_actions: string | null;
}

/** Notificación enviada por el historial de una alerta (telegram, etc.).
 *  `sent_at` puede ser null (notificación pendiente de envío). */
export interface BackendAlertNotification {
  channel: string;
  notification_type: string;
  sent_at: string | null;
}

export interface BackendAlertDetail {
  id: number;
  code: string;
  /**
   * El `AlertDetailSerializer` actual NO expone `status`/`phase` a nivel
   * top-level (solo dentro de `alert_history[]`). Estos campos se
   * declaran como opcionales para no romper el tipo si el backend los
   * reincorpora en el futuro; el adapter deriva el estado actual
   * directamente desde `alert_history[0]`.
   */
  status?: string;
  phase?: string;
  max_intensity_mm_h: number;
  max_threshold: string;
  /** Hora PREDICHA de inicio de la lluvia (hora del fenómeno, GFS). */
  start_time_local: string | null;
  end_time_local: string | null;
  /**
   * Hora REAL de inicio del fenómeno (reportada al CONFIRMAR la alerta).
   * Null si aún no fue confirmada — el sheet sólo muestra "Inicio real
   * del fenómeno" cuando existe.
   */
  real_start_time_local?: string | null;
  /** Unidades operativas afectadas (ubigeo + nombre), directo. */
  operational_ubigeos: BackendOperationalUbigeo[];
  /**
   * Historial de transiciones (ordenado desc por `created_at`). Antes se
   * llamaba `historic_alert`; renombrado por el backend.
   */
  alert_history: BackendAlertHistoryEntry[];
  /** Historial de notificaciones enviadas (nuevo, post-cambios). */
  alert_notification: BackendAlertNotification[];
  result: BackendAlertResult | null;
  /** El backend expone el nombre del fenómeno como texto (SlugRelatedField). */
  natural_phenomena_name: string | null;
}

// ============================================================================
// Endpoint `/alerts/alerts/map` — capa ligera para el visor cartográfico
// ============================================================================

/**
 * Item del endpoint `GET /alerts/alerts/map/` (array plano, sin paginación,
 * compilado en PostgreSQL). Pensado para el mapa: trae el
 * `representative_point` del clúster más severo de cada alerta.
 *
 * `representative_point` es un GeoJSON **Point directo** con
 * `coordinates: [lng, lat]` top-level (lo que emite `ST_AsGeoJSON` del SQL
 * del builder — ver `cambios.md`). OJO: el docstring del builder muestra
 * un Feature con `geometry` adentro, pero NO coincide con el SQL real.
 */
export interface BackendAlertMapItem {
  id: number;
  code: string;
  natural_phenomena_name: string | null;
  /** TO_CHAR de Postgres → string con 2 decimales (ej. "8.00"). */
  max_intensity_mm_h: string;
  max_threshold: string | null;
  status_name: string | null;
  phase_name: string | null;
  start_time_local: string | null;
  end_time_local: string | null;
  representative_point: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat] top-level
  } | null;
}

// ============================================================================
// INTERFACES — Payloads de escritura
// ============================================================================

export interface AlertTransitionPayload {
  /**
   * Estados y fases en MAYÚSCULAS (cambio del backend: el ChoiceField
   * ahora valida contra los nombres del seeder en upper-case).
   */
  status_name?: 'CONFIRMADO' | 'NO CONFIRMADO';
  phase_name?: 'EN ESPERA DE REPORTE' | 'EN PROCESO DE ATENCIÓN' | 'ATENDIDO';
  /** Fecha real de inicio del fenómeno (ISO-8601 UTC). Solo con CONFIRMADO. */
  real_start_time?: string;
  has_damage?: boolean;
  damage_report?: string;
  taken_actions?: string;
}

export interface AlertUpdateResultPayload {
  has_damage?: boolean;
  damage_report?: string;
  taken_actions?: string;
}

// ============================================================================
// API SERVICE
// ============================================================================

export const apiAlerts = {
  /**
   * Obtener lista de alertas recorriendo TODAS las páginas del backend.
   * El backend devuelve un array plano o una respuesta paginada con
   * `next` (URL de la siguiente página). `unwrap` maneja ambos casos;
   * aquí iteramos `next` hasta agotar resultados para reunir todas las
   * alertas en un solo array (el tabular de histórico necesita verlas
   * todas, incluyendo las no-confirmadas que no aparecen en el mapa).
   */
  async listAlerts(): Promise<BackendAlertListItem[]> {
    const all: BackendAlertListItem[] = [];
    let url: string | null = '/alerts/alerts/';
    // Mientras haya una página siguiente, la seguimos (patrón del
    // `listComponents` de apiComponentes.ts).
    while (url) {
      const res = await httpClient.get(url);
      const data = res.data as BackendAlertListItem[] | PaginatedResponse<BackendAlertListItem>;
      if (Array.isArray(data)) {
        all.push(...data);
        url = null;
      } else {
        all.push(...(data.results ?? []));
        url = data.next ?? null;
      }
    }
    return all;
  },

  /**
   * Capa ligera para el visor cartográfico: `GET /alerts/alerts/map/`.
   * Array plano (sin paginación) compilado en PostgreSQL con el
   * `representative_point` del clúster más severo de cada alerta activa.
   * El backend ya excluye 'NO CONFIRMADO' y las ATENDIDO con más de
   * MAXIMUM_DAYS_TO_SHOW_ATTENDED_ALERTS días.
   */
  async listAlertsForMap(): Promise<BackendAlertMapItem[]> {
    const res = await httpClient.get<BackendAlertMapItem[]>('/alerts/alerts/map/');
    return Array.isArray(res.data) ? res.data : [];
  },

  /**
   * Obtener detalle de una alerta por `id` (PK numérica del backend).
   * El backend cambió `lookup_field` de `code` a `id`; el parámetro puede
   * venir como number o string-castable (route param). Los callers que
   * todavía no migren a backendId pueden pasar el code string mientras
   * coincida con el PK; preferido: pasar el `id` real.
   *
   * Cacheado (memoria + localStorage, TTL 2 min): el sheet de detalle lo
   * pide al abrir — así abrir/cerrar repetidamente no re-fetchea. Se
   * invalida tras `transitionState` / `updateDamageReport`.
   */
  async getAlertDetail(id: number | string): Promise<BackendAlertDetail> {
    const key = `alerts:detail:${id}`;
    return cachedGet<BackendAlertDetail>(
      key,
      async () => {
        const res = await httpClient.get<BackendAlertDetail>(`/alerts/alerts/${id}/`);
        return res.data;
      },
      2 * 60_000,
    );
  },

  /**
   * Transicionar estado/fase de una alerta (PATCH).
   * El endpoint `/alerts/transitions/<id>/` ahora usa `lookup_field='id'`
   * (antes era `code`). Pasar el `id` numérico del backend (PK).
   * Payload acepta `status_name`, `phase_name`, `real_start_time`,
   * `has_damage`, `damage_report` y `taken_actions` en un solo request,
   * **siempre en MAYÚSCULAS para status/phase**.
   */
  async transitionState(id: number | string, payload: AlertTransitionPayload): Promise<void> {
    await httpClient.patch(`/alerts/transitions/${id}/`, payload);
    // El detalle cambió (estado/fase/historial): invalida su caché para que
    // el sheet muestre las transiciones frescas al reabrir.
    invalidateCachePrefix('alerts:detail:');
  },

  /**
   * Actualizar reporte de daños/acciones dentro de la ventana de 48h
   * post-atendido. Usa `alert_id` como lookup (configurado en el backend).
   */
  async updateDamageReport(alertId: number | string, payload: AlertUpdateResultPayload): Promise<void> {
    await httpClient.patch(`/alerts/update-results/${alertId}/`, payload);
    // El detalle cambió (reportes): invalida su caché.
    invalidateCachePrefix('alerts:detail:');
  },
};
