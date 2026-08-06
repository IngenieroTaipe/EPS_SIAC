import { useEffect, useState } from 'react';
import { apiGFS } from './apiGFS';
import { invalidateCache } from './requestCache';
import type { GfsClusterFeatureCollection } from '@/features/mapa/types/gfs';
import { smoothGeometry } from '@/features/mapa/utils/smoothGeometry';

/**
 * Iteraciones del suavizado de Chaikin aplicado a los clústeres (default 2).
 * Transforma los escalones de la grilla (~10 km) en curvas suaves y orgánicas.
 */
const CLUSTER_SMOOTH_ITERATIONS = 2;

export interface UseGfsForecastResult {
  /** GeoJSON de la ventana 18h tal cual lo devuelve el backend. */
  data: GfsClusterFeatureCollection | null;
  loading: boolean;
  error: Error | null;
  /** Fuerza una nueva petición al backend (también activa loading). */
  refetch: () => void;
}

/**
 * Hook que trae el GeoJSON GFS de la ventana 18h (clústeres disueltos) desde
 * `/api/v1/core_predictive/gfs-clusters-snapshots/window-18h/`.
 *
 * El backend ya devuelve celdas activas agrupadas en clústeres por paso
 * horario (~300 features combinando HISTORIC + FORECAST). El agrupado en
 * frames por `time_step`+`temporal_status` lo decide el frontend en la capa.
 *
 * Nota: el `setLoading(true)` vive en `refetch` (manejador de evento), no en
 * el effect body, para no violar la regla `react-hooks/set-state-in-effect`.
 * El estado inicial ya es `loading: true`, así la carga inicial está cubierta.
 */
export function useGfsForecast(): UseGfsForecastResult {
  const [data, setData] = useState<GfsClusterFeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiGFS
      .getWindow18h()
      .then((geojson) => {
        if (cancelled) return;
        // === PRE-PROCESADO UNA SOLA VEZ: suavizado visual de bordes ===
        // Cada feature conserva su `geometry` original (intacto) para
        // cualquier cálculo espacial futuro (point-in-polygon, intersección
        // con componentes/ubigeos). El resultado suavizado se guarda en
        // `properties._smoothedGeometry`, y la capa Leaflet lo usa sólo para
        // pintar. NUNCA el suavizado debe reemplazar a `geometry`.
        const smoothedFeatures = geojson.features.map((f) => {
          const sm = smoothGeometry(f.geometry, CLUSTER_SMOOTH_ITERATIONS);
          return {
            ...f,
            properties: {
              ...f.properties,
              _smoothedGeometry: sm,
            },
          };
        });
        // === TEMPORAL: diagnostico suavizado (borrar tras verificar) ===
        // eslint-disable-next-line no-console
        console.log('[useGfsForecast] smoothGeometry check (muestra 3):', 'total=', smoothedFeatures.length);
        for (const f of smoothedFeatures.slice(0, 3)) {
          const sm = f.properties._smoothedGeometry;
          const orig = f.geometry;
          // eslint-disable-next-line no-console
          console.log({
            type: orig.type,
            origCoordsLen: JSON.stringify(orig).split(',').length,
            smoothedType: sm?.type,
            smoothedCoordsLen: sm ? JSON.stringify(sm).split(',').length : null,
            sameRef: sm === orig,
          });
        }
        setData({ ...geojson, features: smoothedFeatures });
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
    // Invalida la caché (memoria + localStorage) para que el refetch SIEMPRE
    // consulte al backend. Sin esto, `cachedGet` devolvía el valor cacheado
    // con TTL de 10 min y el polling de 5 min nunca veía corridas nuevas.
    invalidateCache('gfs:window-18h');
    setLoading(true);
    setTick((t) => t + 1);
  }

  return { data, loading, error, refetch };
}