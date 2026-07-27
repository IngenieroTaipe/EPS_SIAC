import { useEffect, type RefObject } from 'react';

/**
 * Hook que ejecuta `handler` cuando se hace clic o se toca fuera del
 * elemento referenciado por `ref`.
 *
 * Uso típico para cerrar dropdowns/menús al hacer clic fuera:
 *
 *   const ref = useRef<HTMLDivElement>(null);
 *   const [open, setOpen] = useState(false);
 *   useClickOutside(ref, () => setOpen(false));
 *
 * El handler se ejecuta en `mousedown` (y `touchstart`) para que el cierre
 * sea inmediato, sin esperar al `mouseup`. Esto evita parpadeos.
 *
 * Comportamiento:
 *   - Se suscribe al `document` solo cuando `enabled` es true (por defecto).
 *   - Si el clic cae DENTRO del elemento o sus descendientes, no se dispara.
 *   - Si `ref.current` aún no está montado, no hace nada.
 *
 * @param ref     Referencia al contenedor a vigilar.
 * @param handler Función a ejecutar al clic fuera.
 * @param enabled Cuando false, no se suscribe. Default `true`.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  enabled: boolean = true,
): void {
  useEffect(() => {
    if (!enabled) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const el = ref.current;
      if (!el) return;
      // Si el clic fue dentro del contenedor, ignorar.
      if (el.contains(event.target as Node)) return;
      handler();
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [ref, handler, enabled]);
}