/**
 * Utilidades para la escalera de umbrales (módulo Gestion de Umbrales).
 *
 * La escalera es de 4 categorías en orden fijo de severidad:
 *
 *   Moderadamente Lluvioso → Lluvioso → Muy Lluvioso → Extremadamente Lluvioso
 *
 * La UI expone "cortes" (puntos de límite) entre categorías consecutivas,
 * no min/max por separado. La categoría superior (Extremadamente Lluvioso)
 * siempre lleva `max_value = null` (sin techo) — el backend procesa
 * `intensity >= min_value`, jamaisá corta por arriba.
 *
 * Cada slot puede estar registrado (con id existente) o no (vacío). Los
 * slots vacíos permiten al usuario añadir una categoría intermedia que no
 * tenía definida para ese distrito. La categoría del piso (Mod) puede tener
 * cualquier `min_value >= 0` (varía por distrito, casi nunca 0).
 *
 * El guardado se hace por el endpoint `bulk/` (PATCH atómico), donde el
 * backend valida la coherencia final de la escalera en una transacción.
 */
import type { UmbralFenomeno } from '@/services/apiUmbrales';

/** Orden fijo de severidad de las 4 categorías (de menor a mayor). */
export const ORDEN_CATEGORIAS = [
  'Moderadamente Lluvioso',
  'Lluvioso',
  'Muy Lluvioso',
  'Extremadamente Lluvioso',
] as const;

export type NombreCategoria = (typeof ORDEN_CATEGORIAS)[number];

/** Slot de la escalera: una categoría con su corte actual (id si existe). */
export interface SlotLadder {
  nombre: NombreCategoria;
  /** True si el distrito ya tiene un registro para esta categoría. */
  registrado: boolean;
  /** id del registro existente. */
  id?: number;
  /** threshold.id del catalog. Necesario para enviar al bulk. */
  thresholdId: number | null;
  /** min_value actual (piso si es el primer slot presente). */
  min_value: number | null;
  /** max_value actual (null si es el último slot presente). */
  max_value: number | null;
  /** True si el slot está "sin registrar" (no hay fila en BD). */
  vacio: boolean;
}

/**
 * Construye los 4 slots de la escalera desde los hermanos del mismo
 * (distrito + fenómeno + variable). Las categorías no registradas quedan
 * como slots vacíos (registrado=false, vacio=true).
 *
 * `pool` contiene TODOS los umbrales ya cargados; lo filtramos por
 * `(district_ubigeo, natural_phenomena_id, variable_id)`. Ademásothy el
 * `categoriasCatalogo` (lista de thresholds disponibles con su id) para
 * rellenar `thresholdId` incluso en slots vacíos (necesario para POST).
 */
export function construirSlots(
  pool: UmbralFenomeno[],
  districtUbigeo: string,
  naturalPhenomenaId: number,
  variableId: number,
  categoriasCatalogo: { id: number; name: string }[],
): SlotLadder[] {
  const hermanos = pool.filter(
    (u) =>
      u.district?.ubigeo === districtUbigeo &&
      u.natural_phenomena?.id === naturalPhenomenaId &&
      u.variable?.id === variableId,
  );
  // Matching case-insensitive (la BD puede tener Title Case, el catálogo
  // UPPER, CSS uppercase, etc.). Toleramos blancos también.
  const norm = (s: string) => s.trim().toLowerCase();
  const registroByName = new Map<string, UmbralFenomeno>();
  for (const h of hermanos) registroByName.set(norm(h.threshold.name), h);
  const catalogoByName = new Map<string, number>();
  for (const t of categoriasCatalogo) catalogoByName.set(norm(t.name), t.id);

  return ORDEN_CATEGORIAS.map((nombre) => {
    const key = norm(nombre);
    const reg = registroByName.get(key) ?? null;
    const thrId = reg?.threshold.id ?? catalogoByName.get(key) ?? null;
    if (reg) {
      return {
        nombre,
        registrado: true,
        id: reg.id,
        thresholdId: thrId,
        min_value: reg.min_value,
        max_value: reg.max_value,
        vacio: false,
      };
    }
    return {
      nombre,
      registrado: false,
      thresholdId: thrId,
      min_value: null,
      max_value: null,
      vacio: true,
    };
  });
}