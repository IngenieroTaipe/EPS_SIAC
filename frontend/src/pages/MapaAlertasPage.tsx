import { useState } from 'react';
import { BaseMap } from '@/features/mapa/components/BaseMap';
import { LayerControl, type LayerId } from '@/features/mapa/components/LayerControl';
import { MapLegend } from '@/features/mapa/components/MapLegend';
import { PrecipitationLayer } from '@/features/mapa/components/PrecipitationLayer';
import { ComponentLayer } from '@/features/mapa/components/ComponentLayer';
import { ClusterAlertLayer } from '@/features/mapa/components/ClusterAlertLayer';
import { DistrictLayer } from '@/features/mapa/components/DistrictLayer';
import { MapAlertsPanel } from '@/features/alertas/components/MapAlertsPanel';
import { mockAlertas } from '@/features/mapa/data/mockAlertas';
import { mockAlertasHistoricas } from '@/features/alertas/data/mockAlertasHistoricas';

/**
 * MapaAlertasPage — vista "Mapa de Alertas Climáticas".
 *
 * Renderiza el mapa Leaflet a pantalla completa con capas seleccionables
 * (precipitaciones, alertas, componentes desde LayerControl) + control de
 * capas flotante + leyenda auto-rotatoria + panel deslizable abajo con la
 * tabla de alertas.
 *
 * La alerta seleccionada en el panel (o en el mapa) se resalta en ambos
 * lugares con fondo amarillo (tabla) o icono más grande/contraste (mapa).
 */
export function MapaAlertasPage() {
  // Capa por defecto activa.
  const [selected, setSelected] = useState<Set<LayerId>>(() => new Set(['alertas']));
  // ID de alerta seleccionada (single-selection). Null si ninguna.
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  // Para el panel del mapa mostramos las primeras 10 alertas del histórico.
  // El panel limita internamente a `maxItems` (= 10 por defecto), así que
  // aquí pasamos la lista completa y dejamos que `MapAlertsPanel` la slice.
  const panelAlertas = mockAlertasHistoricas;

  function handleToggleSelect(id: string) {
    setSelectedAlertId((prev) => (prev === id ? null : id));
  }

  return (
  <div className="relative h-full w-full pt-1 pr-1 pl-2 z-0">
    <div className="relative h-full w-full rounded-2xl border border-neutral-300 overflow-hidden">
      <BaseMap>
        <DistrictLayer />
        {selected.has('precipitaciones') && <PrecipitationLayer />}
        {selected.has('componentes')     && <ComponentLayer />}
        {selected.has('alertas') && (
          <ClusterAlertLayer
            alertas={mockAlertas.alertas}
            selectedAlertId={selectedAlertId}
            onAlertaClick={handleToggleSelect}
          />
        )}
      </BaseMap>

      <LayerControl
        selected={selected}
        onToggle={(id) =>
          setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })
        }
      />
      <MapLegend initialVariant="alertas" />

      <MapAlertsPanel
        alertas={panelAlertas}
        selectedId={selectedAlertId}
        onToggleSelect={handleToggleSelect}
      />
    </div>
  </div>
  );
}