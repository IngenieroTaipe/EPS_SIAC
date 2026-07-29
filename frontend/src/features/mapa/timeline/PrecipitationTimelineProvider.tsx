import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useGfsForecast } from '@/services/useGfsForecast';
import {
  extractHHmm,
  type GfsClusterFeature,
  type GfsClusterFeatureCollection,
  type GfsTemporalStatus,
} from '@/features/mapa/types/gfs';
import {
  peruNow,
  peruStartOfDay,
} from '@/features/mapa/timeline/peruTime';
import type { TimelineDay } from '@/features/mapa/components/TimelineBar';
import type { GfsFrame } from '@/features/mapa/timeline/types';
import {
  PrecipitationTimelineContext,
  type PrecipitationTimelineContextValue,
} from './PrecipitationTimelineContext';

const MS_PER_HOUR = 1000 * 60 * 60;

function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * MS_PER_HOUR);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Orden cronológico de la ventana 18h: HISTORIC = vuelta previa > FORECAST. */
function temporalStatusPriority(s: GfsTemporalStatus | undefined): number {
  return s === 'HISTORIC' ? 0 : 1;
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function dayLabelFor(d: Date): string {
  const w = WEEKDAYS[d.getDay()];
  return `${capitalize(w)} ${d.getDate()}`;
}

/**
 * PrecipitationTimelineProvider — fuente única de verdad del eje de tiempo
 * de precipitaciones GFS. Levanta el fetch (`useGfsForecast`), el `frameIndex`
 * seleccionado, el estado de playback (`isPlaying`) y el estado derivado
 * para `<TimelineBar>` (`days`, `currentRealHour` Perú, `selectedHour`...).
 *
 * Montaje: en `AppLayout`, envolviendo el `<Outlet />`. Así la timeline puede
 * vivir como footer permanente de toda la app, y las capas (clusters/celdas)
 * consumen este contexto para recolorearse según `frameIndex` sin duplicar
 * la lógica de fetch ni la de animación.
 *
 * Convención horaria: todas las fechas están en hora de Perú (PET, UTC-5)
 * vía `peruNow()`/`peruStartOfDay()`, independientemente del timezone del
 * contenedor Docker. La franja roja del timeline marca siempre la hora
 * real de Perú.
 *
 * Animación del playback con `requestAnimationFrame`. Al llegar al final
 * detiene y vuelve al frame 0 (sin rebote); un drag manual cancela el
 * playback a través del `onTogglePlay` invocado por el propio TimelineBar.
 */
export function PrecipitationTimelineProvider({ children }: { children: ReactNode }) {
  const { data, loading, error, refetch } = useGfsForecast();

  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // ── Ticker: refresca `currentRealHour` cada minuto para que la franja
  //    roja del timeline siga la hora real de Perú aunque el componente
  //    no se re-renderice por otras razones. Patrón legítimo de
  //    sincronización con sistema externo (reloj del sistema).
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Frames ordenados cronológicamente (HISTORIC → FORECAST) ──────────
  const frames = useMemo<GfsFrame[]>(() => {
    const feats = (data as GfsClusterFeatureCollection | null)?.features ?? [];
    const byKey = new Map<string, GfsFrame>();
    for (const f of feats) {
      const p = f.properties ?? null;
      if (!p) continue;
      const step = typeof p.time_step === 'number' ? p.time_step : null;
      const status = (p.temporal_status ?? 'FORECAST') as GfsTemporalStatus;
      if (step === null) continue;
      const key = `${status}-${step}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          temporal_status: status,
          time_step: step,
          label: extractHHmm(p.timestamp_str),
        });
      }
    }
    const arr = Array.from(byKey.values());
    arr.sort(
      (a, b) =>
        temporalStatusPriority(a.temporal_status) -
          temporalStatusPriority(b.temporal_status) ||
        a.time_step - b.time_step,
    );
    return arr;
  }, [data]);

  const totalSlots = frames.length;
  const maxSlot = totalSlots > 0 ? Math.max(1, totalSlots - 1) : 1;
  const clampedFrameIndex = totalSlots > 0 ? clamp(frameIndex, 0, maxSlot) : 0;

  // ── Eje de tiempo: base anclada al inicio del día de Perú ────────────
  const base = useMemo(() => {
    const firstLabel = frames[0]?.label ?? '0:00';
    const hh = parseInt(firstLabel.split(':')[0], 10) || 0;
    const b = peruStartOfDay();
    b.setHours(hh, 0, 0, 0);
    return b;
  }, [frames]);

  // Hora real de Perú, refrescada por `nowTick` (cada 60s) además de en
  // cada render. useMemo con `nowTick` en deps fuerza recálculo cuando
  // el ticker dispara.
  // `nowTick` está en deps deliberadamente: no se usa en el cuerpo (lo que
  // infla el lint) pero fuerza el reproceso cuando el ticker dispara.
  const currentRealHour = useMemo(() => peruNow(), [nowTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const selectedHour = useMemo(
    () => addHours(base, clampedFrameIndex),
    [base, clampedFrameIndex],
  );

  // ── Días agrupados (para etiquetas de fila superior) ─────────────────
  const days = useMemo<TimelineDay[]>(() => {
    if (totalSlots === 0) return [];
    const groups: TimelineDay[] = [];
    for (let i = 0; i < totalSlots; i++) {
      const d = addHours(base, i);
      const label = dayLabelFor(d);
      const h = d.getHours();
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.hourRange[1] = h;
      } else {
        groups.push({ label, hourRange: [h, h] });
      }
    }
    return groups;
  }, [base, totalSlots]);

  // ── Selección desde TimelineBar (Date → slot) ───────────────────────
  const onSelectHour = useCallback(
    (hour: Date) => {
      const slot = Math.round((hour.getTime() - base.getTime()) / MS_PER_HOUR);
      const clamped = totalSlots > 0 ? clamp(slot, 0, maxSlot) : 0;
      setFrameIndex(clamped);
    },
    [base, totalSlots, maxSlot],
  );

  const onTogglePlay = useCallback(() => setIsPlaying((v) => !v), []);

  // ── Refs sincronizadas vía layoutEffect (no en render) ─────────────
  const frameIndexRef = useRef(clampedFrameIndex);
  const maxSlotRef = useRef(maxSlot);
  useLayoutEffect(() => {
    frameIndexRef.current = clampedFrameIndex;
    maxSlotRef.current = maxSlot;
  }, [clampedFrameIndex, maxSlot]);

  // ── Animación play (requestAnimationFrame; detiene en final) ────────
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const accumRef = useRef<number>(0);
  const SPEED_MS_PER_SLOT = 700;

  useEffect(() => {
    if (!isPlaying || totalSlots === 0) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    lastFrameRef.current = 0;
    accumRef.current = 0;

    const tick = (ts: number) => {
      if (lastFrameRef.current === 0) lastFrameRef.current = ts;
      const dt = ts - lastFrameRef.current;
      lastFrameRef.current = ts;
      accumRef.current += dt;

      if (accumRef.current >= SPEED_MS_PER_SLOT) {
        const steps = Math.floor(accumRef.current / SPEED_MS_PER_SLOT);
        accumRef.current -= steps * SPEED_MS_PER_SLOT;

        const cur = frameIndexRef.current;
        const next = cur + steps;
        const max = maxSlotRef.current;

        if (next >= max) {
          // Llegó al final: detener y volver al estado original (frame 0, pausado).
          frameIndexRef.current = 0;
          accumRef.current = 0;
          setFrameIndex(0);
          setIsPlaying(false);
          return; // no agenda más frames; el cleanup cancela raf pendiente.
        }
        frameIndexRef.current = next;
        setFrameIndex(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isPlaying, totalSlots]);

  // ── renderData con geometría swap a `_smoothedGeometry` ──────────────
  const renderData = useMemo<GfsClusterFeatureCollection | null>(() => {
    if (!data) return null;
    return {
      type: 'FeatureCollection',
      metadata: data.metadata,
      features: data.features.map((f: GfsClusterFeature) => ({
        ...f,
        geometry: f.properties._smoothedGeometry ?? f.geometry,
      })),
    };
  }, [data]);

  const value: PrecipitationTimelineContextValue = {
    data,
    renderData,
    loading,
    error,
    refetch,
    frames,
    frameIndex: clampedFrameIndex,
    setFrameIndex,
    activeFrame: frames[clampedFrameIndex],
    timelineProps: {
      days,
      currentRealHour,
      selectedHour,
      onSelectHour,
      isPlaying,
      onTogglePlay,
    },
  };

  return (
    <PrecipitationTimelineContext.Provider value={value}>
      {children}
    </PrecipitationTimelineContext.Provider>
  );
}