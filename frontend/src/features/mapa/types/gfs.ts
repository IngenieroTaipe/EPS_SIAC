/**
 * Tipado y clasificación de precipitación GFS (celdas activas ~10km).
 *
 * Contrato del endpoint:
 *   GET /api/v1/core_predictive/gfs-active-cells/latest/
 *
 * Respuesta resumida (ver interfaces):
 *   - FeatureCollection con `metadata` (request_code, run_start_utc, total_features).
 *   - Cada Feature trae un `properties.intensity_series` con 12 valores en mm/h,
 *     `timestamps` con 12 strings en hora local Perú (PET, formato
 *     "YYYY-MM-DD HH:mm PET") y `threshold_names` (12 strings, '-' cuando el
 *     backend todavía no clasifica).
 *
 * El backend referencia los umbrales por distrito en:
 *   backend/core_predictive/data/thresholds.json
 * que por ahora solo define la entrada de Pichanaqui (Moderadamente/Muy/
 * Lluvioso/Extremadamente Lluvioso) — usada aquí como default provisional.
 */

import type { LayerId } from '@/features/mapa/components/LayerControl';

/** Categoría de umbral o '-' (sin lluvia significativa). */
export type GfsCategory =
  | 'moderadamente-lluvioso'
  | 'lluvioso'
  | 'muy-lluvioso'
  | 'extremadamente-lluvioso'
  | '-';

/** Properties de cada feature del GeoJSON devuelto por el endpoint GFS. */
export interface GfsFeatureProperties {
  gfs_request_id: number;
  /** Intensidad máxima de la serie (mm/h). Sirve para tooltip estático. */
  max_intensity_mm_h: number;
  /** 12 timestamps en hora local PET — defensivo: puede venir null/undefined. */
  timestamps?: string[] | null;
  /** 12 valores mm/h en el mismo orden que `timestamps`. */
  intensity_series?: number[] | null;
  /** 12 categorías o '-' cuando el backend aún no clasifica. */
  threshold_names?: string[] | null;
}

/** Una feature del GeoJSON GFS (polígono celda grilla). */
export interface GfsFeature {
  type: 'Feature';
  id?: number | string;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    // Polygon: Ring[] ; MultiPolygon: Ring[][] — tipado laxo por compat.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    coordinates: any;
  };
  properties: GfsFeatureProperties;
}

/** FeatureCollection GFS con metadata del request. */
export interface GfsFeatureCollection {
  type: 'FeatureCollection';
  metadata?: {
    request_code?: string;
    run_start_utc?: string;
    total_features?: number;
  };
  features: GfsFeature[];
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
 * Clasifica una intensidad mm/h en una categoría GFS.
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
 *      `intersected_districts.*.thresholds` venga lleno en el GeoJSON.
 *   2) Actualizar cuando se cambie de Unidad Operativa — otro distrito puede
 *      tener otros rangos min/max definidos en thresholds.json.
 *   3) Cuando el backend termine de poblar `threshold_names[i]` por feature,
 *      evaluar si conviene consumirlo directamente desde el payload
 *      (en lugar de re-computar aquí) según impacto en memoria / latencia en
 *      despliegue con ~12 000 features.
 */
export function getThreshold(mmh: number): GfsCategory {
  if (mmh < 1.6) return '-';
  if (mmh < 3.2) return 'moderadamente-lluvioso';
  if (mmh < 7.5) return 'lluvioso';
  if (mmh < 10.1) return 'muy-lluvioso';
  return 'extremadamente-lluvioso';
}

/**
 * Intensidad mm/h de una feature en una hora dada (defensivo).
 * Devuelve 0 si la feature o el índice no son válidos.
 */
export function intensityAt(feature: GfsFeature | undefined | null, hourIndex: number): number {
  const series = feature?.properties?.intensity_series ?? null;
  if (!Array.isArray(series)) return 0;
  if (hourIndex < 0 || hourIndex >= series.length) return 0;
  const v = series[hourIndex];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export type { LayerId };