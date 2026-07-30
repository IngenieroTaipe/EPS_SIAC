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

export interface BackendAlertListItem {
  id: number;
  code: string;
  max_intensity_mm_h: number;
  max_threshold: string;
  start_time_local: string | null;
  end_time_local: string | null;
  alert_clusters: {
    representative_point: {
      type: 'Point';
      coordinates: [number, number];
    } | null;
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
  affected_districts: string[];
}

export interface BackendAlertHistoryEntry {
  status_name: string;
  phase_name: string;
}

export interface BackendAlertResult {
  has_damage: boolean;
  damage_report: string | null;
  taken_actions: string | null;
}

export interface BackendNaturalPhenomena {
  id: number;
  name: string;
}

export interface BackendAlertDetail {
  id: number;
  code: string;
  status: string;
  phase: string;
  max_intensity_mm_h: number;
  max_threshold: string;
  start_time_local: string | null;
  end_time_local: string | null;
  alert_cluster_components: BackendAlertClusterComponent[];
  clusters: BackendAlertCluster[];
  historic_alert: BackendAlertHistoryEntry[];
  result: BackendAlertResult | null;
  natural_phenomena: BackendNaturalPhenomena | null;
}

// ============================================================================
// INTERFACES — Payloads de escritura
// ============================================================================

export interface AlertTransitionPayload {
  status_name?: 'Confirmado' | 'No Confirmado';
  phase_name?: 'En Espera de Reporte' | 'En Proceso de Atención' | 'Atendido';
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
   * Obtener detalle de una alerta por `code` (lookup_field='code' en el backend).
   */
  async getAlertDetail(code: string): Promise<BackendAlertDetail> {
    const res = await httpClient.get<BackendAlertDetail>(`/alerts/alerts/${code}/`);
    return res.data;
  },

  /**
   * Transicionar estado/fase de una alerta (PATCH).
   * El endpoint `/alerts/transitions/<code>/` acepta `status_name`, `phase_name`,
   * `has_damage`, `damage_report` y `taken_actions` en un solo request.
   */
  async transitionState(code: string, payload: AlertTransitionPayload): Promise<void> {
    await httpClient.patch(`/alerts/transitions/${code}/`, payload);
  },

  /**
   * Actualizar reporte de daños/acciones dentro de la ventana de 48h
   * post-atendido. Usa `alert_id` como lookup (configurado en el backend).
   */
  async updateDamageReport(alertId: number | string, payload: AlertUpdateResultPayload): Promise<void> {
    await httpClient.patch(`/alerts/update-results/${alertId}/`, payload);
  },
};
