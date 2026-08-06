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
  type GfsClusterFeature,
  type GfsClusterFeatureCollection,
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

/**
 * Parsea un `request_code` (ej. `AUTO_20260805_18Z`) a un `Date` naive en
 * wall-clock PET (UTC-5). El run NOAA arranca a la hora Z (UTC), así que
 * restamos 5h para obtener el instante en hora de Perú.
 *
 * Returns `null` si el código no matching el formato esperado.
 */
function parseRunCodeToPetDate(requestCode?: string | null): Date | null {
  if (!requestCode) return null;
  const m = requestCode.match(/^AUTO_(\d{4})(\d{2})(\d{2})_(\d{2})Z$/);
  if (!m) return null;
  const [, y, mo, d, hh] = m;
  // Construye "run-start" en UTC naive y resta 5h para PET naive.
  const runUtc = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(hh),
    0,
    0,
    0,
  );
  return new Date(runUtc.getTime() - 5 * MS_PER_HOUR);
}

/** Formatea un `Date` naive PET a "HH:mm". */
function formatHHmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * MS_PER_HOUR);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
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
  const { data, loading, error, refetch: refetchGfs } = useGfsForecast();

  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // ── Una vez que llegan los frames por primera vez, posiciona el thumb
  //    del timeline en la hora actual (realSlot) en vez de dejarlo en 0.
  //    Se ejecuta una sola vez por carga de ventana (flag ref).
  const hasInitializedRef = useRef(false);

  // ── Ticker: refresca `currentRealHour` cada minuto para que la franja
  //    roja del timeline siga la hora real de Perú aunque el componente
  //    no se re-renderice por otras razones. Patrón legítimo de
  //    sincronización con sistema externo (reloj del sistema).
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Polling del pronóstico GFS: el backend publica una corrida nueva
  //    cada 6 h (Celery beat 1/7/13/19 UTC ≈ 02/08/14/20 PET), pero la
  //    descarga del NOAA tarda minutos variables. En vez de sincronizar al
  //    cron, hacemos polling ligero cada 5 min: el backend sirve 304 cuando
  //    no hay cambios (overhead ~0), así detectamos la nueva corrida en
  //    ≤5 min tras su publicación. Se pausa mientras la pestaña está oculta
  //    (no consumimos red en background) y se dispara refresco inmediato al
  //    recobrar visibilidad. Convive con el ticker de 60s de la franja roja.
  const refetch = refetchGfs;
  useEffect(() => {
    const POLL_MS = 5 * 60_000;

    const poll = () => refetch();
    const onVisible = () => {
      if (document.visibilityState === 'visible') poll();
    };

    let id: ReturnType<typeof setInterval> | null = null;
    if (document.visibilityState === 'visible') {
      id = setInterval(poll, POLL_MS);
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (id != null) clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refetch]);

  // ── Frames teóricos — siempre 18 slots (6 HISTORIC + 12 FORECAST) ────
  // Construidos desde `metadata.latest_request_code` y `previous_request_code`
  // para garantizar un eje continuo sin saltos aunque NOAA no detecte lluvia
  // en algunas horas. Las capas (PrecipitationLayer, Cells) filtran features
  // por (temporal_status, time_step); si no hay features para un slot, el
  // mapa simplemente no muestra nada en ese frame (= "no llovió esa hora").
  //
  // === Cold-start (solo una corrida COMPLETED en DB) ===
  // Si `previous_request_code == latest_request_code`, el backend recicla
  // la misma corrida para el slice HISTORIC (`geojson_builder.py:203-204`).
  // Aquí construimos los 6 slots HISTORIC teóricos como `latestPet - 6h`,
  // lo que produce etiquetas 08:00..13:00 PET. **Estas etiquetas son
  // teóricas, no reales** — los features HISTORIC del backend tienen
  // timestamps reales de la latest+0..+6h, no de "hace 6h". Esto duplica
  // visualmente los slots (HISTORIC 08-13 y FORECAST 14-19 muestran los
  // mismos datos). Cuando entre una segunda corrida real (previous ≠ latest),
  // el HISTORIC pasa a usar `previousPet` real y los slots ya no duplican.
  //
  //  -> ¿Por qué lo dejamos así en cold-start? Porque la regla de UX es
  //     "siempre 18 slots, sin saltos". El usuario ve el eje completo aunque
  //     las primeras 6h sean teóricas. Cuando arrastra el thumb a HISTORIC
  //     y no encuentra clusters reales, el mapa queda limpio — mismo
  //     comportamiento que un slot FORECAST sin precipitación.
  //
  //  -> Las capas que mapean por `activeFrame.time_step` (clusters, celdas)
  //     dibujan features del slice HISTORIC del backend, que en cold-start
  //     son los mismos que el FORECAST. Por eso en los HISTORIC verás
  //     clusters reales (no simulados). Es "duplicado" pero es lo que el
  //     backend sirve. Aceptable en cold-start; auto-corregido al entrar
  //     la segunda corrida.
  //
  // Fallbacks:
  //   - Sin metadata → 0 frames (timeline oculta, igual que antes).
  //   - `previous_request_code` ausente o == latest → HISTORIC baseado en
  //     `latest - 6h` (réplica del comportamiento del backend cuando recicla
  //     la única corrida como previous). Los timestamps coincidirán con los
  //     features HISTORIC reales (si los hay) porque el backend usa la misma
  //     corrida para ambos slices.
  //   - Si la corrida previa tiene `GFS_TOTAL_HOURS_FORECAST` distinto de 12
  //     en el futuro (16), el primer tramo pasa a ser 6h igual — son slots
  //     teóricos, no dependencies del tamaño del forecast. Ver TODO en
  //     `constants.py` y `geojson_builder.py` para ampliar el segundo tramo
  //     de `BETWEEN 1 AND 12` a `BETWEEN 1 AND 16`.
  const frames = useMemo<GfsFrame[]>(() => {
    const meta = data?.metadata;
    if (!meta) return [];

    const latestPet = parseRunCodeToPetDate(meta.latest_request_code);
    if (!latestPet) return [];

    // Base del HISTORIC: previous real si existe, si no latest - 6h.
    let previousPet = parseRunCodeToPetDate(meta.previous_request_code);
    if (!previousPet || meta.previous_request_code === meta.latest_request_code) {
      previousPet = new Date(latestPet.getTime() - 6 * MS_PER_HOUR);
    }

    const arr: GfsFrame[] = [];
    // HISTORIC: 6 slots, step 1..6, timestamp = previousPet + step horas.
    for (let step = 1; step <= 6; step++) {
      const ts = new Date(previousPet.getTime() + step * MS_PER_HOUR);
      arr.push({
        temporal_status: 'HISTORIC',
        time_step: step,
        label: formatHHmm(ts),
        timestampDate: ts,
      });
    }
    // FORECAST: 12 slots, step 1..12, timestamp = latestPet + step horas.
    // === TODO / FUTURE-PROOFING: cuando `GFS_TOTAL_HOURS_FORECAST` suba a 16,
    // cambiar este loop a `step <= 16`. Sincronizar con
    // `backend/.../constants.py` y `geojson_builder.py` (slice `BETWEEN 1 AND 16`).
    for (let step = 1; step <= 12; step++) {
      const ts = new Date(latestPet.getTime() + step * MS_PER_HOUR);
      arr.push({
        temporal_status: 'FORECAST',
        time_step: step,
        label: formatHHmm(ts),
        timestampDate: ts,
      });
    }
    // Ya están en orden cronológico (HISTORIC 1..6 → FORECAST 1..12) por
    // construcción, no hace falta sort.
    return arr;
  }, [data]);

  const totalSlots = frames.length;
  const maxSlot = totalSlots > 0 ? Math.max(1, totalSlots - 1) : 1;
  const clampedFrameIndex = totalSlots > 0 ? clamp(frameIndex, 0, maxSlot) : 0;

  // ── Eje de tiempo: base = timestamp real del primer frame (no "hoy a
  //    HH:00"). Si HISTORIC cubre horas del día anterior, la base cae en
  //    ese día anterior, lo que hace que la franja roja (hora real Perú)
  //    quede en su slot correcto dentro del eje.
  const base = useMemo<Date>(
    () => frames[0]?.timestampDate ?? peruStartOfDay(),
    [frames],
  );

  // Hora real de Perú, refrescada por `nowTick` (cada 60s) además de en
  // cada render. useMemo con `nowTick` en deps fuerza recálculo cuando
  // el ticker dispara.
  // `nowTick` está en deps deliberadamente: no se usa en el cuerpo (lo que
  // infla el lint) pero fuerza el reproceso cuando el ticker dispara.
  const currentRealHour = useMemo(() => peruNow(), [nowTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Slot correspondiente a la hora real (franja roja). Calculado como
  // diferencia de ms entre `currentRealHour` y `base` divida en horas. Por
  // construcción, `base` y `currentRealHour` están en el mismo frame de
  // referencia (wall-clock Perú interpretado en el runtime del browser),
  // así que la aritmética es coherente sin importar el timezone del cliente.
  const realSlot = useMemo(() => {
    if (totalSlots === 0) return 0;
    const slot = Math.round(
      (currentRealHour.getTime() - base.getTime()) / MS_PER_HOUR,
    );
    return clamp(slot, 0, maxSlot);
  }, [currentRealHour, base, totalSlots, maxSlot]);

  // ── Posicionar el thumb en la hora actual (realSlot) cuando los frames
  //    llegan por primera vez. Una sola vez por carga de ventana; el
  //    usuario puede moverlo libremente después.
  useLayoutEffect(() => {
    if (hasInitializedRef.current) return;
    if (totalSlots === 0) return;
    hasInitializedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFrameIndex(realSlot);
  }, [totalSlots, realSlot]);

  // `slotHours[i]` = hora absoluta (0..23) del frame i. Derivada de los
  // `timestampDate` reales del backend, así soporta cruces de medianoche.
  const slotHours = useMemo<number[]>(
    () => frames.map((f) => f.timestampDate.getHours()),
    [frames],
  );

  // ── Días agrupados (para etiquetas de fila superior) ─────────────────
  // Un nuevo grupo arranca cuando cambia el día natural (vía getDay() +
  // getDate() encapsulados en `dayLabelFor`). Cada grupo cubre horas NO
  // cruzando medianoche: al cruzar, se abre un nuevo grupo con hora 0.
  const days = useMemo<TimelineDay[]>(() => {
    if (totalSlots === 0) return [];
    const groups: TimelineDay[] = [];
    for (let i = 0; i < totalSlots; i++) {
      const d = frames[i]?.timestampDate ?? addHours(base, i);
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
  }, [frames, totalSlots, base]);

  // Selección desde TimelineBar: llega un slot ya entero (no un Date), así
  // que basta con clampar y setFrameIndex. Cero aritmética de Date aquí.
  const onSelectSlot = useCallback(
    (slot: number) => {
      if (totalSlots === 0) return;
      setFrameIndex(clamp(slot, 0, maxSlot));
    },
    [totalSlots, maxSlot],
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
    refetch: refetchGfs,
    frames,
    frameIndex: clampedFrameIndex,
    setFrameIndex,
    activeFrame: frames[clampedFrameIndex],
    latestCompletedAt: data?.metadata?.latest_completed_at_local ?? null,
    timelineProps: {
      days,
      slotHours,
      selectedSlot: clampedFrameIndex,
      realSlot,
      onSelectSlot,
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