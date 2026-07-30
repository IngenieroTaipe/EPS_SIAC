import { useEffect, useState } from 'react';
import { apiComponentes } from './apiComponentes';
import { adaptarComponentes } from './adaptadores';
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