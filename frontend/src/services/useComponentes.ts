import { useEffect, useState } from 'react';
import { hasAccessToken } from './httpClient';
import { apiComponentes } from './apiComponentes';
import { adaptarComponentes } from './adaptadores';
import { mockComponentes } from '@/features/mapa/data/mockComponentes';
import type { ComponentesResponse } from '@/features/mapa/types/componente';

export interface UseComponentesResult {
  data: ComponentesResponse;
  loading: boolean;
  error: Error | null;
  isMock: boolean;
  refetch: () => void;
}

export function useComponentes(): UseComponentesResult {
  const [data, setData] = useState<ComponentesResponse>(mockComponentes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hasAccessToken()) {
        setData(mockComponentes);
        setError(null);
        return;
      }

      setLoading(true);
      try {
        const [comps, coords] = await Promise.all([
          apiComponentes.listComponentes(),
          apiComponentes.listCoords(),
        ]);
        if (!cancelled) {
          setData(adaptarComponentes(comps, coords));
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          setData(mockComponentes);
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
    isMock: !hasAccessToken(),
    refetch: () => setReloadTick((t) => t + 1),
  };
}