import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pause, Play } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

export interface TimelineDay {
  /** Etiqueta legible del día, ej. "Martes 28". */
  label: string;
  /** Rango de horas [inicio, fin] inclusive, ej. [6, 23]. */
  hourRange: [number, number];
}

export interface TimelineBarProps {
  /**
   * Días agrupados con su etiqueta y rango de horas (para la fila superior y
   * el reparto de marcas). La suma de `hourRange` entre todos los días es la
   * longitud del eje (== `slotHours.length`).
   */
  days: TimelineDay[];

  /**
   * Valor absoluto de hora (0..23) por cada slot del eje en orden creciente,
   * ej. [20, 21, 22, 23, 0, 1, ..., 13]. Soporta cruces de medianoche
   * (cuando el día natural cambia, la lista arranca en 0). Longitud = total
   * de slots.
   */
  slotHours: number[];

  /** Índice del slot actualmente seleccionado (thumb). 0..maxSlot. */
  selectedSlot: number;

  /** Índice del slot correspondiente a la hora real (franja roja). 0..maxSlot. */
  realSlot: number;

  /** Notifica cada vez que el usuario arrastra/clica para cambiar el slot. */
  onSelectSlot: (slot: number) => void;

  /** Indica si la animación automática (play) está activa. */
  isPlaying: boolean;

  /** Alterna play/pausa. La barra lo invoca ante clic en el botón o al
   *  interrumpir el playback con un drag manual del usuario. */
  onTogglePlay: () => void;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

interface DaySegment {
  label: string;
  startSlot: number;
  endSlot: number;
  hourCount: number;
}

/**
 * TimelineBar — barra inferior estilo Meteored (footer permanente de SIACS).
 *
 * Características:
 *   - Eje de tiempo continuo multi-día con etiquetas de día + horas (dos
 *     filas). Scroll horizontal en mobile.
 *   - Franja roja fija que marca `realSlot` (hora real de Perú), independiente
 *     del thumb de exploración.
 *   - Thumb arrastrable (pointer events) + tooltip con la hora seleccionada
 *     y flecha hacia el thumb; persiste unos segundos tras soltar.
 *   - Botón play controlado por el padre (`isPlaying`/`onTogglePlay`). El
 *     playback lo gestiona `PrecipitationTimelineProvider` con rAF (no aquí).
 *   - Al llegar al final del eje, el playback detiene y vuelve al slot 0
 *     (sin rebote). Cualquier drag manual cancela el playback.
 *   - Diseño compacto: botón play size-8, track h-7, font-bold en etiquetas.
 *
 * Cronología: este componente NO hace aritmética de Date. Toda la resolución
 * de horarios vive en `PrecipitationTimelineProvider` (que conoce los
 * `timestamp_str` reales del backend). Aquí sólo se posiciona por slot.
 *
 * Implementación sin librerías externas de timeline/slider: useRef + pointer
 * events. Sólo usa tokens de `tailwind.config.ts`.
 */
export function TimelineBar({
  days,
  slotHours,
  selectedSlot,
  realSlot,
  onSelectSlot,
  isPlaying,
  onTogglePlay,
}: TimelineBarProps) {
  const totalSlots = slotHours.length;
  const maxSlot = totalSlots > 0 ? Math.max(1, totalSlots - 1) : 1;

  // Segmentos por día para pintar etiquetas de día encima de su rango.
  const segments = useMemo<DaySegment[]>(() => {
    return days.reduce<DaySegment[]>((acc, d, i) => {
      const start = i === 0 ? 0 : acc[i - 1].endSlot + 1;
      const hourCount = d.hourRange[1] - d.hourRange[0] + 1;
      acc.push({
        label: d.label,
        startSlot: start,
        endSlot: start + hourCount - 1,
        hourCount,
      });
      return acc;
    }, []);
  }, [days]);

  const labelForSlot = useCallback(
    (slotIdx: number): string => `${String(slotHours[slotIdx] ?? 0).padStart(2, '0')}:00`,
    [slotHours],
  );

  // ── Medición del track para drag y posicionamiento en % ───────────────
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setTrackWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Drag del thumb / clic directo en el track ────────────────────────
  const draggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const selectFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || totalSlots === 0) return;
      const rect = el.getBoundingClientRect();
      const ratio = clamp(
        (clientX - rect.left) / Math.max(1, rect.width),
        0,
        1,
      );
      // Snap al slot entero más cercano: round para que un clic por encima
      // de la mitad de un intervalo caiga en el siguiente slot.
      const slot = clamp(Math.round(ratio * maxSlot), 0, maxSlot);
      onSelectSlot(slot);
    },
    [onSelectSlot, maxSlot, totalSlots],
  );

  // Tooltip visible sólo mientras dura el arrastre del thumb.
  const startDrag = useCallback(
    (clientX: number) => {
      draggingRef.current = true;
      setIsDragging(true);
      selectFromClientX(clientX);
      // Retoma control manual: detiene playback si estaba animando.
      if (isPlaying) onTogglePlay();
    },
    [selectFromClientX, isPlaying, onTogglePlay],
  );

  const endDrag = useCallback(() => {
    draggingRef.current = false;
    setIsDragging(false);
  }, []);

  // Listeners globales para no perder el drag si el cursor sale del track.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      e.preventDefault();
      selectFromClientX(e.clientX);
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      endDrag();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [selectFromClientX, endDrag]);

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (totalSlots === 0) return;
    startDrag(e.clientX);
  };

  // ── Posicionamiento de thumb / línea roja en % ──────────────────────
  const thumbPct =
    trackWidth > 0 ? (clamp(selectedSlot, 0, maxSlot) / maxSlot) * 100 : 0;
  const realPct =
    trackWidth > 0 ? (clamp(realSlot, 0, maxSlot) / maxSlot) * 100 : 0;

  const tooltipHourLabel = labelForSlot(selectedSlot);
  const disabled = totalSlots === 0;

  return (
    <div
      role="group"
      aria-label="Línea de tiempo del pronóstico"
      className={cn(
        'relative z-[1100] w-full',
        'flex items-stretch bg-background-main/95 backdrop-blur',
        'shadow-[0px_-5px_5px_0px_rgba(0,0,0,0.25)]',
        'px-3 py-1 select-none touch-none',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      {/* ── Botón Play circular (compacto, size-8) ───────────────────── */}
      <button
        type="button"
        onClick={onTogglePlay}
        disabled={disabled}
        aria-label={isPlaying ? 'Pausar animación' : 'Reproducir animación'}
        aria-pressed={isPlaying}
        className={cn(
          'shrink-0 size-8 rounded-full inline-flex items-center justify-center',
          'bg-primary-main text-text-invert-primary transition-colors',
          'hover:bg-primary-light focus:outline-none',
          'focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed',
        )}
      >
        {isPlaying ? (
          <Pause className="size-4" strokeWidth={2.5} aria-hidden="true" />
        ) : (
          <Play className="size-4 ml-0.5" strokeWidth={2.5} aria-hidden="true" />
        )}
      </button>

      {/* ── Cuerpo de la barra (dos filas + track) ────────────────────── */}
      <div className="relative flex-1 ml-3 min-w-0 flex flex-col gap-0.5">
        {/* Tooltip flotante sobre el thumb; sólo mientras se arrastra. */}
        {isDragging && (
          <div
            role="status"
            className={cn(
              'absolute -top-1 -translate-x-1/2 -translate-y-full z-[1101]',
              'px-1.5 py-0.5 rounded-[6px] tabular-nums font-sans font-bold',
              'text-text-invert-primary text-xs',
              'bg-primary-light shadow-[0px_2px_4px_0px_rgba(0,0,0,0.25)]',
              'pointer-events-none whitespace-nowrap',
            )}
            style={{ left: `${thumbPct}%` }}
          >
            {tooltipHourLabel}
            {/* Flecha triangular hacia el thumb. */}
            <span
              aria-hidden="true"
              className={cn(
                'absolute left-1/2 -bottom-[4px] -translate-x-1/2',
                'size-0 border-l-[5px] border-r-[5px] border-t-[5px]',
                'border-l-transparent border-r-transparent border-t-primary-light',
              )}
            />
          </div>
        )}

        {/* Fila superior: etiquetas de día alineadas a la izquierda de su
            rango (no centradas) para no chocar con el botón Play. */}
        <div className="relative h-4 hidden sm:block" aria-hidden="true">
          {segments.map((seg) => {
            const startPct = (seg.startSlot / maxSlot) * 100;
            const widthPct = ((seg.hourCount - 1) / maxSlot) * 100;
            return (
              <span
                key={seg.label}
                className="absolute top-0 truncate text-text-primary text-[13px] font-extrabold font-sans"
                style={{ left: `${startPct}%`, width: `${widthPct + 4}%` }}
                title={seg.label}
              >
                {seg.label}
              </span>
            );
          })}
        </div>

        {/* Fila inferior: track + marcas de hora (sin scroll horizontal). */}
        <div className="relative">
          <div
            ref={trackRef}
            onPointerDown={handleTrackPointerDown}
            className="relative h-7 w-full cursor-pointer"
          >
            {/* Línea base del track */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full bg-input-stroke-main/40" />

            {/* Marcas de hora (una por slot del eje, en pasos de 1h). Etiqueta
                visible en cada hora (las 18 de la ventana). */}
            {Array.from({ length: totalSlots }).map((_, i) => {
              const pct = (i / maxSlot) * 100;
              return (
                <div
                  key={i}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                  style={{ left: `${pct}%` }}
                >
                  <div className="w-px h-1 bg-input-stroke-main/70" />
                  <span className="mt-0.5 text-[12px] tabular-nums font-extrabold text-text-primary font-sans whitespace-nowrap">
                    {labelForSlot(i)}
                  </span>
                </div>
              );
            })}

            {/* Franja roja vertical fija = hora real (Perú). */}
            <div
              className={cn(
                'absolute top-0 bottom-0 w-[2px] -translate-x-1/2',
                'bg-secondary-main pointer-events-none',
              )}
              style={{ left: `${realPct}%` }}
              aria-hidden="true"
              title={`Hora real: ${labelForSlot(realSlot)}`}
            />

            {/* Thumb circular = hora seleccionada. Compacto, size-4. */}
            <div
              className={cn(
                'absolute top-1/2 -translate-x-1/2 -translate-y-1/2',
                'size-4 rounded-full bg-primary-main',
                'ring-2 ring-background-main shadow-[0px_2px_4px_0px_rgba(0,0,0,0.3)]',
                'transition-transform duration-75',
                isDragging && 'scale-110',
              )}
              style={{ left: `${thumbPct}%` }}
              role="slider"
              aria-label="Hora seleccionada"
              aria-valuemin={0}
              aria-valuemax={maxSlot}
              aria-valuenow={selectedSlot}
              aria-valuetext={tooltipHourLabel}
            />
          </div>
        </div>
      </div>
    </div>
  );
}