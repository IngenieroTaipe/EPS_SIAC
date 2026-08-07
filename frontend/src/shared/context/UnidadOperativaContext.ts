import { createContext } from 'react';
import type { BackendDistrict } from '@/services/apiPlaces';
import type { BackendBranch } from '@/services/apiOrganization';

/**
 * UnidadOperativaContext — contexto compartido para la selección de
 * Unidad Operativa (Branch) entre el TopBar y las páginas de mapa.
 *
 * Antes la lista de unidades era un array fijo (`UNIDADES_OPERATIVAS`)
 * mapeado a ubigeos hardcoded. Ahora se carga dinámicamente desde el
 * endpoint `GET /organization/branches/?status=true`; cada branch trae
 * su `district.ubigeo` que se usa para resolver el GeoJSON del distrito
 * (vía `GET /places/districts/{ubigeo}/`).
 */

export type GeoJSONGeometry = {
  type: string;
  coordinates: unknown;
};

export interface UnidadOperativaContextValue {
  /** Etiqueta seleccionada (branch.name, ej. "LA MERCED - CHANCHAMAYO") o "Todas". */
  selectedNombre: string;
  /** Setter por nombre de branch. */
  setSelectedNombre: (nombre: string) => void;
  /** Ubigeo del distrito asociado al branch seleccionado, o null si "Todas". */
  ubigeo: string | null;
  /** Polígono GeoJSON del distrito seleccionado. null si "Todas" o sin geojson. */
  geojson: GeoJSONGeometry | null;
  /** Lista completa de branches activos desde el backend. */
  branches: BackendBranch[];
  /** Distritos (con geojson) resueltos a partir de los branches activos. */
  districts: BackendDistrict[];
  /** True mientras se cargan branches + geojsons. */
  loading: boolean;
}

export const UnidadOperativaContext =
  createContext<UnidadOperativaContextValue | null>(null);

/** Opción "Todas" (sin filtro de unidad operativa). */
export const UNIDAD_TODAS = 'Todas';