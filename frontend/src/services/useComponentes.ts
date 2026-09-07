import { useEffect, useState } from 'react';
import { hasAccessToken } from './httpClient';
import { cachedGet, invalidateCache } from './requestCache';
import { apiComponentes } from './apiComponentes';
import { adaptarComponentes, adaptarComponentesMap } from './adaptadores';
import type { ComponentesResponse } from '@/features/mapa/types/componente';

export interface UseComponentesResult {
  data: ComponentesResponse;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

const EMPTY_RESPONSE: ComponentesResponse = { componentes: [], tramos: [] };

export function useComponentes(): UseComponentesResult {
  const [data, setData] = useState<ComponentesResponse>(EMPTY_RESPONSE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hasAccessToken()) {
        setData(EMPTY_RESPONSE);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const comps = await apiComponentes.listComponentes();
        if (!cancelled) {
          setData(adaptarComponentes(comps));
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          setData(EMPTY_RESPONSE);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  return {
    data,
    loading,
    error,
    refetch: () => setReloadTick((t) => t + 1),
  };
}

/**
 * `useComponentesMap` — hook para la capa del mapa. Consume el endpoint
 * `/components/components/map` (compilado en PostGIS, con `geojson` +
 * `criticality` por coord, sin paginación). A diferencia de
 * `useComponentes` (listado normal, para la tabla), éste trae geometrías
 * pero no UTM/specification/physical_status.
 *
 * Usa `cachedGet` (memoria + localStorage, TTL 5 min): cuando la página
 * del mapa Y el `ComponentLayer` consumen este hook a la vez (regla de
 * hooks: la capa siempre lo llama aunque reciba `data`), la promesa en
 * vuelo se deduplica → un solo fetch real. Se invalida desde
 * `apiComponentes` al crear/editar/eliminar componentes o coords.
 */
const MAP_CACHE_KEY = 'components:map';
const MAP_CACHE_TTL_MS = 5 * 60_000;

export function useComponentesMap(): UseComponentesResult {
  const [data, setData] = useState<ComponentesResponse>(EMPTY_RESPONSE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hasAccessToken()) {
        setData(EMPTY_RESPONSE);
        setError(null);
        setLoading(false);
        return;
      }

      // (Sin eslint-disable: los setState viven dentro de `load()` (async),
      // no directos en el body del effect, así que no disparan la regla.)
      setLoading(true);
      try {
        const adapted = await cachedGet<ComponentesResponse>(
          MAP_CACHE_KEY,
          async () => adaptarComponentesMap(await apiComponentes.listComponentesForMap()),
          MAP_CACHE_TTL_MS,
        );
        if (!cancelled) {
          setData(adapted);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          setData(EMPTY_RESPONSE);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  return {
    data,
    loading,
    error,
    // refetch SIEMPRE golpea red: invalida la caché antes de re-disparar.
    refetch: () => {
      invalidateCache(MAP_CACHE_KEY);
      setReloadTick((t) => t + 1);
    },
  };
}