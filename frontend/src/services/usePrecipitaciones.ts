import { useEffect, useState } from 'react';
import { hasAccessToken } from './httpClient';
import { apiPrecipitaciones, type PrecipFeatureCollection } from './apiPrecipitaciones';
import { useUnidadOperativa } from '@/shared/context/useUnidadOperativa';
import { nivelFromIntensity, type PrecipNivel } from '@/features/mapa/types/precipitacion';
import type { GeoJSONGeometry } from '@/shared/context/UnidadOperativaContext';
import turfIntersect from '@turf/intersect';
import turfArea from '@turf/area';
import { feature as turfFeature } from '@turf/helpers';

// Mock: importado con ?raw (string) y parseado a JSON.
// Workaround para que TS no se queje de la extensión .geojson.json.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import mockGeoJsonStr from '../features/mapa/data/mockPrecipitaciones.geojson.json?raw';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGeoJson: any = JSON.parse(mockGeoJsonStr);

export interface UsePrecipitacionesResult {
  /** GeoJSON ya filtrado por distrito (si hay seleccionado) y adaptado al formato del frontend. */
  data: PrecipFeatureCollection | null;
  loading: boolean;
  error: Error | null;
  isMock: boolean;
  /** Intensidad máxima encontrada (para info). */
  maxIntensity: number;
  refetch: () => void;
}

/**
 * Hook que trae el GeoJSON de precipitaciones del backend (última solicitud
 * EMCWF completada) y lo filtra por el distrito seleccionado en el contexto
 * de Unidad Operativa.
 *
 * Si no hay token o falla el fetch, cae al mock estático.
 */
export function usePrecipitaciones(): UsePrecipitacionesResult {
  const [data, setData] = useState<PrecipFeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const { ubigeo, geojson: distritoGeojson } = useUnidadOperativa();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hasAccessToken()) {
        setData(filterAndAdapt(mockGeoJson as unknown as PrecipFeatureCollection, ubigeo, distritoGeojson));
        setError(null);
        return;
      }

      setLoading(true);
      try {
        const latest = await apiPrecipitaciones.getLatestCompleted();
        if (!latest) {
          setData(filterAndAdapt(mockGeoJson as unknown as PrecipFeatureCollection, ubigeo, distritoGeojson));
          setError(null);
          return;
        }

        const geojson = await apiPrecipitaciones.downloadGeoJson(latest.id);
        if (!cancelled) {
          setData(filterAndAdapt(geojson, ubigeo, distritoGeojson));
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          setData(filterAndAdapt(mockGeoJson as unknown as PrecipFeatureCollection, ubigeo, distritoGeojson));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadTick, ubigeo, distritoGeojson]);

  const maxIntensity = computeMaxIntensity(data);

  return {
    data,
    loading,
    error,
    isMock: !hasAccessToken(),
    maxIntensity,
    refetch: () => setReloadTick((t) => t + 1),
  };
}

/**
 * Calcula el bounding box [minLng, minLat, maxLng, maxLat] de un GeoJSON.
 */
function getBBox(geojson: GeoJSONGeometry | null): [number, number, number, number] | null {
  if (!geojson) return null;
  try {
    const coords = JSON.stringify(geojson);
    const nums = coords.match(/-?\d+\.?\d*/g);
    if (!nums) return null;
    let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
    for (let i = 0; i < nums.length; i += 2) {
      const lng = parseFloat(nums[i]);
      const lat = parseFloat(nums[i + 1]);
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
    return [minLng, minLat, maxLng, maxLat];
  } catch {
    return null;
  }
}

/**
 * Filtra el GeoJSON por distrito y adapta las properties al formato del frontend.
 *
 * Estrategia de filtrado:
 * 1. Si la feature tiene `intersected_districts` con el ubigeo → incluir.
 * 2. Si no tiene intersected_districts → filtrar por bounding box del distrito.
 * 3. Si no hay ubigeo seleccionado → incluir todas.
 *
 * Recorte de celdas:
 * Cuando hay un distrito seleccionado, cada celda se recorta con el polígono
 * del distrito usando `@turf/intersect` para que las celdas cuadradas encajen
 * exacto en la silueta del distrito (sin sobresalir).
 */
function filterAndAdapt(
  geojson: PrecipFeatureCollection,
  ubigeo: string | null,
  distritoGeojson: GeoJSONGeometry | null,
): PrecipFeatureCollection {
  if (!geojson || !geojson.features) return geojson;

  const bbox = ubigeo ? getBBox(distritoGeojson) : null;
  // Construir un Feature de Turf para el polígono del distrito (para intersect).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const distritoTurf = distritoGeojson ? turfFeature(distritoGeojson as any) : null;

  const features = geojson.features
    .filter((f) => {
      if (!ubigeo) return true;

      // Estrategia 1: intersected_districts del backend.
      const dists = f.properties?.intersected_districts ?? [];
      if (dists.length > 0) {
        return dists.some((d) => d.ubigeo === ubigeo);
      }

      // Estrategia 2: fallback por bounding box del distrito.
      if (bbox) {
        const centroid = f.properties?.centroid;
        if (centroid && centroid.length >= 2) {
          const [lng, lat] = centroid;
          return (
            lng >= bbox[0] && lng <= bbox[2] &&
            lat >= bbox[1] && lat <= bbox[3]
          );
        }
      }

      return false;
    })
    .map((f) => {
      const props = f.properties ?? ({} as Record<string, unknown>);

      // Recortar la celda al polígono del distrito con Turf.
      let geometry = f.geometry;
      if (ubigeo && distritoTurf) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cellTurf = turfFeature(f.geometry as any);
          const intersection = turfIntersect(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            distritoTurf as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cellTurf as any,
          );
          if (intersection && intersection.geometry) {
            // Solo incluir si la intersección tiene área significativa (>0.5 km²).
            const area = turfArea(intersection);
            if (area > 500000) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              geometry = intersection.geometry as any;
            }
          }
        } catch {
          // Si la intersección falla (polígonos complejos), dejar la celda original.
        }
      }

      // Calcular nivel desde intensity_mm_h.
      if ('nivel' in props) {
        return { ...f, geometry };
      }

      const arr = (props as { intensity_mm_h?: number[] }).intensity_mm_h ?? [];
      const avg = arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const nivel: PrecipNivel = nivelFromIntensity(avg);

      return {
        ...f,
        geometry,
        properties: {
          ...props,
          nivel,
          mm_h: Math.round(avg * 100) / 100,
        },
      };
    });

  return { ...geojson, features };
}

function computeMaxIntensity(data: PrecipFeatureCollection | null): number {
  if (!data || !data.features) return 0;
  let max = 0;
  for (const f of data.features) {
    const mmh = (f.properties as { mm_h?: number }).mm_h ?? 0;
    if (mmh > max) max = mmh;
  }
  return max;
}