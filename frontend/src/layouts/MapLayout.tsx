import { Fragment } from 'react';
import { BaseMap } from '@/features/mapa/components/BaseMap';
import { LayerControl } from '@/features/mapa/components/LayerControl';
import { MapLegend } from '@/features/mapa/components/MapLegend';
import { PrecipitationLayer } from '@/features/mapa/components/PrecipitationLayer';
import { DistrictLayer } from '@/features/mapa/components/DistrictLayer';
import { useMapLayers } from '@/features/mapa/context/useMapLayers';

/**
 * MapLayout — mapa en modo KEEP-ALIVE.
 *
 * Montado SIEMPRE desde `AppLayout` (oculto con `visibility: hidden`
 * fuera de las rutas de mapa). Al volver de cualquier pestaña, el mapa
 * está exactamente como se dejó: cero re-dibujo de los ~300 polígonos de
 * precipitaciones (el parpadeo de ~1s que había al re-montarlo) y cero
 * re-fetch de tiles.
 *
 * Las capas específicas de cada página de mapa (alertas, componentes,
 * sheets de detalle) se inyectan vía `registerOverlay` del
 * `MapLayersContext` (no hay `<Outlet />` aquí: las páginas se renderizan
 * en el Outlet del AppLayout, fuera del mapa).
 *
 * Estructura:
 *   ┌─────────────────────────────────────────┐
 *   │ BaseMap (persistente)                    │
 *   │   ├─ DistrictLayer       (siempre)       │
 *   │   ├─ PrecipitationLayer  (siempre, pesada)│
 *   │   └─ overlays registrados (capas+sheet)  │
 *   │   LayerControl (overlay shared)          │
 *   │   MapLegend (overlay shared)             │
 *   └─────────────────────────────────────────┘
 */
export function MapLayout() {
  const { activeLayers, toggleLayer, legendVariant, overlays } = useMapLayers();

  return (
    <div className="relative h-full w-full pt-1 pr-1 pl-2 z-0">
      <div className="relative h-full w-full rounded-2xl border border-neutral-300 overflow-hidden">
        <BaseMap>
          {/* Capas shared/pesadas: viven una sola vez, no se re-montan. */}
          {activeLayers.has('distritos') && <DistrictLayer />}
          {activeLayers.has('precipitaciones') && <PrecipitationLayer />}
          {/* Capas + sheets de la página de mapa activa (registro por
              key: re-registrar actualiza SIN remontar las capas). */}
          {[...overlays.entries()].map(([key, node]) => (
            <Fragment key={key}>{node}</Fragment>
          ))}
        </BaseMap>

        {/* Overlays shared posicionados sobre el contenedor del mapa. */}
        <LayerControl selected={activeLayers} onToggle={toggleLayer} />
        <MapLegend initialVariant={legendVariant} />
      </div>
    </div>
  );
}
