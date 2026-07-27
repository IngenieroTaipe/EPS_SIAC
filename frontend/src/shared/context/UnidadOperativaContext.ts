import { createContext } from 'react';
import type { BackendDistrict } from '@/services/apiPlaces';

/**
 * UnidadOperativaContext — contexto compartido para la selección de
 * Unidad Operativa (distrito) entre el TopBar y las páginas de mapa.
 */

export type GeoJSONGeometry = {
  type: string;
  coordinates: unknown;
};

export interface UnidadOperativaContextValue {
  /** Nombre amigable seleccionado (ej. "La Merced") o "Todas". */
  selectedNombre: string;
  /** Setter por nombre amigable. */
  setSelectedNombre: (nombre: string) => void;
  /** Ubigeo del distrito seleccionado, o null si "Todas". */
  ubigeo: string | null;
  /** Polígono GeoJSON del distrito seleccionado. null si "Todas". */
  geojson: GeoJSONGeometry | null;
  /** Lista de los 5 distritos operativos con su geojson. */
  districts: BackendDistrict[];
  /** True mientras se cargan los distritos. */
  loading: boolean;
}

export const UnidadOperativaContext =
  createContext<UnidadOperativaContextValue | null>(null);

/**
 * Opciones fijas de Unidad Operativa (5 distritos del ámbito de la EPS).
 * Mapeadas a ubigeo del backend. "Todas" = null (sin filtro).
 */
export const UNIDADES_OPERATIVAS: Array<{
  ubigeo: string;
  nombre: string;
}> = [
  { ubigeo: '120301', nombre: 'La Merced' },
  { ubigeo: '120303', nombre: 'Pichanaqui-Sangani' },
  { ubigeo: '120305', nombre: 'San Ramón' },
  { ubigeo: '120601', nombre: 'Satipo' },
  { ubigeo: '190301', nombre: 'Oxapampa' },
];

/** Opción "Todas" (sin filtro de distrito). */
export const UNIDAD_TODAS = 'Todas';

/**
 * Mapea el nombre amigable de la unidad al ubigeo del backend.
 * "La Merced" → "120301" (Chanchamayo)
 */
export function nombreToUbigeo(nombre: string): string | null {
  if (nombre === UNIDAD_TODAS || !nombre) return null;
  const u = UNIDADES_OPERATIVAS.find((x) => x.nombre === nombre);
  return u?.ubigeo ?? null;
}

/**
 * Mapea el ubigeo al nombre amigable.
 */
export function ubigeoToNombre(ubigeo: string | null): string {
  if (!ubigeo) return UNIDAD_TODAS;
  const u = UNIDADES_OPERATIVAS.find((x) => x.ubigeo === ubigeo);
  return u?.nombre ?? UNIDAD_TODAS;
}

/**
 * Mapea el nombre del backend (ej. "CHANCHAMAYO") al nombre amigable
 * (ej. "La Merced") usando el ubigeo.
 */
export function backendNameToNombre(backendName: string, ubigeo: string): string {
  const u = UNIDADES_OPERATIVAS.find((x) => x.ubigeo === ubigeo);
  if (u) return u.nombre;
  return backendName;
}