/**
 * Tipado y clasificación de precipitación GFS — Clústeres Espacio-Temporales.
 *
 * Contrato del endpoint (Etapa 2 — optimización DBSCAN):
 *   GET /api/v1/core_predictive/gfs-clusters-snapshots/window-18h/
 *
 * Respuesta resumida:
 *   - FeatureCollection con `metadata` (latest_request_code,
 *     previous_request_code, window_duration_hours, total_features).
 *   - Cada Feature es un clúster disuelto (MultiPolygon) para UN `(time_step,
 *     temporal_status)`:
 *       * `max_intensity_mm_h`, `avg_intensity_mm_h`
 *       * `cluster_index`, `total_cells`
 *       * `threshold_name` (string en Title Case, ej. "Lluvioso",
 *         "Moderadamente Lluvioso", "Normal / Sin Alerta")
 *       * `temporal_status` = 'HISTORIC' (steps 1..6 de la corrida previa)
 *                          | 'FORECAST' (steps 1..12 de la corrida actual)
 *       * `affected_ubigeos`
 *
 * El backend referencia los umbrales por distrito en:
 *   backend/core_predictive/data/thresholds.json
 * que por ahora solo define la entrada de Pichanaqui (Moderadamente/Muy/
 * Lluvioso/Extremadamente Lluvioso) — usada aquí como default provisional.
 */

import type { MultiPolygon, Polygon } from 'geojson';
import type { LayerId } from '@/features/mapa/components/LayerControl';

/** Categoría de umbral o '-' (sin lluvia significativa). */
export type GfsCategory =
  | 'moderadamente-lluvioso'
  | 'lluvioso'
  | 'muy-lluvioso'
  | 'extremadamente-lluvioso'
  | '-';

/** Etiqueta temporal del clúster: pasado (corrida previa) o futuro (actual). */
export type GfsTemporalStatus = 'HISTORIC' | 'FORECAST';

/** Identidad única de un frame temporal dentro de la ventana 18h. */
export interface GfsFrameId {
  temporal_status: GfsTemporalStatus;
  time_step: number;
}

/** Properties de cada feature devuelto por el endpoint de clústeres. */
export interface GfsClusterFeatureProperties {
  gfs_request_id: number;
  /** Paso horario dentro de su corrida (1..12 FORECAST, 1..6 HISTORIC). */
  time_step: number;
  /** Timestamp legible en hora local PET — ej. "2026-07-28 20:00 PET". */
  timestamp_str: string;
  /** Índice de clúster asignado por DBSCAN dentro del step. */
  cluster_index: number;
  /** Nº de celdas GFS originales agrupadas en este clúster. */
  total_cells: number;
  /** Intensidad pico del clúster (mm/h). */
  max_intensity_mm_h: number;
  /** Intensidad promedio del clúster (mm/h). */
  avg_intensity_mm_h: number;
  /** FK al umbral (null si no clasificado todavía). */
  threshold_id?: number | null;
  /** Nombre del umbral en Title Case — ej. "Lluvioso", "Normal / Sin Alerta". */
  threshold_name?: string | null;
  /** UBIGEOS afectados (array, puede contener null). */
  affected_ubigeos?: unknown[];
  /** Origen temporal del clúster dentro de la ventana 18h. */
  temporal_status?: GfsTemporalStatus;

  /**
   * FRONTAL ONLY — NO es parte del contrato del backend.
   * Geometría suavizada (closing morfológico) generada una sola vez al recibir
   * el GeoJSON (ver `smoothGeometry.ts`). Usada EXCLUSIVAMENTE para pintar en
   * Leaflet; NO para cálculos espaciales (point-in-polygon, intersecciones).
   * `feature.geometry` queda intacto para toda la lógica de negocio.
   */
  _smoothedGeometry?: Polygon | MultiPolygon | null;
}

/** Una feature clúster (MultiPolygon disuelto por DBSCAN). */
export interface GfsClusterFeature {
  type: 'Feature';
  id?: number | string;
  geometry: Polygon | MultiPolygon;
  properties: GfsClusterFeatureProperties;
}

/**
 * Metadata de la FeatureCollection. Campos opcionales porque el endpoint de
 * celdas usa `request_code`/`run_start_utc`/etc. y el de clusters usa
 * `latest_request_code`/`previous_request_code`/`window_duration_hours`.
 */
export interface GfsWindowMetadata {
  request_code?: string;
  run_start_utc?: string;
  run_end_utc?: string;
  target_variable?: string;
  latest_request_code?: string;
  previous_request_code?: string;
  window_duration_hours?: number;
  total_features?: number;
}

export interface GfsClusterFeatureCollection {
  type: 'FeatureCollection';
  metadata?: GfsWindowMetadata;
  features: GfsClusterFeature[];
}

/**
 * Color de relleno plano (hex) que Leaflet necesita — NO clases de Tailwind.
 * Tomados de `tailwind.config.ts > alerts.precipitaciones`.
 */
export const GFS_COLOR_MAP: Record<GfsCategory, string> = {
  'moderadamente-lluvioso': '#77e5ff',
  lluvioso: '#252ad5',
  'muy-lluvioso': '#59257d',
  'extremadamente-lluvioso': '#7a1a23',
  '-': 'transparent',
};

/** Etiquetas legibles para las categorías con lluvia (tooltip / leyenda). */
export const GFS_LABEL: Record<Exclude<GfsCategory, '-'>, string> = {
  'moderadamente-lluvioso': 'Moderadamente Lluvioso',
  lluvioso: 'Lluvioso',
  'muy-lluvioso': 'Muy Lluvioso',
  'extremadamente-lluvioso': 'Extremadamente Lluvioso',
};

/** Orden de menor a mayor intensidad (utilidad para leyendas). */
export const GFS_ORDER: Exclude<GfsCategory, '-'>[] = [
  'moderadamente-lluvioso',
  'lluvioso',
  'muy-lluvioso',
  'extremadamente-lluvioso',
];

/**
 * Clasifica una intensidad mm/h en una categoría GFS (fallback en el frontend).
 *
 * ============ TODO / DEFERRED ============
 * Estos umbrales son los únicos definidos actualmente en
 * `backend/core_predictive/data/thresholds.json` para Pichanaqui:
 *
 *   < 1.6   → '-'                        (sin lluvia)
 *   < 3.2   → 'moderadamente-lluvioso'  (min 1.6 , max 3.2 )
 *   < 7.5   → 'lluvioso'                (min 3.2 , max 7.5 )
 *   < 10.1  → 'muy-lluvioso'            (min 7.5 , max 10.1)
 *   ≥ 10.1  → 'extremadamente-lluvioso' (min 10.1, max null → sin techo)
 *
 * Esto es un umbral ÚNICO (Pichanaqui) aplicado como default para toda la
 * zona. PENDIENTE de:
 *   1) Reemplazar por umbral específico por distrito cuando
 *      `affected_ubigeos` venga lleno en el GeoJSON (para lookup en
 *      thresholds.json por ubigeo).
 *   2) Actualizar cuando se cambie de Unidad Operativa — otro distrito puede
 *      tener otros rangos min/max definidos en thresholds.json.
 *
 * En la Etapa 2 (clústeres) el backend SUELE poblar `threshold_name` ya
 * clasificado desde su FK a `Threshold`. En ese caso se prefiere el dato del
 * backend y este `getThreshold` sólo actúa como respaldo cuando el backend
 * entrega "Normal / Sin Alerta" o null.
 */
export function getThreshold(mmh: number): GfsCategory {
  if (mmh < 1.6) return '-';
  if (mmh < 3.2) return 'moderadamente-lluvioso';
  if (mmh < 7.5) return 'lluvioso';
  if (mmh < 10.1) return 'muy-lluvioso';
  return 'extremadamente-lluvioso';
}

/**
 * Normaliza el `threshold_name` que entrega el backend (Title Case con
 * espacios) a nuestras claves kebab-case internas.
 *
 *   "Moderadamente Lluvioso" → 'moderadamente-lluvioso'
 *   "Lluvioso"               → 'lluvioso'
 *   "Muy Lluvioso"           → 'muy-lluvioso'
 *   "Extremadamente Lluvioso"→ 'extremadamente-lluvioso'
 *   "Normal / Sin Alerta"    → null  (no clasificado → fallback a getThreshold)
 *
 * Devuelve `null` cuando el backend no entrega un umbral significativo,
 * indicando al caller que debe re-clasificar con `getThreshold`.
 */
export function normalizeThresholdName(name?: string | null): GfsCategory | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  if (n === '' || n === '-' || n.startsWith('normal')) return null;
  if (n === 'moderadamente lluvioso') return 'moderadamente-lluvioso';
  if (n === 'lluvioso') return 'lluvioso';
  if (n === 'muy lluvioso') return 'muy-lluvioso';
  if (n === 'extremadamente lluvioso') return 'extremadamente-lluvioso';
  return null;
}

/**
 * Clasifica un clúster prefiriendo el `threshold_name` del backend y cayendo a
 * `getThreshold(max_intensity_mm_h)` cuando el backend entrega "Normal / Sin
 * Alerta" o null.
 */
export function classifyCluster(p: GfsClusterFeatureProperties): GfsCategory {
  const fromBackend = normalizeThresholdName(p.threshold_name);
  if (fromBackend) return fromBackend;
  return getThreshold(p.max_intensity_mm_h ?? 0);
}

/**
 * Extrae "HH:mm" de un `timestamp_str` con formato "YYYY-MM-DD HH:mm PET".
 * Defensivo: si el string no parsea, devuelve '—'.
 */
export function extractHHmm(timestampStr?: string | null): string {
  if (typeof timestampStr !== 'string' || !timestampStr) return '—';
  const m = timestampStr.match(/(\d{2}:\d{2})/);
  return m ? m[1] : '—';
}

// ──────────────────────────────────────────────────────────────────────
// Tipos del endpoint de celdas individuales (~12 000) — v2 para comparación.
// GET /api/v1/core_predictive/gfs-active-cells/latest/
//
// Cada feature trae series temporales de 12 valores (intensity_series +
// timestamps); el slider recolorea por índice. TEMPORAL — borrar al cerrar
// la comparación con clusters.
// ──────────────────────────────────────────────────────────────────────

/** Properties de cada celda GFS个体. */
export interface GfsCellProperties {
  gfs_request_id: number;
  /** Intensidad máxima de la serie (mm/h). */
  max_intensity_mm_h: number;
  /** 12 timestamps en hora local PET — defensivo: puede venir null/undefined. */
  timestamps?: string[] | null;
  /** 12 valores mm/h en el mismo orden que `timestamps`. */
  intensity_series?: number[] | null;
}

/** Una feature del GeoJSON de celdas individuales (Polygon grilla ~10km). */
export interface GfsCellFeature {
  type: 'Feature';
  id?: number | string;
  geometry: Polygon | MultiPolygon;
  properties: GfsCellProperties & {
    /**
     * FRONTAL ONLY — copia suavizada (closing morfológico) generada una sola
     * vez. Sólo para pintar en Leaflet; el `feature.geometry` original se
     * conserva para cálculos espaciales.
     */
    _smoothedGeometry?: Polygon | MultiPolygon | null;
  };
}

export interface GfsCellFeatureCollection {
  type: 'FeatureCollection';
  metadata?: GfsWindowMetadata;
  features: GfsCellFeature[];
}

/**
 * Intensidad mm/h de una celda en una hora dada (defensivo).
 * Devuelve 0 si la feature o el índice no son válidos.
 */
export function intensityAt(
  feature: GfsCellFeature | undefined | null,
  hourIndex: number,
): number {
  const series = feature?.properties?.intensity_series ?? null;
  if (!Array.isArray(series)) return 0;
  if (hourIndex < 0 || hourIndex >= series.length) return 0;
  const v = series[hourIndex];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export type { LayerId };