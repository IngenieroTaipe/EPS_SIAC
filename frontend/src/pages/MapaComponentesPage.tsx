import { useMemo, useState } from 'react';
import { BaseMap } from '@/features/mapa/components/BaseMap';
import { LayerControl, type LayerId } from '@/features/mapa/components/LayerControl';
import { MapLegend } from '@/features/mapa/components/MapLegend';
import { PrecipitationLayer } from '@/features/mapa/components/PrecipitationLayer';
import { ComponentLayer } from '@/features/mapa/components/ComponentLayer';
import { DistrictLayer } from '@/features/mapa/components/DistrictLayer';
import { ComponenteDetailSheet } from '@/features/componentes/components/ComponenteDetailSheet';
import { useComponentes } from '@/services/useComponentes';
import type { Componente } from '@/features/mapa/types/componente';

/**
 * MapaComponentesPage — vista "Mapa de Componentes".
 *
 * Renderiza el mapa Leaflet a pantalla completa (debajo del TopBar) con
 * capas seleccionables desde el control flotante. Capa por defecto:
 * 'componentes'.
 *
 * Detalle del componente:
 *   - Al hacer clic en un marcador/polyline de componente se abre el
 *     `ComponenteDetailSheet` (drawer lateral derecho) con todos sus
 *     datos y un botón "Editar" → `/componentes/:id/editar`.
 *   - El estado `selectedComponentId` vive aquí y se propaga a la capa
 *     `ComponentLayer` para resaltar el marcador (anillo amarillo + 1.4×).
 *   - Clic en el mismo marcador cierra el sheet (toggle).
 *
 * Antes existía un panel deslizable inferior con un tabular de componentes;
 * quedó reemplazado por el sheet de detalle (información más completa y
 * menos ruido en el borde inferior del mapa).
 */
export function MapaComponentesPage() {
  const [selected, setSelected] = useState<Set<LayerId>>(() =>
    new Set(['componentes']),
  );
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(
    null,
  );

  const { data } = useComponentes();

  // Resolver el componente seleccionado (objeto) para pasarlo al sheet.
  const selectedComponente = useMemo<Componente | null>(() => {
    if (!selectedComponentId) return null;
    return (data.componentes ?? []).find((c) => c.id === selectedComponentId) ?? null;
  }, [data, selectedComponentId]);

  function handleComponenteClick(id: string) {
    // Toggle: si está seleccionado y se clic de nuevo, se cierra el sheet.
    setSelectedComponentId((prev) => (prev === id ? null : id));
  }

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
              onComponenteClick={handleComponenteClick}
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

        {/* Sheet de detalle montado dentro del contenedor del mapa: ocupa
            exactamente su altura y deja al mapa interactivo (drag, zoom y
            clic en otros marcadores para cambiar el componente en vivo). */}
        <ComponenteDetailSheet
          componente={selectedComponente}
          onClose={() => setSelectedComponentId(null)}
        />
      </div>
    </div>
  );
}