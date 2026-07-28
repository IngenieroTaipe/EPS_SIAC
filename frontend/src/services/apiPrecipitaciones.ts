import { httpClient } from './httpClient';

interface PaginatedResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

export interface EMCWFRequest {
  id: number;
  request_code: string;
  status: string;
  target_variable: string;
  date_range_start: string;
  date_range_end: string;
  file_name: string | null;
  file_path: string | null;
  file_size_mb: number | null;
  download_time_seconds: number | null;
  geojson_path: string | null;
}

export interface PrecipFeatureProperties {
  timestamps: string[];
  intensity_mm_h: number[];
  accumulated_period_mm: number;
  centroid: [number, number];
  intersected_districts: Array<{
    district_name: string;
    ubigeo: string;
    thresholds: Array<{
      natural_phenomena_name: string;
      threshold_name: string;
      min_value: number | null;
      max_value: number | null;
    }>;
  }>;
}

export interface PrecipFeatureCollection {
  type: 'FeatureCollection';
  crs?: {
    type: string;
    properties: { name: string };
  };
  features: Array<{
    type: 'Feature';
    geometry: {
      type: 'Polygon';
      coordinates: number[][][];
    };
    properties: PrecipFeatureProperties;
  }>;
}

export const apiPrecipitaciones = {
  /** Lista solicitudes EMCWF (paginado, trae todas). */
  async listRequests(params?: {
    status?: string;
  }): Promise<EMCWFRequest[]> {
    let all: EMCWFRequest[] = [];
    let page = 1;
    let next: string | null = null;
    do {
      const res = await httpClient.get('/core_predictive/emcwf-requests/', {
        params: { page, ordering: '-created_at', ...params },
      });
      const data = res.data;
      all = all.concat(
        Array.isArray(data) ? data : (data as PaginatedResponse<EMCWFRequest>).results ?? [],
      );
      next = Array.isArray(data) ? null : (data as PaginatedResponse<EMCWFRequest>).next ?? null;
      page += 1;
    } while (next);
    return all;
  },

  /** Obtiene la solicitud EMCWF completada más reciente. */
  async getLatestCompleted(): Promise<EMCWFRequest | null> {
    const all = await this.listRequests({ status: 'COMPLETED' });
    return all.length > 0 ? all[0] : null;
  },

  /** Descarga el GeoJSON procesado de una solicitud EMCWF. */
  async downloadGeoJson(requestId: number): Promise<PrecipFeatureCollection> {
    const res = await httpClient.get(
      `/core_predictive/emcwf-requests/${requestId}/download-geojson/`,
      { responseType: 'json' },
    );
    return res.data as PrecipFeatureCollection;
  },
};