import type { AlertaHistorica } from '../types';
import { AlertsTable } from './AlertsTable';
import { MapSlidingPanel } from '@/shared/components/MapSlidingPanel';

/**
 * MapAlertsPanel — panel deslizable (mapa) que muestra la tabla de alertas
 * activas dentro del viewport.
 *
 * El layout/animación/botón toggle vive en `MapSlidingPanel` (compartido
 * con `MapComponentsPanel`); aquí solo queda el dominio específico:
 * el header de alertas y la tabla `AlertsTable`.
 *
 *   - Máx `maxItems` alertas (las del viewport actual); el panel se encarga
 *     de slicear.
 *   - La tabla interna controla selección (1 a la vez) y emite
 *     `onToggleSelect` para que el padre resalte el icono en el mapa.
 */
interface MapAlertsPanelProps {
  /** Alertas activas dentro del viewport del mapa (el panel las limita a
   *  `maxItems`). */
  alertas: AlertaHistorica[];
  /** ID de la alerta seleccionada actualmente (o null si ninguna). */
  selectedId: string | null;
  /** Alterna selección de una alerta. */
  onToggleSelect: (id: string) => void;
  /** Máximo recomendado: 10 (es el límite visual del panel sin scroll). */
  maxItems?: number;
}

export function MapAlertsPanel({
  alertas,
  selectedId,
  onToggleSelect,
  maxItems = 10,
}: MapAlertsPanelProps) {
  const visibles = alertas.slice(0, maxItems);

  return (
    <MapSlidingPanel
      title={`Alertas activas (${visibles.length}/${maxItems})`}
      subtitle="Clic en una alerta para resaltarla en el mapa"
      expandLabel="Expandir tabla de alertas"
      collapseLabel="Colapsar tabla de alertas"
    >
      <AlertsTable
        alertas={visibles}
        selectedId={selectedId}
        onToggleSelect={onToggleSelect}
        highlightSelected
      />
    </MapSlidingPanel>
  );
}