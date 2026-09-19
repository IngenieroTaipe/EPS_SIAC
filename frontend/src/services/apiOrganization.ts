import { httpClient } from './httpClient';
import { cachedGet, invalidateCachePrefix } from './requestCache';

/**
 * Branch (Sucursal) — representa una Unidad Operativa de la EPS Selva
 * Central. Cada branch está asociado a un distrito (vía `district.ubigeo`)
 * y tiene un `status` (true = operativo).
 *
 * Endpoint: `GET /organization/branches/`
 *
 * Seed de datos: `backend/organization/data/branches.json` via el comando
 * `python manage.py seed_organization`. Si el endpoint retorna `count: 0`
 * es porque el seed no se ha ejecutado en la DB actual.
 */
export interface BackendBranchDistrict {
  ubigeo: string;
  name: string;
}

export interface BackendBranch {
  id: number;
  code: string;
  name: string;
  acronym: string;
  status: boolean;
  district: string | BackendBranchDistrict;
  observations?: string | null;
}

/**
 * Feature de `GET /organization/branches/map/`: una branch activa con la
 * geometría (MultiPolygon, SRID 4326) del distrito asociado. `id` a nivel
 * de feature = id de la branch.
 */
export interface BackendBranchMapFeature {
  type: 'Feature';
  id?: number | string;
  properties: {
    code: string;
    name: string;
    acronym: string;
    district_name: string;
    district_ubigeo: string;
  };
  geometry: unknown;
}

export interface BackendBranchMapFeatureCollection {
  type: 'FeatureCollection';
  features: BackendBranchMapFeature[];
}

export const apiOrganization = {
  /**
   * Lista TODAS las sucursales (unidades operativas). Opcionalmente filtra
   * por `status` (true = sólo operativas). Sin paginación server-side: se
   * recorre `next` hasta agotar resultados. Cacheado 5 min (memoria +
   * localStorage): payload chico (~1-2 KB) y TTL corto para que las UO
   * creadas por OTROS usuarios (otro navegador — la invalidación local no
   * les llega) aparezcan rápido en los filtros; los writes de este mismo
   * módulo invalidan al instante en la sesión actual.
   */
  async listBranches(params?: { status?: boolean }): Promise<BackendBranch[]> {
    const cacheKey = `branches:list:${
      params?.status === undefined ? 'all' : params.status ? 'active' : 'inactive'
    }`;
    const fetchAll = async (): Promise<BackendBranch[]> => {
      const all: BackendBranch[] = [];
      let page = 1;
      let next: string | null;
      do {
        const res = await httpClient.get('/organization/branches/', {
          params: { page, ...(params ?? {}) },
        });
        const data = res.data;
        all.push(...(Array.isArray(data) ? data : (data.results ?? [])));
        next = Array.isArray(data) ? null : data.next;
        page += 1;
      } while (next);
      return all;
    };
    return cachedGet(cacheKey, fetchAll, 5 * 60 * 1000);
  },

  /**
   * Capa geoespacial de branches ACTIVAS con el polígono del distrito de
   * cada una, en UNA sola request (compilada en PostGIS por el backend,
   * sin paginación). Equivale a lo que antes se armaba con listBranches +
   * un GET por distrito. Sin caché: se consume una vez por sesión (provider
   * global de UnidadOperativa).
   */
  async getBranchesMap(): Promise<BackendBranchMapFeatureCollection> {
    const res = await httpClient.get('/organization/branches/map/');
    return res.data as BackendBranchMapFeatureCollection;
  },

  // === Administración (solo admin) ===
  async createBranch(payload: {
    district: string;
    code: string;
    name: string;
    acronym: string;
    status?: boolean;
    observations?: string;
  }): Promise<BackendBranch> {
    const res = await httpClient.post('/organization/branches/', payload);
    invalidateCachePrefix('branches:');
    return res.data;
  },

  async updateBranch(
    id: number,
    payload: Partial<{
      district: string;
      code: string;
      name: string;
      acronym: string;
      status: boolean;
      observations: string;
    }>,
  ): Promise<BackendBranch> {
    const res = await httpClient.patch(`/organization/branches/${id}/`, payload);
    invalidateCachePrefix('branches:');
    return res.data;
  },

  async deleteBranch(id: number): Promise<void> {
    await httpClient.delete(`/organization/branches/${id}/`);
    invalidateCachePrefix('branches:');
  },
};