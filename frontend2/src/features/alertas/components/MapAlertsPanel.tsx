import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import type { AlertaHistorica } from '../types';
import { AlertsTable } from './AlertsTable';

/**
 * MapAlertsPanel — panel deslizable que emerge desde la parte inferior
 * del mapa y muestra la tabla de alertas activas dentro del viewport.
 *
 * Características:
 *   - Botón "flecha hacia arriba" abajo-centro del mapa.
 *   - Al hacer clic: la tabla se desliza hacia arriba (translate-y +=
 *     transition) revelando las alertas. El botón cambia a "flecha hacia
 *     abajo" para colapsar.
 *   - Máx 10 alertas (las del viewport actual). Padre se encarga de filtrar.
 *   - Fondo `bg-background-main` con sombra `shadow-[0px_-4px_8px_0px_rgba(0,0,0,0.15)]`.
 *   - Ancho ~80% del mapa, máx ~1100px, centrado.
 *
 * La tabla interna es `AlertsTable`, que controla selección (1 a la vez)
 * y genera eventos `onSelectAlert` para que el padre resalte el icono en
 * el mapa.
 */
interface MapAlertsPanelProps {
  /** Alertas activas dentro del viewport del mapa (máx 10 en realidad,
   *  aquí el padre limita). */
  alertas: AlertaHistorica[];
  /** ID de la alerta seleccionada actualmente (o null si ninguna). */
  selectedId: string | null;
  /** Alterna selección de una alerta. */
  onToggleSelect: (id: string) => void;
}

export function MapAlertsPanel({
  alertas,
  selectedId,
  onToggleSelect,
}: MapAlertsPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        'absolute bottom-0 left-1/2 -translate-x-1/2 z-[1000] w-[80%] max-w-[1100px]',
        'bg-background-main rounded-t-[10px] shadow-[0px_-4px_8px_0px_rgba(0,0,0,0.15)]',
        'transition-transform duration-300 ease-out',
        open ? 'translate-y-0' : 'translate-y-[calc(100%-3rem)]',
      )}
    >
      {/* Botón toggle: flecha arriba para abrir, flecha abajo para cerrar. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Colapsar tabla de alertas' : 'Expandir tabla de alertas'}
        aria-expanded={open}
        className="absolute -top-12 left-1/2 -translate-x-1/2 size-12 rounded-full
                   bg-primary-main text-text-invert-primary
                   inline-flex items-center justify-center
                   shadow-[0px_4px_8px_0px_rgba(0,0,0,0.25)]
                   hover:bg-primary-light transition-colors
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2"
      >
        {open ? (
          <ChevronDown className="size-6" strokeWidth={2.5} aria-hidden="true" />
        ) : (
          <ChevronUp className="size-6" strokeWidth={2.5} aria-hidden="true" />
        )}
      </button>

      {/* Header del panel (siempre visible) — contiene título + contador. */}
      <div className="h-12 px-5 flex items-center justify-between">
        <h3 className="text-text-primary text-base font-bold font-sans">
          Alertas activas ({alertas.length}/10)
        </h3>
        <span className="text-text-secondary text-sm font-normal font-sans">
          Clic en una alerta para resaltarla en el mapa
        </span>
      </div>

      {/* Contenido deslizable: la tabla. */}
      <div className="px-5 pb-5 max-h-[35vh] overflow-y-auto">
        <AlertsTable
          alertas={alertas}
          selectedId={selectedId}
          onToggleSelect={onToggleSelect}
          highlightSelected
        />
      </div>
    </div>
  );
}