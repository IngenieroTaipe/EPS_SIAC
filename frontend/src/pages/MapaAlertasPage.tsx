import { useEffect, useMemo, useState } from 'react';
import { ClusterAlertLayer } from '@/features/mapa/components/ClusterAlertLayer';
import { ComponentLayer } from '@/features/mapa/components/ComponentLayer';
import { AlertaDetailSheet } from '@/features/alertas/components/AlertaDetailSheet';
import { apiAlerts, type BackendAlertListItem, type BackendAlertMapItem } from '@/services/apiAlerts';
import { apiOrganization } from '@/services/apiOrganization';
import {
  mapAlertListToFrontend,
  adaptarAlertasMap,
  buildBranchByUbigeo,
} from '@/features/alertas/alertAdapters';
import type { Alerta } from '@/features/mapa/types/alerta';
import type { AlertaHistorica } from '@/features/alertas/types';
import { useMapLayers } from '@/features/mapa/context/useMapLayers';

/**
 * MapaAlertasPage — vista "Mapa de Alertas Climáticas".
 *
 * El mapa vive en `MapLayout` (keep-alive: SIEMPRE montado en el AppLayout,
 * oculto fuera de las rutas de mapa) y NO se re-monta nunca. Esta página
 * REGISTRA sus overlays (capa de alertas, capa cruzada de componentes y
 * el sheet de detalle) en el `MapLayersContext`; el MapLayout los
 * renderiza dentro del `<BaseMap>`. No renderiza contenido propio (el
 * mapa ES la vista).
 *
 * Al montar, configura el contexto con sus capas por defecto (distritos +
 * precipitaciones + alertas) y la variante de leyenda.
 */
export function MapaAlertasPage() {
  const {
    activeLayers,
    setActiveLayers,
    setLegendVariant,
    registerOverlay,
    unregisterOverlay,
  } = useMapLayers();
  // ID de alerta seleccionada (single-selection). Null si ninguna.
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  // Datos del backend.
  const [backendItems, setBackendItems] = useState<BackendAlertListItem[]>([]);
  const [mapItems, setMapItems] = useState<BackendAlertMapItem[]>([]);
  const [branchByUbigeo, setBranchByUbigeo] = useState<Map<string, string>>(
    () => new Map(),
  );

  // Configurar capas por defecto + variante de leyenda al montar.
  // (Sin eslint-disable: los setters provienen del contexto, no de un
  // useState local, así que no disparan `set-state-in-effect`.)
  useEffect(() => {
    setActiveLayers(new Set(['distritos', 'precipitaciones', 'alertas']));
    setLegendVariant('alertas');
  }, [setActiveLayers, setLegendVariant]);

  useEffect(() => {
    // Carga paralela: (1) listado para el sheet (trae operational_ubigeos
    // → Unidad Operativa), (2) endpoint `/map` para los markers (trae el
    // representative_point del clúster más severo por alerta — decisión del
    // backend en SQL) y (3) branches para resolver UO. Si fallan, las
    // alertas cargan igual pero el sheet mostrará UO vacía (no bloqueante).
    Promise.all([
      apiAlerts.listAlerts().catch((err) => {
        console.error('Error cargando alertas:', err);
        return [] as BackendAlertListItem[];
      }),
      apiAlerts.listAlertsForMap().catch((err) => {
        console.error('Error cargando capa de alertas del mapa:', err);
        return [] as BackendAlertMapItem[];
      }),
      apiOrganization.listBranches({ status: true }).catch((err) => {
        console.error('Error cargando unidades operativas:', err);
        return [];
      }),
    ])
      .then(([items, mapLayer, branches]) => {
        setBackendItems(items);
        setMapItems(mapLayer);
        setBranchByUbigeo(buildBranchByUbigeo(branches));
      });
  }, []);

  // Derivar las alertas para el sheet (AlertaHistorica[]) desde el listado
  // (con UO resuelta via operational_ubigeos) y para el mapa (Alerta[])
  // desde el endpoint `/map`.
  const panelAlertas: AlertaHistorica[] = useMemo(
    () => backendItems.map((it) => mapAlertListToFrontend(it, branchByUbigeo)),
    [backendItems, branchByUbigeo],
  );
  const mapAlertas: Alerta[] = useMemo(
    () => adaptarAlertasMap(mapItems),
    [mapItems],
  );

  // Resolver la alerta seleccionada (objeto) para pasarlo al sheet.
  const selectedAlerta = useMemo<AlertaHistorica | null>(() => {
    if (!selectedAlertId) return null;
    return panelAlertas.find((a) => a.id === selectedAlertId) ?? null;
  }, [panelAlertas, selectedAlertId]);

  function handleAlertaClick(id: string) {
    // Toggle: si está seleccionado y se clic de nuevo, se cierra el sheet.
    setSelectedAlertId((prev) => (prev === id ? null : id));
  }

  // ── Registrar overlays en el mapa (keep-alive) ───────────────────────
  // Re-registra cuando cambian capas/datos/selección: la key estable
  // ("page-alertas") hace que React reconcilie SIN remontar las capas.
  // El cleanup des-registra al desmontar la página (navegar fuera).
  useEffect(() => {
    registerOverlay('page-alertas', (
      <>
        {activeLayers.has('alertas') && (
          <ClusterAlertLayer
            alertas={mapAlertas}
            selectedAlertId={selectedAlertId}
            onAlertaClick={handleAlertaClick}
          />
        )}

        {/* Capa de componentes cruzada: el LayerControl permite activar
            "Mapa de Componentes" también en esta ruta. Sin `data` → el
            ComponentLayer consume el endpoint `/map` internamente
            (cacheado en useComponentesMap). */}
        {activeLayers.has('componentes') && <ComponentLayer />}

        {/* Sheet de detalle: overlay absoluto DENTRO del mapa; bloquea
            los gestos del mapa sobre él (useBlockMapGestures interno). */}
        <AlertaDetailSheet
          alerta={selectedAlerta}
          onClose={() => setSelectedAlertId(null)}
        />
      </>
    ));
    return () => unregisterOverlay('page-alertas');
  }, [
    activeLayers,
    mapAlertas,
    selectedAlertId,
    selectedAlerta,
    registerOverlay,
    unregisterOverlay,
  ]);

  // La vista ES el mapa (keep-alive en el AppLayout): sin contenido propio.
  return null;
}
