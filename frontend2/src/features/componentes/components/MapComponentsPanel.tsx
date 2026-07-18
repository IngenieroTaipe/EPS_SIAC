import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import type { Componente } from '@/features/mapa/types/componente';
import { ComponentsTable } from './ComponentsTable';

/**
 * MapComponentsPanel — panel deslizable que emerge desde la parte inferior
 * del mapa y muestra la tabla de componentes visibles en el viewport.
 *
 * Es análogo a `MapAlertsPanel`: botón circular superior con flecha up/down,
 * tabla interna con selección simple, sincronización con iconos del mapa.
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
  const [open, setOpen] = useState(false);
  const visibles = componentes.slice(0, maxItems);

  return (
    <div
      className={cn(
        'absolute bottom-0 left-1/2 -translate-x-1/2 z-[1000] w-[80%] max-w-[1100px]',
        'bg-background-main rounded-t-[10px] shadow-[0px_-4px_8px_0px_rgba(0,0,0,0.15)]',
        'transition-transform duration-300 ease-out',
        open ? 'translate-y-0' : 'translate-y-[calc(100%-3rem)]',
      )}
    >
      {/* Botón toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Colapsar tabla de componentes' : 'Expandir tabla de componentes'}
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

      {/* Header siempre visible */}
      <div className="h-12 px-5 flex items-center justify-between">
        <h3 className="text-text-primary text-base font-bold font-sans">
          Componentes ({visibles.length}/{maxItems})
        </h3>
        <span className="text-text-secondary text-sm font-normal font-sans">
          Clic en un componente para resaltarlo en el mapa
        </span>
      </div>

      {/* Tabla con scroll */}
      <div className="px-5 pb-5 max-h-[35vh] overflow-y-auto">
        <ComponentsTable
          componentes={visibles}
          selectedId={selectedId}
          onToggleSelect={onToggleSelect}
          sortSelectedFirst
        />
      </div>
    </div>
  );
}