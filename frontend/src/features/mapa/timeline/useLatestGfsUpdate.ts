import { useEffect, useMemo, useState } from 'react';
import { parsePetTimestamp } from './peruTime';

/**
 * Formato relativo en español para "hace X tiempo".
 * - < 1 min   → "hace menos de 1 min"
 * - < 60 min  → "hace N min"
 * - < 24 h    → "hace N h"
 * - >= 24 h   → "hace más de 1 día" (no debería darse en operación normal)
 *
 * No usa `Intl.RelativeTimeFormat` para mantener el formato compacto del TopBar
 * ("Actualizado hace 5 min") controlado por tokens, no por locale del browser.
 */
function formatElapsed(elapsedMs: number): string {
  const sec = Math.floor(elapsedMs / 1000);
  if (sec < 60) return 'hace menos de 1 min';
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return 'hace más de 1 día';
}

export interface LatestGfsUpdate {
  /** Timestamp ISO crudo del backend (`metadata.latest_completed_at_local`). */
  timestamp: string | null;
  /** Texto relativo en español: "hace 5 min", "hace 2 h", etc. */
  label: string;
  /** true si no hay corridas completadas en el backend (cold-start). */
  isEmpty: boolean;
}

/**
 * Hook que consume el timestamp del último request GFS COMPLETED desde el
 * metadata del GeoJSON y calcula el texto relativo "Actualizado hace X min".
 *
 * No hace fetch propio: lee `timestamp` (provisto por el caller desde el
 * contexto de la timeline o de un fetch ligero) y un ticker interno cada 60 s
 * dispara el recálculo del "hace X" sin re-fetchear el GeoJSON.
 *
 * Uso típico desde el TopBar:
 *   const { label } = useLatestGfsUpdate(metadata?.latest_completed_at_local);
 */
export function useLatestGfsUpdate(
  timestampIso: string | null | undefined,
): LatestGfsUpdate {
  const [, setTick] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Refresca el "ahora" cada 60 s para que el texto "hace X min" avance sin
  // necesidad de re-fetch. Patrón idéntico al `nowTick` de
  // `PrecipitationTimelineProvider` para mantener consistencia visual con la
  // franja roja del timeline.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Forzar re-render inmediato al montar (caso: arrivea data fresca y el
  // componente se monta después del primer fetch del provider).
  useEffect(() => {
    setTick((t) => t + 1);
  }, [timestampIso]);

  const { label, isEmpty, timestamp } = useMemo<LatestGfsUpdate>(() => {
    if (!timestampIso) {
      return {
        timestamp: null,
        label: 'Sin datos todavía',
        isEmpty: true,
      };
    }
    const ts = parsePetTimestamp(timestampIso);
    if (!ts) {
      return {
        timestamp: timestampIso,
        label: 'Sin datos todavía',
        isEmpty: true,
      };
    }
    const elapsedMs = Math.max(0, now - ts.getTime());
    return {
      timestamp: timestampIso,
      label: formatElapsed(elapsedMs),
      isEmpty: false,
    };
  }, [timestampIso, now]);

  return { timestamp, label, isEmpty };
}