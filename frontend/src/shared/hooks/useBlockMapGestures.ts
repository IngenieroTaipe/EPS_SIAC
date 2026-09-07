import { useCallback, useEffect, useRef } from 'react';

/**
 * useBlockMapGestures — frena los gestos del mapa Leaflet cuando el cursor
 * está sobre un overlay DOM montado DENTRO del `<MapContainer>`.
 *
 * Contexto: tras el refactor del `MapLayout`, el `<Outlet />` (y con él los
 * sheets de detalle de alertas/componentes) vive DENTRO del contenedor del
 * mapa. Leaflet escucha `wheel`/`pointerdown`/`touch` en su contenedor, así
 * que el scroll sobre el overlay hacía ZOOM al mapa, el arrastre lo PANEABA
 * y los clics de sus botones se perdían ("como si fuera de fondo").
 *
 * Solución: listeners nativos con `stopPropagation()` en el elemento del
 * overlay. Al cortar la burbuja ANTES de llegar al contenedor del mapa,
 * Leaflet nunca ve el gesto. El scroll interno del overlay (overflow) y los
 * clics de sus botones siguen funcionando (no se toca el comportamiento
 * default, sólo la propagación).
 *
 * API: devuelve un **callback ref** (no RefObject) para soportar overlays
 * que se montan condicionalmente — el callback se invoca en cada
 * mount/unmount del elemento, que es cuando hay que añadir/quitar los
 * listeners.
 *
 * Uso:
 *   const blockGestures = useBlockMapGestures();
 *   <aside ref={blockGestures}>…</aside>
 */

/** Gestos de Leaflet que NO deben atravesar el overlay. */
const BLOCKED_EVENTS = [
  'wheel',      // zoom por scroll del mouse.
  'mousedown',  // inicio del pan (drag) con mouse + "swallow" de clics.
  'pointerdown',// inicio del pan (drag) pointer events (touch/pen/mouse).
  'touchstart', // inicio del drag táctil.
  'touchmove',  // pan táctil en curso.
  'dblclick',   // zoom por doble clic.
  'contextmenu',// menú contextual del mapa (long-press táctil).
] as const;

export function useBlockMapGestures(): (el: HTMLElement | null) => void {
  const cleanupRef = useRef<(() => void) | null>(null);

  const setEl = useCallback((el: HTMLElement | null) => {
    // Si había un elemento previo (unmount o re-mount), limpia primero.
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!el) return;

    const stop = (e: Event) => e.stopPropagation();
    for (const ev of BLOCKED_EVENTS) {
      el.addEventListener(ev, stop);
    }
    cleanupRef.current = () => {
      for (const ev of BLOCKED_EVENTS) {
        el.removeEventListener(ev, stop);
      }
    };
  }, []);

  // Cleanup final al desmontar el componente dueño del hook.
  useEffect(() => () => cleanupRef.current?.(), []);

  return setEl;
}
