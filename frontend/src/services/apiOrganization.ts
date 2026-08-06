import { httpClient } from './httpClient';

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

export const apiOrganization = {
  /**
    * Lista TODAS las sucursales (unidades operativas). Opcionalmente filtra
    * por `status` (true = sólo operativas). Sin paginación server-side: se
    * recorre `next` hasta agotar resultados.
    */
  async listBranches(params?: { status?: boolean }): Promise<BackendBranch[]> {
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
    return res.data;
  },

  async deleteBranch(id: number): Promise<void> {
    await httpClient.delete(`/organization/branches/${id}/`);
  },
};