import { useRef, useState } from 'react';
import LayersIcon from '@/assets/icons/layer.svg?react';
import { useClickOutside } from '@/shared/hooks/useClickOutside';
import { cn } from '@/shared/lib/cn';

/**
 * Capa disponible en el control de capas del mapa.
 *
 * `id` debe ser estable en sesión (se usa para el Set de seleccionadas).
 * `label` es el texto visible en el menú.
 */
export interface LayerControlOption {
  id: LayerId;
  label: string;
}

/** IDs de capas soportados (union para type-safety en el switch). */
export type LayerId = 'precipitaciones' | 'alertas' | 'componentes';

interface LayerControlProps {
  /**
   * Lista de capas disponibles para activar. Por defecto las 3 del sistema.
   * Para añadir una nueva capa: agrega un caso aqui y un `<XxxLayer />` al mapa.
   */
  options?: LayerControlOption[];
  /**
   * Capas activamente seleccionadas. Recibe esto para controlizar desde la
   * página (controlled) y poder renderizar las capas correspondientes.
   */
  selected: Set<LayerId>;
  /** Callback al cambiar la selección. Recibe el nuevo Set inmutable. */
  onToggle: (id: LayerId) => void;
}

// Orden de capas del diseño Figma.
const DEFAULT_OPTIONS: LayerControlOption[] = [
  { id: 'precipitaciones', label: 'Mapa de Precipitaciones' },
  { id: 'alertas', label: 'Mapa de Alertas' },
  { id: 'componentes', label: 'Mapa de Componentes' },
];

// Sombra del menú según Figma (combinación de 2 shadow tokens).
const MENU_SHADOW =
  'shadow-[0px_5.08px_13.55px_-3.39px_rgba(92,93,164,0.06)] shadow-[0px_6.78px_54.2px_-6.78px_rgba(111,108,143,0.12)]';
const ITEM_SHADOW = 'shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]';

/**
 * LayerControl — botón flotante circular con icono "layer" + menú de
 * selección múltiple de capas según diseño Figma.
 *
 * Comportamiento:
 *   - Click en el botón: abre o cierra el menú.
 *   - Click en una capa del menú: alterna su selección (puede haber varias
 *     activas a la vez).
 *   - Click fuera del control: cierra el menú (sin perder la selección).
 *
 * Estados visuales del botón:
 *   - Cerrado: bg-background-main (blanco), icono text-primary (oscuro).
 *   - Abierto : bg-primary-states-selected-light (navy claro), icono blanco.
 *
 * El menú se ancla a la derecha del botón (alineado abajo), con fondo
 * `bg-background-main`, items `text-text-primary` medium, cada uno con un
 * checkbox (caja cuadrada con borde) que se rellena al activar.
 *
 * NOTA: este componente DEBE usarse dentro de un contexto de Leaflet
 * (`MapContainer`) porque invoca `useMap()` para posicionar el control como
 * overlay de Leaflet (par北站 removible). De momento lo dejamos como un
 * componente normal posicionado absolute sobre el contenedor del mapa.
 * Si necesitas integración con `L.control`, se cambia a un control custom.
 */
export function LayerControl({
  options = DEFAULT_OPTIONS,
  selected,
  onToggle,
}: LayerControlProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false), open);

  return (
    <div
      ref={containerRef}
      className={cn('absolute right-5 top-5 z-[1000] flex flex-col items-end gap-2.5', MENU_SHADOW)}
    >
      {/* Botón circular principal */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Capas del mapa"
        className={cn(
          'size-14 rounded-full flex items-center justify-center transition-colors',
          ITEM_SHADOW,
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2',
          open
            ? 'bg-primary-states-selected-light'
            : 'bg-background-main hover:bg-primary-states-hover-main',
        )}
      >
        <LayersIcon
          className={cn(
            'size-9',
            open ? 'text-text-invert-primary' : 'text-text-primary',
          )}
          aria-hidden="true"
        />
      </button>

      {/* Menú de capas — se muestra solo con click, múltiples opciones */}
      {open && (
        <div
          role="menu"
          aria-label="Seleccione las capas a mostrar"
          className="w-64 rounded-md bg-text-invert-primary border border-input-stroke-main overflow-hidden"
        >
          {options.map((option) => {
            const isOn = selected.has(option.id);
            return (
              <button
                key={option.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={isOn}
                onClick={() => onToggle(option.id)}
                //className="w-full h-14 px-3.5 py-[5px] bg-text-invert-primary border-b-[0.5px] border-input-stroke-main inline-flex justify-start items-center gap-2.5 transition-colors hover:bg-primary-states-hover-light"
                className={cn(
                    'w-full h-14 px-3.5 py-[5px] border-b-[0.5px] border-input-stroke-main inline-flex justify-start items-center gap-2.5 transition-colors',
                    isOn ? 'bg-primary-states-selected-light' : 'bg-text-invert-primary hover:bg-primary-states-hover-light',
                  )}  
              >
                {/* Checkbox */}
                <span
                  className={cn(
                    'size-3.5 rounded-[3px] outline outline-1 outline-offset-[-0.5px] outline-input-stroke-main inline-flex items-center justify-center transition-colors',
                    isOn && 'bg-primary-main outline-primary-main',
                  )}
                >
                  {isOn && (
                    <svg
                      viewBox="0 0 12 12"
                      className="size-2.5 text-text-invert-primary"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 6.5L5 9.5L10 3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span className="text-center text-text-primary text-sm font-medium font-sans">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}