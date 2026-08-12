import { httpClient } from './httpClient';

// ============================================================================
// Helpers de paginación (consistentes con apiComponentes.ts)
// ============================================================================

interface PaginatedResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

function unwrap<T>(data: T[] | PaginatedResponse<T>): T[] {
  if (Array.isArray(data)) return data;
  return data.results ?? [];
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

export interface BackendAlertListItem {
  id: number;
  code: string;
  /** Nombre del fenómeno natural asociado (puede llegar nulo). */
  natural_phenomena_name: string | null;
  max_intensity_mm_h: number;
  max_threshold: string;
  /**
   * Historial de transiciones de estado/fase de la alerta (ordenado desc
   * por `created_at` desde el backend). El primer elemento representa el
   * estado actual. Se usa para derivar `Alerta.estado` en el mapa y para
   * pintar el histórico en el `AlertaDetailSheet`.
   */
  historic_alert: BackendAlertHistoryEntry[];
  start_time_local: string | null;
  end_time_local: string | null;
  alert_clusters: {
    representative_point: {
      type: 'Point';
      coordinates: [number, number];
    } | null;
    /**
     * UBIGEOs de los distritos afectados por este cluster, con su nombre
     * legible. El backend los entrega como `[{ ubigeo, name }]`; se usan
     * para resolver la Unidad Operativa (Branch) asociada a cada distrito.
     */
    affected_ubigeos: { ubigeo: string; name: string | null }[];
  }[];
}

// ============================================================================
// INTERFACES — Respuesta del detalle (AlertDetailSerializer)
// ============================================================================

export interface BackendAlertClusterComponent {
  component: string;
}

export interface BackendAlertCluster {
  max_intensity_mm_h: number;
  timestamp_str: string;
  threshold: string | null;
  /**
   * UBIGEOs de los distritos afectados por este cluster, en formato
   * `{ ubigeo, name }` (ver `AlertDetailSerializer.get_reached_ubigeos`
   * del backend). Se usan para resolver la Unidad Operativa (Branch).
   */
  affected_districts: { ubigeo: string; name: string | null }[];
}

/** `BackendAlertHistoryEntry` ya definido más arriba para el listado. */

export interface BackendAlertResult {
  has_damage: boolean;
  damage_report: string | null;
  taken_actions: string | null;
}

export interface BackendAlertDetail {
  id: number;
  code: string;
  /**
   * El `AlertDetailSerializer` actual NO expone `status`/`phase` a nivel
   * top-level (solo dentro de `historic_alert[]`). Estos campos se
   * declaran como opcionales para no romper el tipo si el backend los
   * reincorpora en el futuro; el adapter deriva el estado actual
   * directamente desde `historic_alert[0]`.
   */
  status?: string;
  phase?: string;
  max_intensity_mm_h: number;
  max_threshold: string;
  start_time_local: string | null;
  end_time_local: string | null;
  alert_cluster_components: BackendAlertClusterComponent[];
  clusters: BackendAlertCluster[];
  historic_alert: BackendAlertHistoryEntry[];
  result: BackendAlertResult | null;
  /** El backend expone el nombre del fenómeno como texto (SlugRelatedField). */
  natural_phenomena_name: string | null;
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
   * Obtener lista de alertas.
   * El backend puede devolver un array plano o paginado; `unwrap` maneja ambos.
   */
  async listAlerts(): Promise<BackendAlertListItem[]> {
    const res = await httpClient.get('/alerts/alerts/');
    return unwrap<BackendAlertListItem>(res.data);
  },

  /**
   * Obtener detalle de una alerta por `id` (PK numérica del backend).
   * El backend cambió `lookup_field` de `code` a `id`; el parámetro puede
   * venir como number o string-castable (route param). Los callers que
   * todavía no migren a backendId pueden pasar el code string mientras
   * coincida con el PK; preferido: pasar el `id` real.
   */
  async getAlertDetail(id: number | string): Promise<BackendAlertDetail> {
    const res = await httpClient.get<BackendAlertDetail>(`/alerts/alerts/${id}/`);
    return res.data;
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
  },

  /**
   * Actualizar reporte de daños/acciones dentro de la ventana de 48h
   * post-atendido. Usa `alert_id` como lookup (configurado en el backend).
   */
  async updateDamageReport(alertId: number | string, payload: AlertUpdateResultPayload): Promise<void> {
    await httpClient.patch(`/alerts/update-results/${alertId}/`, payload);
  },
};
