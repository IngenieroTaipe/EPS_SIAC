import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  UnidadOperativaContext,
  type UnidadOperativaContextValue,
  type GeoJSONGeometry,
  UNIDAD_TODAS,
} from './UnidadOperativaContext';
import type { BackendDistrict } from '@/services/apiPlaces';
import { apiOrganization, type BackendBranch } from '@/services/apiOrganization';
import { useAuth } from './AuthContext.hooks';

/**
 * Provider del UnidadOperativaContext.
 *
 * Al montar (y al cambiar `isAuthenticated`):
 *   1. Carga la capa geoespacial `GET /organization/branches/map/`, que
 *      devuelve en UNA sola request las branches activas junto con la
 *      geometría del distrito de cada una (antes eran 1 + N requests:
 *      listado de branches + un GET de distrito por ubigeo).
 *   2. Deriva de esa FeatureCollection las dos listas del contexto:
 *      `branches` (para el selector y filtros) y `districts` (ubigeo →
 *      geojson, para DistrictLayer y el zoom/selección).
 *   3. Valida que el nombre guardado en localStorage corresponda a un branch
 *      activo; si no, resetea a "Todas".
 *
 * El reintento al cambiar `isAuthenticated` cubre el caso real de sesión
 * expirada: el fetch inicial del boot puede fallar (401 → auto-logout);
 * cuando el usuario vuelve a loguearse, el efecto se re-dispara y la lista
 * se recupera sin necesidad de recargar la página (antes quedaba vacía
 * toda la sesión).
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

  // ── Carga de branches activos + geojson de sus distritos ─────────────
  // Una sola request (capa /branches/map/, compilada en PostGIS, SIN caché
  // → siempre fresca del backend). Se re-dispara al cambiar
  // `isAuthenticated` (recuperación de boot con token expirado) y por las
  // suscripciones de revalidación de abajo.
  const { isAuthenticated } = useAuth();

  const load = useCallback(() => {
    let cancelled = false;

    apiOrganization
      .getBranchesMap()
      .then((fc) => {
        if (cancelled) return;

        const nextBranches: BackendBranch[] = [];
        const nextDistricts: BackendDistrict[] = [];
        const seenUbigeos = new Set<string>();

        for (const f of fc.features) {
          const p = f.properties;
          if (!p?.district_ubigeo) continue;

          nextBranches.push({
            id: typeof f.id === 'number' ? f.id : Number(f.id ?? 0),
            code: p.code,
            name: p.name,
            acronym: p.acronym,
            status: true,
            district: { ubigeo: p.district_ubigeo, name: p.district_name },
          });

          // Dedupe: varias branches pueden compartir el mismo distrito.
          if (!seenUbigeos.has(p.district_ubigeo)) {
            seenUbigeos.add(p.district_ubigeo);
            nextDistricts.push({
              ubigeo: p.district_ubigeo,
              name: p.district_name,
              geojson: f.geometry,
            });
          }
        }

        setBranches(nextBranches);
        setDistricts(nextDistricts);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Un reintento fallido no debe destruir una lista ya cargada.
        setBranches((prev) => (prev.length ? prev : []));
        setDistricts((prev) => (prev.length ? prev : []));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Carga inicial (+ recuperación al cambiar isAuthenticated).
  useEffect(() => {
    return load();
  }, [load, isAuthenticated]);

  // ── Revalidación (eventual, SOLO ante escrituras — sin polling) ──────
  // El provider vive en main.tsx: navegar entre rutas NO lo re-monta, así
  // que sin esto un usuario no vería las UO creadas/editadas hasta
  // recargar. Dos señales (ambas reaccionan a escrituras reales, NUNCA al
  // foco ni a timers — eso congelaba el mapa al volver de pestaña):
  //   1. 'eps:cache-invalidated' (misma pestaña): createBranch/updateBranch/
  //      deleteBranch invalidan 'branches:' y emiten el evento → el
  //      selector del TopBar refresca al instante en la propia sesión.
  //   2. 'storage' (otras pestañas del MISMO navegador): el removeItem de
  //      la invalidación dispara el evento nativo en las demás pestañas.
  // Para otros usuarios/navegadores: F5 (el endpoint del provider no tiene
  // caché → siempre fresco).
  useEffect(() => {
    const onCacheInvalidated = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === 'string' && detail.startsWith('branches:')) {
        load();
      }
    };
    const onStorage = (e: StorageEvent) => {
      // Otra pestaña invalidó la caché de branches (creó/editó/eliminó UO).
      if (e.key === null || e.key.startsWith('eps_cache:branches:')) {
        load();
      }
    };

    window.addEventListener('eps:cache-invalidated', onCacheInvalidated);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('eps:cache-invalidated', onCacheInvalidated);
      window.removeEventListener('storage', onStorage);
    };
  }, [load]);

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