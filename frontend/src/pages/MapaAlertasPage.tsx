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
 * El `<BaseMap>` y `PrecipitationLayer` (capa pesada) viven en `MapLayout`
 * y NO se re-montan al navegar entre rutas de mapa. Esta página sólo
 * inyecta su capa específica (`ClusterAlertLayer`) y el sheet de detalle
 * vía el `<Outlet />` del layout.
 *
 * Al montar, configura el `MapLayersContext` con sus capas por defecto
 * (distritos + precipitaciones + alertas) y la variante de leyenda.
 */
export function MapaAlertasPage() {
  const { activeLayers, setActiveLayers, setLegendVariant } = useMapLayers();
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

  return (
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
          ComponentLayer consume el endpoint `/map` internamente (cacheado
          en useComponentesMap), igual que pre-refactor del MapLayout. */}
      {activeLayers.has('componentes') && <ComponentLayer />}

      {/* Sheet de detalle montado dentro del contenedor del mapa (overlay
          absoluto): deja al mapa interactivo (drag, zoom y clic en otros
          marcadores para cambiar la alerta en vivo). */}
      <AlertaDetailSheet
        alerta={selectedAlerta}
        onClose={() => setSelectedAlertId(null)}
      />
    </>
  );
}
