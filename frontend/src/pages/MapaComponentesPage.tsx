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
 * El `<BaseMap>` y `PrecipitationLayer` (capa pesada) viven en `MapLayout`
 * y NO se re-montan al navegar entre rutas de mapa. Esta página sólo
 * inyecta su capa específica (`ComponentLayer`) y el sheet de detalle
 * vía el `<Outlet />` del layout.
 *
 * Al montar, configura el `MapLayersContext` con sus capas por defecto
 * (distritos + precipitaciones + componentes) y la variante de leyenda.
 *
 * Capa cruzada: el LayerControl permite activar "Mapa de Alertas" también
 * en esta ruta. Se renderiza con la capa ligera `/alerts/alerts/map`
 * (representative_point por alerta) y clic = resaltar marcador (toggle).
 */
export function MapaComponentesPage() {
  const { activeLayers, setActiveLayers, setLegendVariant } = useMapLayers();
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

  return (
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

      {/* Sheet de detalle montado dentro del contenedor del mapa (overlay
          absoluto): deja al mapa interactivo (drag, zoom y clic en otros
          marcadores para cambiar el componente en vivo). */}
      <ComponenteDetailSheet
        componente={selectedComponente}
        onClose={() => setSelectedComponentId(null)}
      />
    </>
  );
}
