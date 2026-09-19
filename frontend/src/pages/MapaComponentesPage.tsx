import { useEffect, useMemo, useState } from 'react';
import { ComponentLayer } from '@/features/mapa/components/ComponentLayer';
import { ClusterAlertLayer } from '@/features/mapa/components/ClusterAlertLayer';
import { ComponenteDetailSheet } from '@/features/componentes/components/ComponenteDetailSheet';
import { useComponentesMap } from '@/services/useComponentes';
import { apiAlerts, type BackendAlertMapItem } from '@/services/apiAlerts';
import { adaptarAlertasMap } from '@/features/alertas/alertAdapters';
import type { Componente } from '@/features/mapa/types/componente';
import type { Alerta } from '@/features/mapa/types/alerta';
import { useMapLayers } from '@/features/mapa/context/useMapLayers';

/**
 * MapaComponentesPage — vista "Mapa de Componentes".
 *
 * El mapa vive en `MapLayout` (keep-alive: SIEMPRE montado en el AppLayout,
 * oculto fuera de las rutas de mapa) y NO se re-monta nunca. Esta página
 * REGISTRA sus overlays (capa de componentes, capa cruzada de alertas y
 * el sheet de detalle) en el `MapLayersContext`. No renderiza contenido
 * propio (el mapa ES la vista).
 *
 * Al montar, configura el contexto con sus capas por defecto (distritos +
 * precipitaciones + componentes) y la variante de leyenda.
 */
export function MapaComponentesPage() {
  const {
    activeLayers,
    setActiveLayers,
    setLegendVariant,
    registerOverlay,
    unregisterOverlay,
  } = useMapLayers();
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(
    null,
  );

  // Datos de componentes (endpoint /components/map, cacheado).
  const { data } = useComponentesMap();

  // Capa cruzada de alertas: endpoint ligero /alerts/alerts/map (el
  // backend lo sirve cacheado en Redis). Sólo se pide al montar; la capa
  // se dibuja únicamente si el usuario activa "Mapa de Alertas".
  const [alertMapItems, setAlertMapItems] = useState<BackendAlertMapItem[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiAlerts
      .listAlertsForMap()
      .then((items) => {
        if (!cancelled) setAlertMapItems(items);
      })
      .catch((err) => {
        console.error('Error cargando capa de alertas:', err);
        if (!cancelled) setAlertMapItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const mapAlertas: Alerta[] = useMemo(
    () => adaptarAlertasMap(alertMapItems),
    [alertMapItems],
  );

  // Configurar capas por defecto + variante de leyenda al montar.
  // (Sin eslint-disable: los setters provienen del contexto, no de un
  // useState local, así que no disparan `set-state-in-effect`.)
  useEffect(() => {
    setActiveLayers(new Set(['distritos', 'precipitaciones', 'componentes']));
    setLegendVariant('componentes');
  }, [setActiveLayers, setLegendVariant]);

  // Resolver el componente seleccionado (objeto) para pasarlo al sheet.
  const selectedComponente = useMemo<Componente | null>(() => {
    if (!selectedComponentId) return null;
    return (data.componentes ?? []).find((c) => c.id === selectedComponentId) ?? null;
  }, [data, selectedComponentId]);

  function handleComponenteClick(id: string) {
    // Toggle: si está seleccionado y se clic de nuevo, se cierra el sheet.
    setSelectedComponentId((prev) => (prev === id ? null : id));
  }

  function handleAlertaClick(id: string) {
    // Toggle de resaltado del marcador de alerta (sin sheet en esta vista;
    // el detalle completo vive en /alertas).
    setSelectedAlertId((prev) => (prev === id ? null : id));
  }

  // ── Registrar overlays en el mapa (keep-alive) ───────────────────────
  // Re-registra cuando cambian capas/datos/selección: la key estable
  // ("page-componentes") hace que React reconcilie SIN remontar las capas.
  // El cleanup des-registra al desmontar la página (navegar fuera).
  useEffect(() => {
    registerOverlay('page-componentes', (
      <>
        {activeLayers.has('componentes') && (
          <ComponentLayer
            data={data}
            selectedComponentId={selectedComponentId}
            onComponenteClick={handleComponenteClick}
          />
        )}

        {/* Capa cruzada de alertas (activable desde el LayerControl). */}
        {activeLayers.has('alertas') && (
          <ClusterAlertLayer
            alertas={mapAlertas}
            selectedAlertId={selectedAlertId}
            onAlertaClick={handleAlertaClick}
          />
        )}

        {/* Sheet de detalle: overlay absoluto DENTRO del mapa; bloquea
            los gestos del mapa sobre él (useBlockMapGestures interno). */}
        <ComponenteDetailSheet
          componente={selectedComponente}
          onClose={() => setSelectedComponentId(null)}
        />
      </>
    ));
    return () => unregisterOverlay('page-componentes');
  }, [
    activeLayers,
    data,
    mapAlertas,
    selectedComponentId,
    selectedComponente,
    selectedAlertId,
    registerOverlay,
    unregisterOverlay,
  ]);

  // La vista ES el mapa (keep-alive en el AppLayout): sin contenido propio.
  return null;
}
