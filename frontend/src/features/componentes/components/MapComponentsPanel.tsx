import type { Componente } from '@/features/mapa/types/componente';
import { ComponentsTable } from './ComponentsTable';
import { MapSlidingPanel } from '@/shared/components/MapSlidingPanel';

/**
 * MapComponentsPanel — panel deslizable (mapa) que muestra la tabla de
 * componentes visibles en el viewport.
 *
 * El layout/animación/botón toggle vive en `MapSlidingPanel` (compartido
 * con `MapAlertsPanel`); aquí solo queda el dominio específico: el header
 * de componentes y la tabla `ComponentsTable`.
 *
 * Diferencias con el panel de alertas:
 *   - Header extra con contador de componentes y total.
 *   - Tabla reutiliza `ComponentsTable` con `sortSelectedFirst=true` por
 *     defecto (el componente seleccionado sube al principio).
 */
interface MapComponentsPanelProps {
  componentes: Componente[];
  selectedId: string | null;
  onToggleSelect: (id: string) => void;
  /** Máximo recomendado: 10 (es el límite visual del panel sin scroll). */
  maxItems?: number;
}

export function MapComponentsPanel({
  componentes,
  selectedId,
  onToggleSelect,
  maxItems = 10,
}: MapComponentsPanelProps) {
  const visibles = componentes.slice(0, maxItems);

  return (
    <MapSlidingPanel
      title={`Componentes (${visibles.length}/${maxItems})`}
      subtitle="Clic en un componente para resaltarlo en el mapa"
      expandLabel="Expandir tabla de componentes"
      collapseLabel="Colapsar tabla de componentes"
    >
      <ComponentsTable
        componentes={visibles}
        selectedId={selectedId}
        onToggleSelect={onToggleSelect}
        sortSelectedFirst
      />
    </MapSlidingPanel>
  );
}