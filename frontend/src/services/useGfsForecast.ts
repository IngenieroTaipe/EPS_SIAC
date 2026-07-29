import { useEffect, useState } from 'react';
import { apiGFS } from './apiGFS';
import type { GfsFeatureCollection } from '@/features/mapa/types/gfs';

export interface UseGfsForecastResult {
  /** GeoJSON tal cual lo devuelve el backend (sin filtrar). */
  data: GfsFeatureCollection | null;
  loading: boolean;
  error: Error | null;
  /** Fuerza una nueva petición al backend (también activa loading). */
  refetch: () => void;
}

/**
 * Hook que trae el GeoJSON GFS más reciente desde
 * `/api/v1/core_predictive/gfs-active-cells/latest/`.
 *
 * No aplica filtrado por distrito (la grilla GFS es nacional y el backend ya
 * devuelve celdas activas). Si en el futuro se necesita filtrar por unidad
 * operativa, derivar el ubigeo desde `useUnidadOperativa` y filtrar features
 * por `intersected_districts.*.ubigeo` aquí mismo.
 *
 * Nota: el `setLoading(true)` vive en `refetch` (manejador de evento), no en
 * el effect body, para no violar la regla `react-hooks/set-state-in-effect`.
 * El estado inicial ya es `loading: true`, así la carga inicial está cubierta.
 */
export function useGfsForecast(): UseGfsForecastResult {
  const [data, setData] = useState<GfsFeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiGFS
      .getLatest()
      .then((geojson) => {
        if (cancelled) return;
        setData(geojson);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  function refetch() {
    setLoading(true);
    setTick((t) => t + 1);
  }

  return { data, loading, error, refetch };
}