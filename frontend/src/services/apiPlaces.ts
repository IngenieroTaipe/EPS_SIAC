import { httpClient } from './httpClient';

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

export interface BackendDistrict {
  ubigeo: string;
  name: string;
  geojson?: unknown;
}

export interface BackendProvince {
  ubigeo: string;
  name: string;
}

export interface BackendDepartment {
  ubigeo: string;
  name: string;
}

export interface BackendSector {
  code: string;
  name: string;
  status: boolean;
}

export const apiPlaces = {
  async listDepartments(): Promise<BackendDepartment[]> {
    const res = await httpClient.get('/places/departments/');
    return unwrap<BackendDepartment>(res.data);
  },

  async listProvinces(params?: { department?: string }): Promise<BackendProvince[]> {
    const res = await httpClient.get('/places/provinces/', { params });
    return unwrap<BackendProvince>(res.data);
  },

  async listDistricts(params?: {
    province?: string;
    department?: string;
  }): Promise<BackendDistrict[]> {
    const res = await httpClient.get('/places/districts/', { params });
    return unwrap<BackendDistrict>(res.data);
  },

  async getDistrict(ubigeo: string): Promise<BackendDistrict> {
    const res = await httpClient.get(`/places/districts/${ubigeo}/`);
    return res.data;
  },

  async listSectors(params?: {
    district?: string;
    status?: boolean;
  }): Promise<BackendSector[]> {
    const res = await httpClient.get('/places/sectors/', { params });
    return unwrap<BackendSector>(res.data);
  },
};