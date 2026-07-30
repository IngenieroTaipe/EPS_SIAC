/**
 * Validación de continuidad de umbrales para un mismo (distrito + fenómeno +
 * variable).
 *
 * Los umbrales forman una escalera continua de menor a mayor intensidad, en
 * este orden fijo de categorías:
 *
 *   Moderadamente Lluvioso → Lluvioso → Muy Lluvioso → Extremadamente Lluvioso
 *
 * Reglas (continuidad, sin solapes ni huecos):
 *
 *   1. El `min_value` de un umbral debe IGUALAR al `max_value` del umbral
 *      inmediatamente inferior (el que cierra justo debajo).
 *      Ej.: si "Muy Lluvioso" es [7.5 – 10.1), entonces
 *           "Extremadamente Lluvioso" debe tener min_value = 10.1
 *           (no puede ser 9 ni 10.5).
 *
 *   2. El `max_value` de un umbral debe IGUALAR al `min_value` del umbral
 *      inmediatamente superior (el que abre justo arriba).
 *      Ej.: si "Extremadamente Lluvioso" tiene min_value = 10.1, entonces
 *           "Muy Lluvioso" debe tener max_value = 10.1
 *           (no puede ser 10.5).
 *
 *   3. El umbral superior (Extremadamente Lluvioso) lleva `max_value = null`
 *      (sin techo); el umbral inferior (Moderadamente Lluvioso) suele llevar
 *      `min_value` = 0 o un piso pequeño. Estas puntas no tienen vecino a
 *      validar en ese extremo.
 *
 *   4. `min_value <= max_value` cuando ambos vienen (validación base).
 */
import type { UmbralFenomeno } from '@/services/apiUmbrales';

export interface ResultadoContinuidad {
  ok: boolean;
  /** Mensaje legible para el usuario (vacío si ok). */
  mensaje: string;
  /** min_value esperado según el vecino inferior (si existe). */
  minEsperado: number | null;
  /** max_value esperado según el vecino superior (si existe). */
  maxEsperado: number | null;
}

const INF = Number.POSITIVE_INFINITY;
const NINF = Number.NEGATIVE_INFINITY;

function minOf(u: { min_value: number | null }): number {
  return u.min_value === null ? NINF : u.min_value;
}
function maxOf(u: { max_value: number | null }): number {
  return u.max_value === null ? INF : u.max_value;
}

/**
 * Valida el umbral que el usuario intenta guardar contra sus hermanos
 * (los del mismo distrito + fenómeno + variable, excluyendo el propio id).
 *
 * `siblings` ya debe venir filtrado por (distrito + fenómeno + variable) y
 * SIN el umbral en edición. `newMin`/`newMax` son los valores candidatos
 * (null = sin límite en ese extremo).
 *
 * `editingId` evita que el umbral en edición se cuente dos veces (en este
 * helper ya se asume filtrado, pero se deja defensivo).
 */
export function validarContinuidad(
  newMin: number | null,
  newMax: number | null,
  siblings: UmbralFenomeno[],
  editingId?: number,
): ResultadoContinuidad {
  const otros = siblings.filter((u) => u.id !== editingId);

  // Vecino inferior: el hermano cuyo max_value es el mayor de los que
  // quedan por debajo del nuevo umbral. Su max_value debe igualar newMin.
  let inferior: UmbralFenomeno | null = null;
  for (const u of otros) {
    const mx = maxOf(u);
    if (mx === INF) continue; // sin techo → no es inferior válido
    if (newMin !== null && mx <= newMin) {
      if (!inferior || mx > maxOf(inferior)) inferior = u;
    } else if (newMin === null) {
      // newMin null → somos el piso; no se espera inferior.
    } else {
      // mx > newMin: posible superior, no inferior.
    }
  }

  // Vecino superior: el hermano cuyo min_value es el menor de los que
  // quedan por encima del nuevo umbral. Su min_value debe igualar newMax.
  let superior: UmbralFenomeno | null = null;
  for (const u of otros) {
    const mn = minOf(u);
    if (mn === NINF) continue;
    if (newMax !== null && mn >= newMax) {
      if (!superior || mn < minOf(superior)) superior = u;
    } else if (newMax === null) {
      // newMax null → somos el techo; no se espera superior.
    }
  }

  const minEsperado = inferior ? maxOf(inferior) : null;
  const maxEsperado = superior ? minOf(superior) : null;

  const problemas: string[] = [];

  // (1) min debe igualar al max del vecino inferior.
  if (inferior && minEsperado !== null) {
    if (newMin === null) {
      problemas.push(
        `Falta el valor mínimo. Como el umbral inferior “${inferior.threshold.name}” cierra en ${minEsperado} mm/h, el mínimo de este umbral debe ser ${minEsperado}.`,
      );
    } else if (newMin !== minEsperado) {
      problemas.push(
        `El valor mínimo (${newMin}) no calza con el umbral inferior “${inferior.threshold.name}”, cuyo máximo es ${minEsperado} mm/h. El mínimo debe ser exactamente ${minEsperado} para que los rangos sean continuos.`,
      );
    }
  }

  // (2) max debe igualar al min del vecino superior.
  if (superior && maxEsperado !== null) {
    if (newMax === null) {
      problemas.push(
        `Falta el valor máximo. Como el umbral superior “${superior.threshold.name}” abre en ${maxEsperado} mm/h, el máximo de este umbral debe ser ${maxEsperado}.`,
      );
    } else if (newMax !== maxEsperado) {
      problemas.push(
        `El valor máximo (${newMax}) no calza con el umbral superior “${superior.threshold.name}”, cuyo mínimo es ${maxEsperado} mm/h. El máximo debe ser exactamente ${maxEsperado} para que los rangos sean continuos.`,
      );
    }
  }

  // (3) Si NO hay inferior, somos el piso: min puede ser null o un piso libre.
  //     Si NO hay superior, somos el techo: max debe ser null.
  if (!superior && newMax !== null) {
    // No debería tener techo si es el último.
    // (No es un error estricto — el backend admite max numérico — pero
    //  avisamos porque rompería la continuidad si luego se agrega otro.)
    // Lo dejamos pasar sin error: el usuario puede definir el techo libremente.
  }

  if (problemas.length === 0) {
    return { ok: true, mensaje: '', minEsperado, maxEsperado };
  }
  return { ok: false, mensaje: problemas.join(' '), minEsperado, maxEsperado };
}