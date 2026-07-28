/**
 * Mapa de niveles de precipitación → token de Tailwind (color de relleno).
 *
 * Los colores se definieron en `tailwind.config.ts > alerts.precipitaciones`
 * y son los mismos que aparecen en la leyenda y en los mocks.
 *
 * El backend (cuando esté listo) devolverá `properties.nivel` con uno
 * de estos 4 strings — cuando eso ocurra, este mapa mantiene el frontend
 * estable sin tocar los componentes.
 */

import type { LayerId } from '@/features/mapa/components/LayerControl';

export type PrecipNivel = 'moderadamente-lluvioso' | 'lluvioso' | 'muy-lluvioso' | 'extremadamente-lluvioso';

/** Color de relleno del polígono (sin opacidad extra). */
export const PRECIP_FILL: Record<PrecipNivel, string> = {
  'moderadamente-lluvioso': '#77e5ff',
  'lluvioso': '#252ad5',
  'muy-lluvioso': '#59257d',
  'extremadamente-lluvioso': '#7a1a23',
};

/** Opacidad de relleno (para ver streets por debajo). */
export const PRECIP_FILL_OPACITY: Record<PrecipNivel, number> = {
  'moderadamente-lluvioso': 0.35,
  'lluvioso': 0.40,
  'muy-lluvioso': 0.55,
  'extremadamente-lluvioso': 0.70,
};

/** Color y grosor del borde del polígono (isohyet). */
export const PRECIP_STROKE: Record<PrecipNivel, string> = {
  'moderadamente-lluvioso': '#77e5ff66',
  'lluvioso': '#252ad580',
  'muy-lluvioso': '#59257d80',
  'extremadamente-lluvioso': '#5d030c80',
};

/** Para ordenar de menor a mayor intensidad (útil en caso de ajustes). */
export const PRECIP_ORDER: PrecipNivel[] = [
  'moderadamente-lluvioso',
  'lluvioso',
  'muy-lluvioso',
  'extremadamente-lluvioso',
];

/** Etiquetas legibles (para popups, tooltips, exports). */
export const PRECIP_LABEL: Record<PrecipNivel, string> = {
  'moderadamente-lluvioso': 'Moderadamente Lluvioso',
  'lluvioso': 'Lluvioso',
  'muy-lluvioso': 'Muy Lluvioso',
  'extremadamente-lluvioso': 'Extremadamente Lluvioso',
};

/** Tipos de capa disponibles (reexportado para conveniencia desde aquí). */
export type { LayerId };

/**
 * Deriva el nivel de precipitación a partir de la intensidad en mm/h.
 * Umbrales basados en estándares meteorológicos:
 *   0–2.5 mm/h   → moderadamente-lluvioso
 *   2.5–10 mm/h  → lluvioso
 *   10–30 mm/h   → muy-lluvioso
 *   >30 mm/h     → extremadamente-lluvioso
 */
export function nivelFromIntensity(mmh: number): PrecipNivel {
  if (mmh >= 30) return 'extremadamente-lluvioso';
  if (mmh >= 10) return 'muy-lluvioso';
  if (mmh >= 2.5) return 'lluvioso';
  return 'moderadamente-lluvioso';
}