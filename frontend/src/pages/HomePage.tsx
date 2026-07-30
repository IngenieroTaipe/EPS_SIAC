import { useState } from 'react';
import { BaseMap } from '@/features/mapa/components/BaseMap';
import { LayerControl, type LayerId } from '@/features/mapa/components/LayerControl';
import { MapLegend } from '@/features/mapa/components/MapLegend';
import { PrecipitationLayer } from '@/features/mapa/components/PrecipitationLayer';
import { ComponentLayer } from '@/features/mapa/components/ComponentLayer';
import { ClusterAlertLayer } from '@/features/mapa/components/ClusterAlertLayer';
import { DistrictLayer } from '@/features/mapa/components/DistrictLayer';
import { mockAlertas } from '@/features/mapa/data/mockAlertas';
import { useComponentes } from '@/services/useComponentes';

/**
 * HomePage — pestaña principal pública (antes de iniciar sesión).
 *
 * Muestra la misma vista geoespacial que el "Mapa de Alertas Climáticas"
 * (mapa Leaflet + control de capas + leyenda) pero SIN el panel tabular
 * inferior. Solo la vista de capas y la leyenda, tal como se ve cuando
 * uno entra sin autenticarse.
 *
 * El layout lo provee `GuestLayout` (TopBar con botón "Iniciar Sesión").
 */
export function HomePage() {
  const [selected, setSelected] = useState<Set<LayerId>>(() => new Set(['alertas']));
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const { data: componentesData } = useComponentes();

  function handleToggleSelect(id: string) {
    setSelectedAlertId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="relative h-full w-full pt-1 pr-1 pl-2 z-0">
      <div className="relative h-full w-full rounded-2xl border border-neutral-300 overflow-hidden">
        <BaseMap>
          <DistrictLayer />
          {selected.has('precipitaciones') && <PrecipitationLayer />}
          {selected.has('componentes') && <ComponentLayer data={componentesData} />}
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
      </div>
    </div>
  );
}