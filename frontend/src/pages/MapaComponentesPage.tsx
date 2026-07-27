import { useState } from 'react';
import { BaseMap } from '@/features/mapa/components/BaseMap';
import { LayerControl, type LayerId } from '@/features/mapa/components/LayerControl';
import { MapLegend } from '@/features/mapa/components/MapLegend';
import { PrecipitationLayer } from '@/features/mapa/components/PrecipitationLayer';
import { ComponentLayer } from '@/features/mapa/components/ComponentLayer';
import { DistrictLayer } from '@/features/mapa/components/DistrictLayer';
import { MapComponentsPanel } from '@/features/componentes/components/MapComponentsPanel';
import { useComponentes } from '@/services/useComponentes';

/**
 * MapaComponentesPage — vista "Mapa de Componentes".
 *
 * Renderiza el mapa Leaflet a pantalla completa (debajo del TopBar) con
 * capas seleccionables desde el control flotante. Capa por defecto:
 * 'componentes'. Panel deslizable abajo con tabla de componentes.
 *
 * Sincronización tabla ↔ mapa:
 *   - Estado `selectedComponentId` vive aquí y se propaga a ambos lados.
 *   - Clic en icono del mapa o en fila de la tabla → toggle selección.
 *   - Componente seleccionado se resalta en ambos (amarillo en la fila,
 *     anillo amarillo + tamaño 1.4× en el icono del mapa).
 *   - Selected row sube a la primera posición (vía `sortSelectedFirst`).
 */
export function MapaComponentesPage() {
  const [selected, setSelected] = useState<Set<LayerId>>(() =>
    new Set(['componentes']),
  );
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(
    null,
  );

  const { data } = useComponentes();

  function handleToggleSelect(id: string) {
    setSelectedComponentId((prev) => (prev === id ? null : id));
  }

  const panelComponentes = (data.componentes ?? []).slice(0, 10);

  return (
  <div className="relative h-full w-full pt-1 pr-1 pl-2 z-0">
    <div className="relative h-full w-full rounded-2xl border border-neutral-300 overflow-hidden">
      <BaseMap>
        <DistrictLayer />
        {selected.has('precipitaciones') && <PrecipitationLayer />}
        {selected.has('componentes') && (
          <ComponentLayer
            data={data}
            selectedComponentId={selectedComponentId}
            onComponenteClick={handleToggleSelect}
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
      <MapLegend initialVariant="componentes" />

      <MapComponentsPanel
        componentes={panelComponentes}
        selectedId={selectedComponentId}
        onToggleSelect={handleToggleSelect}
      />
    </div>
  </div>
  );
}