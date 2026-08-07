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

export interface BackendComponentType {
  id: number;
  name: string;
}

export interface BackendLightDistrict {
  ubigeo: string;
  name: string;
}

export interface BackendOperationalStatus {
  code: string;
  name: string;
}

export interface BackendPhysicalStatus {
  code: string;
  name: string;
}

export interface BackendCriticality {
  id: number;
  name: string;
}

/**
 * Coordenada ligera embebida en el listado/retrieve de componentes (viene del
 * `ComponentCoordLightSerializer` del backend). El backend expone:
 *   - `id`            : id del ComponentCoord.
 *   - `criticality`   : objeto ligero `{ id, name }` (CriticalityLightSerializer).
 *   - `coords`        : WKT string de PostGIS ("SRID=4326;POINT(lng lat)").
 *   - `geojson`       : objeto GeoJSON Point { type, coordinates:[lng,lat] }
 *     (usar este para extraer lat/lon en el frontend).
 *   - `utm_coords`    : { easting, northing, srid, zone } calculado desde WGS84.
 */
export interface BackendComponentListCoord {
  id: number;
  criticality: { id: number; name: string };
  coords: string | null;
  geojson: {
    type: 'Point';
    coordinates: [number, number];
  } | null;
  utm_coords: {
    easting: number;
    northing: number;
    srid: number;
    zone: string;
  } | null;
}

/**
 * Item del endpoint `GET /components/components/` (listado). Tras el
 * último pull del backend, el listado usa `ComponentListSerializer`:
 *   - `type` y `district` son strings (StringRelatedField).
 *   - `coords[]` viene embebido (no es necesario llamar a /component-coords/).
 *   - No incluye `id`, `specification`, `operational_status` ni
 *     `physical_status` (esos solo están en el detalle).
 */
export interface BackendComponentListItem {
  id: number;
  code: string;
  name: string;
  type: string;
  district: string;
  coords: BackendComponentListCoord[];
  specification?: string | null;
  operational_status?: { code: string; name: string } | null;
  physical_status?: { code: string; name: string } | null;
}

/**
 * Detalle del endpoint `GET /components/components/:id/` (retrieve).
 * Usa `ComponentSerializer`, que sigue devolviendo las relaciones como
 * objetos (con id/name/code) e incluye `coords[]` embebido.
 */
export interface BackendComponent {
  id: number;
  code: string;
  name: string;
  type: BackendComponentType;
  district: BackendLightDistrict;
  operational_status: BackendOperationalStatus | null;
  physical_status: BackendPhysicalStatus | null;
  specification: string | null;
  coords: BackendComponentListCoord[];
}

/**
 * Coordenada del endpoint `/component-coords/` (se mantiene por compat).
 * Usado por el EditorComponentePage para el retrieve del componente en
 * edición; el nuevo flujo reemplazable por `BackendComponent.coords`
 * embebido.
 */
export interface BackendComponentCoord {
  id: number;
  component: BackendComponent;
  criticality: BackendCriticality;
  geojson: {
    type: 'Point';
    coordinates: [number, number];
  } | null;
}

async function fetchAllPages<T>(url: string, params?: Record<string, unknown>): Promise<T[]> {
  let all: T[] = [];
  let page = 1;
  let next: string | null;
  do {
    const res = await httpClient.get(url, { params: { page, ...params } });
    const data = res.data;
    all = all.concat(Array.isArray(data) ? data : (data.results ?? []));
    next = Array.isArray(data) ? null : data.next;
    page += 1;
  } while (next);
  return all;
}

export const apiComponentes = {
  async listComponentes(params?: {
    district?: string;
    search?: string;
  }): Promise<BackendComponentListItem[]> {
    return fetchAllPages<BackendComponentListItem>('/components/components/', params);
  },

  async getComponente(id: number): Promise<BackendComponent> {
    const res = await httpClient.get(`/components/components/${id}/`);
    return res.data;
  },

  async createComponente(body: {
    code: string;
    name: string;
    specification?: string;
    district: string;
    type: number;
    operational_status?: string | null;
    physical_status?: string | null;
    coords?: Array<{
      criticality: number;
      easting?: number;
      northing?: number;
      srid_origin?: number;
      latitude?: number;
      longitude?: number;
    }>;
  }): Promise<BackendComponent> {
    const res = await httpClient.post('/components/components/', body);
    return res.data;
  },

  async updateComponente(
    id: number,
    body: Partial<{
      code: string;
      name: string;
      specification?: string;
      district: string;
      type: number;
      operational_status?: string | null;
      physical_status?: string | null;
      coords?: Array<{
        criticality: number;
        easting?: number;
        northing?: number;
        srid_origin?: number;
        latitude?: number;
        longitude?: number;
      }>;
    }>,
  ): Promise<BackendComponent> {
    const res = await httpClient.patch(`/components/components/${id}/`, body);
    return res.data;
  },

  async deleteComponente(id: number): Promise<void> {
    await httpClient.delete(`/components/components/${id}/`);
  },

  async listCoords(params?: {
    component?: number;
  }): Promise<BackendComponentCoord[]> {
    return fetchAllPages<BackendComponentCoord>('/components/component-coords/', params);
  },

  async createCoord(body: {
    component: number;
    criticality: number;
    easting?: number;
    northing?: number;
    srid_origin?: number;
    latitude?: number;
    longitude?: number;
  }): Promise<BackendComponentCoord> {
    const res = await httpClient.post('/components/component-coords/', body);
    return res.data;
  },

  async updateCoord(
    id: number,
    body: Partial<{
      component: number;
      criticality: number;
      easting?: number;
      northing?: number;
      srid_origin?: number;
      latitude?: number;
      longitude?: number;
    }>,
  ): Promise<BackendComponentCoord> {
    const res = await httpClient.patch(`/components/component-coords/${id}/`, body);
    return res.data;
  },

  async deleteCoord(id: number): Promise<void> {
    await httpClient.delete(`/components/component-coords/${id}/`);
  },

  async listTipos(): Promise<BackendComponentType[]> {
    const res = await httpClient.get('/components/component-types/');
    return unwrap<BackendComponentType>(res.data);
  },

  async listCriticidades(): Promise<BackendCriticality[]> {
    const res = await httpClient.get('/components/criticalities/');
    return unwrap<BackendCriticality>(res.data);
  },

  async listEstadosOperacionales(): Promise<BackendOperationalStatus[]> {
    const res = await httpClient.get('/components/operational-statuses/');
    return unwrap<BackendOperationalStatus>(res.data);
  },

  async listEstadosFisicos(): Promise<BackendPhysicalStatus[]> {
    const res = await httpClient.get('/components/physical-statuses/');
    return unwrap<BackendPhysicalStatus>(res.data);
  },

  /**
   * Importa componentes desde un archivo CSV. El backend parsea,
   * valida FKs y devuelve preview o confirmación según `dryRun`.
   * Respuesta: { created, errors[], dry_run, preview_count }.
   *
   * Estrategia de validación = backend dry_run (recomendada):
   *   1. dryRun=true  → preview sin persistir (muestra al usuario
   *      qué se cargaría y si hay errores).
   *   2. dryRun=false → persiste transaccional. Si hay duplicados
   *      o errores de FK, aborta todo (rollback) y reporta en errors.
   *
   * El archivo CSV debe tener como columnas obligatorias:
   *   code,name,type,district_ubigeo,criticality,easting,northing
   * Y opcionales:
   *   operational_status,physical_status,specification
   *
   * Para líneas (conducción/aducción): N filas con MISMO `code` y
   * distintos easting/northing. Cada fila = 1 vértice.
   */
  async importCsv(file: File, dryRun = false): Promise<ImportResult> {
    const form = new FormData();
    form.append('file', file);
    const res = await httpClient.post(
      `/components/components/import-csv/?dry_run=${dryRun ? 'true' : 'false'}`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data;
  },

  /**
   * Importa componentes desde un archivo GeoJSON (FeatureCollection).
   * Cada Feature.Properties debe tener:
   *   code, name, type, district_ubigeo, criticality
   * Y opcionales: operational_status, physical_status, specification.
   * La geometry: Point (1 componente puntual) o LineString/MultiPoint
   * (N vértices para líneas de conducción/aducción). Coords WGS84 [lng, lat].
   *
   * Misma estrategia dry_run que `importCsv`.
   */
  async importGeojson(file: File, dryRun = false): Promise<ImportResult> {
    const form = new FormData();
    form.append('file', file);
    const res = await httpClient.post(
      `/components/components/import-geojson/?dry_run=${dryRun ? 'true' : 'false'}`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data;
  },
};

/** Resultado de importación (CSV o GeoJSON). */
export interface ImportError {
  row: number | null;
  code: string | null;
  message: string;
}

export interface ImportResult {
  created: number;
  errors: ImportError[];
  dry_run?: boolean;
  preview_count?: number;
}