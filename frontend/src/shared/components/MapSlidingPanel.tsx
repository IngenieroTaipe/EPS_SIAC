import { useState, type ReactNode } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

/**
 * MapSlidingPanel — panel deslizable genérico que emerge desde la parte
 * inferior del mapa. Lo usan `MapAlertsPanel` y `MapComponentsPanel` para
 * evitar duplicar la lógica de animación, el botón toggle circular y las
 * clases de layout (`z-[1000]`, `w-[80%]`, `max-w-[1100px]`, sombra, etc.).
 *
 * Características:
 *   - Botón flecha up/down en el tope, centrado.
 *   - Header siempre visible (título + subtítulo).
 *   - Contenido deslizable con scroll vertical propio (`max-h-[35vh]`).
 *   - El estado `open` vive aquí; los children solo se montan siempre
 *     (la animación es por transform, no por unmount).
 *
 * Si quieres que algún comportamiento del header sea dinámico, pasa un
 * `ReactNode` en `title` (p.ej. `Alertas activas (3/10)`).
 */
interface MapSlidingPanelProps {
  /** Título del panel (visible siempre, en el header). */
  title: ReactNode;
  /** Subtítulo a la derecha del título (texto secundario). */
  subtitle?: string;
  /** Etiquetas aria para el botón circular. */
  expandLabel: string;
  collapseLabel: string;
  /** Contenido deslizable (típicamente la tabla). */
  children: ReactNode;
}

export function MapSlidingPanel({
  title,
  subtitle,
  expandLabel,
  collapseLabel,
  children,
}: MapSlidingPanelProps) {
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
      {/* Botón toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? collapseLabel : expandLabel}
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
        <h3 className="text-text-primary text-base font-bold font-sans">{title}</h3>
        {subtitle && (
          <span className="text-text-secondary text-sm font-normal font-sans">
            {subtitle}
          </span>
        )}
      </div>

      {/* Contenido deslizable */}
      <div className="px-5 pb-5 max-h-[35vh] overflow-y-auto">{children}</div>
    </div>
  );
}