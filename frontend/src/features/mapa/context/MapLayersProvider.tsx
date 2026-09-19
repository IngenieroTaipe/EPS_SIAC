import {
  useCallback,
  useState,
  type ReactNode,
} from 'react';
import type { LayerId } from '@/features/mapa/components/LayerControl';
import {
  MapLayersContext,
  type LegendVariant,
  type MapLayersContextValue,
} from './MapLayersContext';

/**
 * MapLayersProvider — proveedor del `MapLayersContext`.
 *
 * Vive en `AppLayout` envolviendo TANTO el mapa keep-alive (`MapLayout`)
 * como el `<Outlet />` (donde se montan las páginas de mapa que consumen
 * el contexto y registran sus overlays).
 *
 * Las páginas de mapa configuran sus defaults al entrar
 * (`setActiveLayers` / `setLegendVariant`), el `LayerControl` togglea
 * capas individuales, y las capas/sheets específicos de cada página se
 * inyectan vía `registerOverlay` / `unregisterOverlay`.
 */
export function MapLayersProvider({ children }: { children: ReactNode }) {
  const [activeLayers, setActiveLayersState] = useState<Set<LayerId>>(
    () => new Set(['distritos', 'precipitaciones']),
  );
  const [legendVariant, setLegendVariant] = useState<LegendVariant>('alertas');

  // Overlays registrados por la página de mapa activa (capas + sheets).
  // Se guardan como nodos React en un Map por key; el `MapLayout` los
  // renderiza dentro del `<BaseMap>` con la key como key de React →
  // actualizar un overlay re-renderiza SIN remontar las capas.
  const [overlays, setOverlays] = useState<Map<string, ReactNode>>(
    () => new Map(),
  );

  const setActiveLayers = useCallback((layers: Set<LayerId>) => {
    setActiveLayersState(layers);
  }, []);

  const toggleLayer = useCallback((id: LayerId) => {
    setActiveLayersState((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const registerOverlay = useCallback((key: string, node: ReactNode) => {
    setOverlays((prev) => {
      // Nueva instancia del Map para disparar el re-render (inmutabilidad).
      const next = new Map(prev);
      next.set(key, node);
      return next;
    });
  }, []);

  const unregisterOverlay = useCallback((key: string) => {
    setOverlays((prev) => {
      if (!prev.has(key)) return prev; // sin cambio: misma referencia.
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const value: MapLayersContextValue = {
    activeLayers,
    setActiveLayers,
    toggleLayer,
    legendVariant,
    setLegendVariant,
    registerOverlay,
    unregisterOverlay,
    overlays,
  };

  return (
    <MapLayersContext.Provider value={value}>
      {children}
    </MapLayersContext.Provider>
  );
}
