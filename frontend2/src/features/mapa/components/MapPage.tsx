import { useCallback, useMemo, useState } from 'react';
import { BaseMap } from './BaseMap';
import { LayerControl, type LayerId } from './LayerControl';
import { MapLegend } from './MapLegend';
import { PrecipitationLayer } from './PrecipitationLayer';

/**
 * MapPage — página con mapa Leaflet de pantalla completa (debajo del TopBar)
 * + control de capas flotante con selección múltiple.
 *
 * Las 3 capas disponibles son:
 *   - precipitaciones (Mapa de Precipitaciones)
 *   - alertas          (Mapa de Alertas)
 *   - componentes      (Mapa de Componentes)
 *
 * Cada ruta (`/alertas`, `/componentes`, `/climatico`) usa esta página.
 * La capa por defecto activa depende de la ruta:
 *   `/alertas`     → ['alertas']
 *   `/componentes` → ['componentes']
 *   `/climatico`   → ['precipitaciones']
 *
 * El usuario puede activar varias a la vez o ninguna (capa base OSM sola).
 *
 * Las capas <PrecipitacionLayer>, <AlertLayer>, <ComponentLayer> se
 * implementarán cuando se maqueten los datos reales. Por ahora este
 * componente solo renderiza la capa base OSM + el control flotante.
 */

interface MapPageProps {
  /** Capa(s) activa(s) por defecto al entrar en la ruta. */
  defaultLayers?: LayerId[];
}

export function MapPage({ defaultLayers = [] }: MapPageProps) {
  const [selected, setSelected] = useState<Set<LayerId>>(
    () => new Set(defaultLayers),
  );

  const handleToggle = useCallback((id: LayerId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Memo del mapa para no recrearlo en cada render (mejor performance).
  // El key varía por ruta para que cambie de center/zoom al navegar.
  const mapKey = useMemo(
    () => `map-${[...selected].sort().join('-')}-${defaultLayers.join('-')}`,
    [selected, defaultLayers],
  );

  return (
  <div className="relative h-full w-full pt-1 pr-1 pl-2 z-0">
    <div className="relative h-full w-full rounded-2xl border border-neutral-300 overflow-hidden">
      <BaseMap key={mapKey}>
        {selected.has('precipitaciones') && <PrecipitationLayer />}
        {/*
          Capas futuras:
          {selected.has('alertas')     && <AlertLayer />}
          {selected.has('componentes') && <ComponentLayer />}
        */}
      </BaseMap>

      {/* Control de capas flotante (arriba-derecha). */}
      <LayerControl selected={selected} onToggle={handleToggle} />

      {/* Leyenda flotante (abajo-derecha) con auto-rotación cada 10s. */}
      <MapLegend initialVariant={defaultLayers[0] as 'alertas' | 'precipitaciones' | 'componentes'} />
    </div>
  </div>
);
}