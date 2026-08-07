import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  UnidadOperativaContext,
  type UnidadOperativaContextValue,
  type GeoJSONGeometry,
  UNIDAD_TODAS,
} from './UnidadOperativaContext';
import { apiPlaces, type BackendDistrict } from '@/services/apiPlaces';
import { apiOrganization, type BackendBranch } from '@/services/apiOrganization';

/**
 * Provider del UnidadOperativaContext.
 *
 * Al montar:
 *   1. Carga los branches activos desde `GET /organization/branches/?status=true`.
 *   2. Valida que el nombre guardado en localStorage corresponda a un branch
 *      activo; si no, resetea a "Todas".
 *   3. Por cada branch (con su `district.ubigeo`) resuelve el geojson del
 *      distrito vía `GET /places/districts/{ubigeo}/` en paralelo.
 *
 * El selector del TopBar usa `selectedNombre`/`setSelectedNombre` contra
 * `branch.name` (que es unique en el backend). Las páginas de mapa usan
 * `ubigeo`/`geojson` para filtrar y dibujar contornos.
 */

const STORAGE_KEY = 'eps_siac_unidad_nombre';

function branchUbigeo(b: BackendBranch): string | null {
  if (!b.district) return null;
  return typeof b.district === 'string' ? b.district : b.district.ubigeo;
}

export function UnidadOperativaProvider({ children }: { children: ReactNode }) {
  const [selectedNombre, setSelectedNombreState] = useState<string>(() => {
    if (typeof window === 'undefined') return UNIDAD_TODAS;
    return window.localStorage.getItem(STORAGE_KEY) ?? UNIDAD_TODAS;
  });
  const [branches, setBranches] = useState<BackendBranch[]>([]);
  const [districts, setDistricts] = useState<BackendDistrict[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar branches activos + resolver geojson de cada distrito.
  useEffect(() => {
    let cancelled = false;

    apiOrganization
      .listBranches({ status: true })
      .then((list) => {
        if (cancelled) return;
        setBranches(list);

        // Recolectar ubigeos únicos para resolver sus geojsons.
        const ubigeos = Array.from(
          new Set(
            list
              .map(branchUbigeo)
              .filter((u): u is string => typeof u === 'string'),
          ),
        );

        return Promise.all(
          ubigeos.map((ub) =>
            apiPlaces.getDistrict(ub).catch(() => null),
          ),
        );
      })
      .then((results) => {
        if (cancelled || !results) return;
        const valid = results.filter(
          (r): r is BackendDistrict => r !== null,
        );
        setDistricts(valid);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setBranches([]);
          setDistricts([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Validar que el nombre guardado exista entre los branches cargados.
  // Si no (rename, eliminación, o leftover del modelo anterior con 5
  // distritos hardcoded), resetear a "Todas" de forma idempotente.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reconciliación
       one-shot entre localStorage y la lista de branches vigente. */
    if (loading || branches.length === 0) return;
    if (selectedNombre === UNIDAD_TODAS) return;
    const existe = branches.some((b) => b.name === selectedNombre);
    if (!existe) {
      setSelectedNombreState(UNIDAD_TODAS);
      window.localStorage.setItem(STORAGE_KEY, UNIDAD_TODAS);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [branches, loading, selectedNombre]);

  const setSelectedNombre = useCallback((nombre: string) => {
    setSelectedNombreState(nombre);
    window.localStorage.setItem(STORAGE_KEY, nombre);
  }, []);

  const ubigeo = useMemo<string | null>(() => {
    if (selectedNombre === UNIDAD_TODAS || !selectedNombre) return null;
    const b = branches.find((x) => x.name === selectedNombre);
    return b ? branchUbigeo(b) : null;
  }, [selectedNombre, branches]);

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
      branches,
      districts,
      loading,
    }),
    [selectedNombre, setSelectedNombre, ubigeo, geojson, branches, districts, loading],
  );

  return (
    <UnidadOperativaContext.Provider value={value}>
      {children}
    </UnidadOperativaContext.Provider>
  );
}