import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  UnidadOperativaContext,
  type UnidadOperativaContextValue,
  type GeoJSONGeometry,
  UNIDADES_OPERATIVAS,
  UNIDAD_TODAS,
  nombreToUbigeo,
} from './UnidadOperativaContext';
import { apiPlaces, type BackendDistrict } from '@/services/apiPlaces';

/**
 * Provider del UnidadOperativaContext.
 *
 * Al montar, carga los 5 distritos operativos desde el backend (con geojson).
 * El selector del TopBar usa `selectedNombre`/`setSelectedNombre`.
 * Las páginas de mapa usan `ubigeo`/`geojson` para filtrar y dibujar contornos.
 */

const STORAGE_KEY = 'eps_siac_unidad_nombre';

export function UnidadOperativaProvider({ children }: { children: ReactNode }) {
  const [selectedNombre, setSelectedNombreState] = useState<string>(() => {
    if (typeof window === 'undefined') return UNIDAD_TODAS;
    return window.localStorage.getItem(STORAGE_KEY) ?? UNIDAD_TODAS;
  });
  const [districts, setDistricts] = useState<BackendDistrict[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar los 5 distritos operativos al montar.
  useEffect(() => {
    let cancelled = false;
    const ubigeos = UNIDADES_OPERATIVAS.map((u) => u.ubigeo);
    Promise.all(
      ubigeos.map((ub) =>
        apiPlaces.getDistrict(ub).catch(() => null),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const valid = results.filter(
          (r): r is BackendDistrict => r !== null,
        );
        setDistricts(valid);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setSelectedNombre = useCallback((nombre: string) => {
    setSelectedNombreState(nombre);
    window.localStorage.setItem(STORAGE_KEY, nombre);
  }, []);

  const ubigeo = useMemo(() => nombreToUbigeo(selectedNombre), [selectedNombre]);

  const geojson = useMemo<GeoJSONGeometry | null>(() => {
    if (!ubigeo) return null;
    const d = districts.find((x) => x.ubigeo === ubigeo);
    return (d?.geojson as GeoJSONGeometry) ?? null;
  }, [ubigeo, districts]);

  const value = useMemo<UnidadOperativaContextValue>(
    () => ({
      selectedNombre,
      setSelectedNombre,
      ubigeo,
      geojson,
      districts,
      loading,
    }),
    [selectedNombre, setSelectedNombre, ubigeo, geojson, districts, loading],
  );

  return (
    <UnidadOperativaContext.Provider value={value}>
      {children}
    </UnidadOperativaContext.Provider>
  );
}