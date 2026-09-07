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
 * Montado por `MapLayout`, envolviendo el `<BaseMap>` persistente y el
 * `<Outlet />`. Las páginas de mapa configuran sus defaults al entrar
 * (`setActiveLayers` / `setLegendVariant`) y el `LayerControl` togglea
 * capas individuales.
 */
export function MapLayersProvider({ children }: { children: ReactNode }) {
  const [activeLayers, setActiveLayersState] = useState<Set<LayerId>>(
    () => new Set(['distritos', 'precipitaciones']),
  );
  const [legendVariant, setLegendVariant] = useState<LegendVariant>('alertas');

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

  const value: MapLayersContextValue = {
    activeLayers,
    setActiveLayers,
    toggleLayer,
    legendVariant,
    setLegendVariant,
  };

  return (
    <MapLayersContext.Provider value={value}>
      {children}
    </MapLayersContext.Provider>
  );
}
