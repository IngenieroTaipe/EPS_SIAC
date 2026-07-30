import { httpClient } from './httpClient';
import { cachedGet, invalidateCachePrefix } from './requestCache';

/**
 * apiUmbrales — cliente del endpoint de Umbrales de Fenómenos Naturales.
 *
 *   GET    /core_predictive/thresholds-natural-phenomenas/        (listado)
 *   POST   /core_predictive/thresholds-natural-phenomenas/       (crear)
 *   PATCH  /core_predictive/thresholds-natural-phenomenas/:id/   (editar)
 *   DELETE /core_predictive/thresholds-natural-phenomenas/:id/   (eliminar)
 *
 * Y los catálogos relacionados:
 *   GET /core_predictive/natural-phenomenas/
 *   GET /core_predictive/variables/
 *   GET /core_predictive/thresholds/
 *
 * El serializador `ThresholdNaturalPhenomenaSerializer` exige en escritura
 * los PK de cada relación: natural_phenomena (int), variable (int),
 * threshold (int) y district (ubigeo string), además de min_value/max_value.
 * En lectura, `to_representation` anida los objetos livianos {id|ubigeo, name}.
 */

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

async function fetchAllPages<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  for (;;) {
    const res = await httpClient.get(url, { params: { page, ...params } });
    const data = res.data;
    all.push(...(Array.isArray(data) ? data : (data.results ?? [])));
    const next: string | null = Array.isArray(data) ? null : data.next ?? null;
    if (!next) break;
    page += 1;
  }
  return all;
}

/**
 * Desduplica registros de umbrales por contenido (manteniendo el primer id
 * visto). El backend no impone unicidad, así que pueden existir varias filas
 * idénticas con distintos ids cuando se repiten POSTs.
 */
function dedupeUmbrales(items: UmbralFenomeno[]): UmbralFenomeno[] {
  const seen = new Set<string>();
  const out: UmbralFenomeno[] = [];
  for (const u of items) {
    const key = [
      u.district?.ubigeo ?? '',
      u.threshold?.id ?? '',
      u.variable?.id ?? '',
      u.natural_phenomena?.id ?? '',
      u.min_value ?? '',
      u.max_value ?? '',
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out;
}

export interface LightRef {
  id: number;
  name: string;
}

export interface DistrictLightRef {
  ubigeo: string;
  name: string;
}

/** Forma devuelta por el GET (con `to_representation` anidando objetos). */
export interface UmbralFenomeno {
  id: number;
  natural_phenomena: LightRef;
  variable: LightRef;
  district: DistrictLightRef;
  threshold: LightRef;
  min_value: number | null;
  max_value: number | null;
}

/** Cuerpo de creación/edición (usa PK crudos). */
export interface UmbralInput {
  natural_phenomena: number;
  variable: number;
  district: string; // ubigeo (PK de places.District)
  threshold: number;
  min_value?: number | null;
  max_value?: number | null;
}

export const apiUmbrales = {
  /**
   * Lista todos los umbrales; opcionalmente filtra por ubigeo del distrito.
   *
   * Desduplica por contenido (district ubigeo + threshold id + variable id
   * + natural_phenomena id + min_value + max_value): el modelo del backend
   * `ThresholdsNaturalPhenomena` NO tiene `unique_together`, así que POST
   * repetidos pueden crear filas reales idénticas con distinto id. Aquí nos
   * quedamos con el primer id visto de cada grupo para que la UI muestre un
   * único registro lógico por combo.
   */
  async listUmbrales(params?: {
    district?: string; // ubigeo
    'district__ubigeo'?: string;
    natural_phenomena?: number;
    variable?: number;
    threshold?: number;
  }): Promise<UmbralFenomeno[]> {
    // Caché en localStorage: lista de umbrales (read-only en gestión).
    // TTL largo (1h) porque los umbrales cambian poco; al crear/editar/eliminar
    // desde este cliente se invalida automáticamente. Sobrevive a recargas.
    const key = `umbrales:${JSON.stringify(params ?? {})}`;
    return cachedGet(key, async () => {
      const all = await fetchAllPages<UmbralFenomeno>(
        '/core_predictive/thresholds-natural-phenomenas/',
        params,
      );
      return dedupeUmbrales(all);
    }, 60 * 60_000);
  },

  async createUmbral(body: UmbralInput): Promise<UmbralFenomeno> {
    const res = await httpClient.post(
      '/core_predictive/thresholds-natural-phenomenas/',
      body,
    );
    invalidateCachePrefix('umbrales:');
    return res.data;
  },

  async updateUmbral(id: number, body: Partial<UmbralInput>): Promise<UmbralFenomeno> {
    const res = await httpClient.patch(
      `/core_predictive/thresholds-natural-phenomenas/${id}/`,
      body,
    );
    invalidateCachePrefix('umbrales:');
    return res.data;
  },

  async deleteUmbral(id: number): Promise<void> {
    await httpClient.delete(`/core_predictive/thresholds-natural-phenomenas/${id}/`);
    invalidateCachePrefix('umbrales:');
  },

  async listNaturalPhenomena(): Promise<LightRef[]> {
    const res = await httpClient.get('/core_predictive/natural-phenomenas/');
    return unwrap<LightRef>(res.data);
  },

  async listVariables(): Promise<LightRef[]> {
    const res = await httpClient.get('/core_predictive/variables/');
    return unwrap<LightRef>(res.data);
  },

  async listThresholds(): Promise<LightRef[]> {
    const res = await httpClient.get('/core_predictive/thresholds/');
    return unwrap<LightRef>(res.data);
  },
};