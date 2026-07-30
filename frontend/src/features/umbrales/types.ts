/**
 * Tipos compartidos para la sección "Gestión de Umbrales".
 *
 * Cada distrito (Unidad Operativa) define sus propios rangos min/max para
 * un par (Fenómeno Natural, Variable). El "Umbral" (categoría) es el nombre
 * legible del nivel (ej. "Muy Lluvioso").
 */
import type { UmbralFenomeno } from '@/services/apiUmbrales';
import type { GfsCategory } from '@/features/mapa/types/gfs';

export type { UmbralFenomeno } from '@/services/apiUmbrales';

/** Categoría GFS válida (sin contar '-'). */
type GfsCategoriaValida = Exclude<GfsCategory, '-'>;

/** Une un registro de la API con la categoría GFS derivada de su threshold. */
export interface UmbralConCategoria extends UmbralFenomeno {
  /** Clave interna GfsCategory derivada del nombre del threshold. */
  categoria: GfsCategoriaValida | null;
  /** Hex de relleno de marca (tomado de GFS_COLOR_MAP). */
  color: string;
}

/**
 * Mapea el nombre del umbral (Title Case del backend) a GfsCategory.
 *   "Moderadamente Lluvioso" → 'moderadamente-lluvioso'
 *   "Lluvioso"               → 'lluvioso'
 *   "Muy Lluvioso"           → 'muy-lluvioso'
 *   "Extremadamente Lluvioso"→ 'extremadamente-lluvioso'
 *   cualquier otro           → null
 */
export function thresholdNameToCategoria(name?: string | null): GfsCategoriaValida | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  if (n === 'moderadamente lluvioso') return 'moderadamente-lluvioso';
  if (n === 'lluvioso') return 'lluvioso';
  if (n === 'muy lluvioso') return 'muy-lluvioso';
  if (n === 'extremadamente lluvioso') return 'extremadamente-lluvioso';
  return null;
}

/**
 * Determina si un valor (mm/h) "cae" dentro del rango del umbral.
 *   - min_value null → sin piso
 *   - max_value null → sin techo (>= min)
 *   - ambos presentes → [min_value, max_value)
 */
export function valorEnRango(
  mmh: number,
  t: { min_value: number | null; max_value: number | null },
): boolean {
  const min = t.min_value;
  const max = t.max_value;
  if (min !== null && mmh < min) return false;
  if (max !== null && mmh >= max) return false;
  return true;
}