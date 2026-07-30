import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

// Iconos de figma importados como componentes React.
import MapaIcon from '@/assets/icons/mapa.svg?react';
import LeftIcon from '@/assets/icons/left.svg?react';
import RightIcon from '@/assets/icons/right.svg?react';
import CircleIcon from '@/assets/icons/circle.svg?react';

// Iconos de items de leyenda (cada uno en su color temático fijado por Figma).
// Los importamos como svg?react; el `currentColor` se sobreescribe con style
// para colorearlos según su estado.
import DangerLeyendaIcon from '@/assets/icons/danger-leyenda.svg?react';
import WarningLeyendaIcon from '@/assets/icons/warning-leyenda.svg?react';
import SuccessLeyendaIcon from '@/assets/icons/success-leyenda.svg?react';
import InProcessLeyendaIcon from '@/assets/icons/in-process-resolve-leyenda.svg?react';
import CaptacionIcon from '@/assets/icons/captacion.svg?react';
import ReservorioIcon from '@/assets/icons/reservorio.svg?react';
import PlantaTratamientoIcon from '@/assets/icons/planta-tratamiento.svg?react';
import LineaConduccionIcon from '@/assets/icons/linea-conduccion.svg?react';

/**
 * MapLegend — leyenda flotante sobre el mapa (esquina inferior izquierda).
 *
 * Características (según diseño Figma):
 *
 *   - 3 variaciones: 'alertas', 'precipitaciones', 'componentes'.
 *   - Auto-rotación cada 5 segundos (en bucle) entre las 3.
 *   - Al minimizar colapsa a un único botón circular con el icono `mapa.svg`
 *     (no se muestra el header). Clic en el botón → expande al panel completo.
 *   - Arranca minimizada por defecto (initialMinimized = true).
 *   - Botones abajo:
 *       • 3 dots circulares que indican en cuál de las 3 variaciones estás.
 *         Click en un dot → cambia a esa variación directamente.
 *       • 2 flechas izquierda/derecha para navegar manualmente entre
 *         variaciones (también pausa el auto-rotate temporalmente).
 *   - Margen esquina inferior izquierda (`left-5 bottom-5`).
 *   - Icono `mapa.svg` junto al título "LEYENDA - <VARIACIÓN>".
 *
 * Estructura del componente:
 *
 *   <button absolute bottom-left> (si minimized — solo icono mapa.svg)
 *
 *   <div absolute bottom-left>     (si expandida)
 *     <header> icono + "LEYENDA - X" | botón minimizar </header>
 *     <body>
 *       items
 *       <footer> dots + flechas </footer>
 *     </body>
 *   </div>
 */

/** Variantes de leyenda disponibles (en este orden cíclico). */
type LegendVariant = 'alertas' | 'precipitaciones' | 'componentes';

/** Intervalo de auto-rotación en ms (5 segundos). Ajustable aquí. */
const AUTO_ROTATE_INTERVAL_MS = 5_000;

const VARIANTS: LegendVariant[] = ['alertas', 'precipitaciones', 'componentes'];

const VARIANT_TITLE: Record<LegendVariant, string> = {
  alertas: 'ALERTAS',
  precipitaciones: 'PRECIPITACIONES',
  componentes: 'COMPONENTES',
};

/** Item de leyenda genérico (línea con icono + texto). */
interface LegendItem {
  /** Icono o color de muestra a la izquierda. */
  visual: React.ReactNode;
  /** Texto a la derecha (acepta spans con distintos colores). */
  label: React.ReactNode;
}

/** Catálogo de items por variación. Editar aquí para añadir/quitar entradas. */
const LEGEND_ITEMS: Record<LegendVariant, LegendItem[]> = {
  alertas: [
    {
      visual: <DangerLeyendaIcon className="size-6" style={{ color: 'var(--eps-danger-dark)' }} />,
      label: (
        <>
          <span className="text-text-primary text-[11px] font-normal font-sans leading-tight">
            Alerta de precipitación{' '}
          </span>
          <span className="text-danger-main text-[11px] font-normal font-sans leading-tight">
            CONFIRMADA
          </span>
        </>
      ),
    },
    {
      visual: <WarningLeyendaIcon className="size-6" style={{ color: 'var(--eps-warning-dark)' }} />,
      label: (
        <>
          <span className="text-text-primary text-[11px] font-normal font-sans leading-tight">
            Alerta de precipitación{' '}
          </span>
          <span className="text-warning-dark text-[11px] font-normal font-sans leading-tight">
            POR CONFIRMAR
          </span>
        </>
      ),
    },
    {
      visual: <SuccessLeyendaIcon className="size-6" style={{ color: 'var(--eps-success-dark)' }} />,
      label: (
        <>
          <span className="text-text-primary text-[11px] font-normal font-sans leading-tight">
            Alerta de precipitación{' '}
          </span>
          <span className="text-success-main text-[11px] font-normal font-sans leading-tight">
            ATENDIDA
          </span>
        </>
      ),
    },
    {
      visual: <InProcessLeyendaIcon className="size-6" style={{ color: 'var(--eps-alerts-status-en-proceso-atencion)' }} />,
      label: (
        <>
          <span className="text-text-primary text-[11px] font-normal font-sans leading-tight">
            Alerta de precipitación{' '}
          </span>
          <span className="text-primary-extra-light text-[11px] font-normal font-sans leading-tight">
            EN PROCESO DE ATENCIÓN
          </span>
        </>
      ),
    },
  ],
  precipitaciones: [
    // Cada item muestra solo el color + etiqueta (sin icono).
    {
      visual: (
        <div className="w-7 h-4 rounded-md outline outline-2 bg-alerts-precipitaciones-extremadamente-lluvioso outline-alerts-precipitaciones-states-extremadamente-lluvioso" />
      ),
      label: (
        <>
          <span className="text-text-primary text-[11px] font-normal font-sans leading-tight">
            Precipitación{' '}
          </span>
          <span className="text-alerts-precipitaciones-extremadamente-lluvioso text-[11px] font-normal font-sans leading-tight">
            EXTREMADAMENTE LLUVIOSO
          </span>
        </>
      ),
    },
    {
      visual: (
        <div className="w-7 h-4 rounded-md outline outline-2 bg-alerts-precipitaciones-muy-lluvioso outline-alerts-precipitaciones-states-muy-lluvioso" />
      ),
      label: (
        <>
          <span className="text-text-primary text-[11px] font-normal font-sans leading-tight">
            Precipitación{' '}
          </span>
          <span className="text-alerts-precipitaciones-muy-lluvioso text-[11px] font-normal font-sans leading-tight">
            MUY LLUVIOSO
          </span>
        </>
      ),
    },
    {
      visual: (
        <div className="w-7 h-4 rounded-md outline outline-2 bg-alerts-precipitaciones-lluvioso outline-alerts-precipitaciones-states-lluvioso" />
      ),
      label: (
        <>
          <span className="text-text-primary text-[11px] font-normal font-sans leading-tight">
            Precipitación{' '}
          </span>
          <span className="text-alerts-precipitaciones-lluvioso text-[11px] font-normal font-sans leading-tight">
            LLUVIOSO
          </span>
        </>
      ),
    },
    {
      visual: (
        <div className="w-7 h-4 rounded-md outline outline-2 bg-alerts-precipitaciones-moderadamente-lluvioso outline-alerts-precipitaciones-states-moderadamente-lluvioso" />
      ),
      label: (
        <>
          <span className="text-text-primary text-[11px] font-normal font-sans leading-tight">
            Precipitación{' '}
          </span>
          <span className="text-alerts-precipitaciones-moderadamente-lluvioso text-[11px] font-normal font-sans leading-tight">
            MODERAMENTE LLUVIOSO
          </span>
        </>
      ),
    },
  ],
  componentes: [
    {
      visual: <CaptacionIcon className="w-7 h-7" style={{ color: 'var(--eps-primary-main)' }} />,
      label: (
        <span className="text-text-primary text-[11px] font-normal font-sans leading-tight">
          CAPTACIÓN
        </span>
      ),
    },
    {
      visual: <ReservorioIcon className="w-7 h-7" style={{ color: 'var(--eps-primary-main)' }} />,
      label: (
        <span className="text-text-primary text-[11px] font-normal font-sans leading-tight">
          RESERVORIO
        </span>
      ),
    },
    {
      visual: <PlantaTratamientoIcon className="w-7 h-7" style={{ color: 'var(--eps-primary-main)' }} />,
      label: (
        <span className="text-text-primary text-[11px] font-normal font-sans leading-tight">
          PLANTA DE TRATAMIENTO
        </span>
      ),
    },
    {
      visual: <LineaConduccionIcon className="w-7 h-7" style={{ color: 'var(--eps-secondary-main)' }} />,
      label: (
        <span className="text-text-primary text-[11px] font-normal font-sans leading-tight">
          LÍNEA DE CONDUCCIÓN
        </span>
      ),
    },
  ],
};

interface MapLegendProps {
  /** Variación inicial al montar el componente. Default 'alertas'. */
  initialVariant?: LegendVariant;
  /** Si la leyenda arranca minimizada. Default true (colapsada en botón circular). */
  initialMinimized?: boolean;
}

export function MapLegend({
  initialVariant = 'alertas',
  initialMinimized = true,
}: MapLegendProps) {
  const [current, setCurrent] = useState<LegendVariant>(initialVariant);
  const [minimized, setMinimized] = useState(initialMinimized);
  // Si el usuario navega manualmente (dots o flechas), pausamos el auto-rotate
  // hasta que pasen 2 ciclos del intervalo. Esto evita saltos bruscos.
  const pauseAutoRotateRef = useRef(false);

  const nextIndex = (idx: number) => (idx + 1) % VARIANTS.length;
  const prevIndex = (idx: number) => (idx - 1 + VARIANTS.length) % VARIANTS.length;

  const goTo = useCallback((v: LegendVariant) => {
    setCurrent(v);
    pauseAutoRotateRef.current = true;
    // Quita la pausa después de 2 intervalos (10s).
    setTimeout(() => {
      pauseAutoRotateRef.current = false;
    }, AUTO_ROTATE_INTERVAL_MS * 2);
  }, []);

  const goNext = useCallback(() => {
    setCurrent((c) => {
      const idx = VARIANTS.indexOf(c);
      return VARIANTS[nextIndex(idx)];
    });
    pauseAutoRotateRef.current = true;
    setTimeout(() => {
      pauseAutoRotateRef.current = false;
    }, AUTO_ROTATE_INTERVAL_MS * 2);
  }, []);

  const goPrev = useCallback(() => {
    setCurrent((c) => {
      const idx = VARIANTS.indexOf(c);
      return VARIANTS[prevIndex(idx)];
    });
    pauseAutoRotateRef.current = true;
    setTimeout(() => {
      pauseAutoRotateRef.current = false;
    }, AUTO_ROTATE_INTERVAL_MS * 2);
  }, []);

  // Auto-rotate cada 10s (a menos que esté pausado o minimizado).
  useEffect(() => {
    if (minimized) return;
    const id = setInterval(() => {
      if (pauseAutoRotateRef.current) return;
      setCurrent((c) => VARIANTS[nextIndex(VARIANTS.indexOf(c))]);
    }, AUTO_ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [minimized]);

  const currentIndex = VARIANTS.indexOf(current);
  const items = LEGEND_ITEMS[current];

  // Estado minimizado: colapsa a un único botón circular con el icono `mapa.svg`.
  // No se muestra el header completo. Al hacer clic se expande al panel completo.
  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        aria-label="Expandir leyenda"
        aria-expanded={false}
        className="absolute bottom-20 left-5 z-[1000] size-12 rounded-full p-2.5
                   bg-background-main shadow-[0px_5px_5px_0px_rgba(0,0,0,0.25)]
                   flex items-center justify-center
                   text-text-primary hover:bg-primary-states-hover-main transition-colors
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2"
        role="complementary"
        aria-labelledby="map-legend-toggle"
      >
        <MapaIcon className="size-7 text-text-primary" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div
      className="absolute bottom-20 left-5 z-[1000] w-72 max-w-[calc(100%-2.5rem)] p-2
                 bg-background-main rounded-lg shadow-[0px_5px_5px_0px_rgba(0,0,0,0.25)]
                 flex flex-col gap-1"
      role="complementary"
      aria-label={`Leyenda del mapa — ${VARIANT_TITLE[current]}`}
    >
      {/* ── Header: icono + título + botón minimizar ───────────────────── */}
      <div className="self-stretch inline-flex justify-between items-center">
        <div className="inline-flex justify-start items-center gap-1.5">
          <MapaIcon
            className="size-5 text-text-primary"
            aria-hidden="true"
          />
          <span className="text-text-primary text-xs font-medium font-sans leading-tight">
            LEYENDA
          </span>
          <span className="text-text-primary text-xs font-medium font-sans leading-tight">
            -
          </span>
          <span className="text-text-primary text-xs font-medium font-sans leading-tight">
            {VARIANT_TITLE[current]}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setMinimized(true)}
          aria-label="Minimizar leyenda"
          aria-expanded={false}
          className="size-6 rounded-full flex items-center justify-center
                     text-text-primary hover:bg-primary-states-hover-main transition-colors
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2"
        >
          <ChevronDown className="size-4" strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>

      {/* ── Body: items + footer ──────────────────────────────────────────── */}
      <>
        <div className="self-stretch pt-1 flex flex-col justify-start items-start gap-1">
          {items.map((item, i) => (
            <div
              key={`${current}-${i}`}
              className="self-stretch inline-flex justify-start items-center gap-2"
            >
              {/* Contenedor de icono/indicador con ancho mínimo fijo (28px) en las 3 variantes */}
              <div className="shrink-0 inline-flex justify-center items-center w-7 h-7">
                {item.visual}
              </div>
              <div className="flex-1 text-left">{item.label}</div>
            </div>
          ))}
        </div>

        {/* ── Footer: dots + flechas ─────────────────────────────────────── */}
        <div className="self-stretch pt-1 inline-flex justify-between items-center">
          {/* Dots: posición actual + acceso directo */}
          <div className="flex justify-start items-center gap-1">
            {VARIANTS.map((v, idx) => (
              <button
                key={v}
                type="button"
                aria-label={`Ir a leyenda ${VARIANT_TITLE[v]}`}
                onClick={() => goTo(v)}
                className="size-2 grid place-items-center rounded-full shrink-0"
              >
                <CircleIcon
                  className={cn(
                    'size-1.5',
                    idx === currentIndex
                      ? 'text-text-primary'
                      : 'text-text-status-placeholder',
                  )}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>

          {/* Flechas izquierda/derecha */}
          <div className="flex justify-start items-center gap-2">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Leyenda anterior"
              className="size-5 rounded-full inline-flex justify-center items-center
                         text-text-primary hover:bg-primary-states-hover-main transition-colors
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2"
            >
              <LeftIcon className="size-3" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Leyenda siguiente"
              className="size-5 rounded-full inline-flex justify-center items-center
                         text-text-primary hover:bg-primary-states-hover-main transition-colors
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2"
            >
              <RightIcon className="size-3" aria-hidden="true" />
            </button>
          </div>
        </div>
      </>
    </div>
  );
}