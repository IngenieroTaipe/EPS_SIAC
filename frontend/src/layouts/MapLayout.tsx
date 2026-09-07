import { Outlet } from 'react-router-dom';
import { BaseMap } from '@/features/mapa/components/BaseMap';
import { LayerControl } from '@/features/mapa/components/LayerControl';
import { MapLegend } from '@/features/mapa/components/MapLegend';
import { PrecipitationLayer } from '@/features/mapa/components/PrecipitationLayer';
import { DistrictLayer } from '@/features/mapa/components/DistrictLayer';
import { MapLayersProvider } from '@/features/mapa/context/MapLayersProvider';
import { useMapLayers } from '@/features/mapa/context/useMapLayers';

/**
 * MapLayout — layout persistente para las rutas con mapa (`/alertas`,
 * `/componentes`).
 *
 * Monta un ÚNICO `<BaseMap>` que NO se desmonta al navegar entre estas
 * rutas. Así Leaflet (tiles + estado de zoom/pan) y `PrecipitationLayer`
 * (la capa pesada, ~300 polígonos) persisten entre vistas: cero
 * re-render al cambiar de pestaña, como meteored.pe.
 *
 * Las capas específicas de cada ruta (`AlertLayer`, `ComponentLayer`) y
 * sus `DetailSheet` se inyectan vía `<Outlet />` DENTRO del `<BaseMap>`,
 * de modo que pueden usar `useMap()` y posicionarse como overlays.
 *
 * Estructura:
 *   ┌─────────────────────────────────────────┐
 *   │ BaseMap (persistente)                    │
 *   │   ├─ DistrictLayer  (siempre)            │
 *   │   ├─ PrecipitationLayer (siempre, pesada)│
 *   │   └─ <Outlet /> (capas + sheets de página)│
 *   │   LayerControl (overlay shared)          │
 *   │   MapLegend (overlay shared)             │
 *   └─────────────────────────────────────────┘
 */
export function MapLayout() {
  return (
    <MapLayersProvider>
      <MapLayoutInner />
    </MapLayersProvider>
  );
}

function MapLayoutInner() {
  const { activeLayers, toggleLayer, legendVariant } = useMapLayers();

  return (
    <div className="relative h-full w-full pt-1 pr-1 pl-2 z-0">
      <div className="relative h-full w-full rounded-2xl border border-neutral-300 overflow-hidden">
        <BaseMap>
          {/* Capas shared/pesadas: viven una sola vez, no se re-montan. */}
          {activeLayers.has('distritos') && <DistrictLayer />}
          {activeLayers.has('precipitaciones') && <PrecipitationLayer />}
          {/* Capas específicas de la ruta + DetailSheets se inyectan aquí. */}
          <Outlet />
        </BaseMap>

        {/* Overlays shared posicionados sobre el contenedor del mapa. */}
        <LayerControl selected={activeLayers} onToggle={toggleLayer} />
        <MapLegend initialVariant={legendVariant} />
      </div>
    </div>
  );
}
