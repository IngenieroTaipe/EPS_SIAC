import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * useInfiniteRows — render progresivo tipo "infinite scroll" (Facebook) para
 * tablas grandes.
 *
 * El dataset completo llega de una vez (los fetches no cambian), pero sólo
 * se RENDERIZAN las primeras `pageSize` filas. Al hacer scroll dentro del
 * contenedor y acercarse al final (sentinela visible), se renderizan
 * `pageSize` filas más, y así sucesivamente. Así el DOM inicial es mínimo
 * (50 filas vs 1000) y la tabla abre instantánea sin importar el tamaño
 * del dataset.
 *
 * El "load more" es instantáneo (sólo re-render, sin red), por eso no hay
 * spinner: el usuario simplemente ve más filas al bajar.
 *
 * Reset automático: cuando cambia el array `rows` (p. ej. al filtrar o
 * refetch), el conteo visible vuelve a `pageSize` (o a `minCount` si se
 * pasó — útil para preselects vía URL: garantiza que una fila
 * pre-seleccionada lejana quede dentro del lote visible).
 *
 * Uso:
 *   const { visibleRows, hasMore, sentinelRef, showing } = useInfiniteRows(filas);
 *   // <Table rows={visibleRows} />
 *   // {hasMore && <div ref={sentinelRef} />}
 */

/** Filas renderizadas por tanda. 50 llena ~2-3 pantallas de tabla. */
const DEFAULT_PAGE_SIZE = 50;

/** Px antes del fondo del scroll en que se precarga la siguiente tanda. */
const LOAD_MORE_ROOT_MARGIN = '300px';

export interface UseInfiniteRowsResult<T> {
  /** Sub-array a renderizar (slice 0..visibleCount). */
  visibleRows: T[];
  /** True si quedan filas sin renderizar. */
  hasMore: boolean;
  /** Ref para el div centinela que dispara el load-more al ser visible. */
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  /** Cuántas filas se están mostrando (para el indicador "N de M"). */
  showing: number;
}

export function useInfiniteRows<T>(
  rows: T[],
  pageSize: number = DEFAULT_PAGE_SIZE,
  /**
   * Conteo visible mínimo garantizado (p. ej. índice de una fila
   * pre-seleccionada vía URL + 1). Consume memoria trivial y sólo
   * afecta el lote inicial / tras reset de dataset.
   */
  minCount?: number,
): UseInfiniteRowsResult<T> {
  const [visibleCount, setVisibleCount] = useState(pageSize);

  // Reset al cambiar el dataset (filtro, refetch, orden) o el mínimo
  // garantizado. `rows` viene memoizado de los callers (useMemo), así la
  // identidad sólo cambia cuando de verdad cambió el contenido/deps.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reconciliación
       one-shot del lote visible cuando cambia el dataset (patrón canónico
       usado en el resto del proyecto). */
    setVisibleCount(Math.max(pageSize, minCount ?? 0));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [rows, pageSize, minCount]);

  const visibleRows = useMemo(
    () => rows.slice(0, visibleCount),
    [rows, visibleCount],
  );
  const hasMore = visibleCount < rows.length;

  // Centinela: IntersectionObserver dispara el render de la siguiente
  // tanda cuando el sentinel entra en el área visible (con margen de
  // precarga). El sentinel está dentro del contenedor scrollable de la
  // página; IO con root=null detecta el clipping por overflow, así que
  // sólo dispara cuando el scroll lo revela.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => c + pageSize);
        }
      },
      { rootMargin: LOAD_MORE_ROOT_MARGIN },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, pageSize]);

  return {
    visibleRows,
    hasMore,
    sentinelRef,
    showing: visibleRows.length,
  };
}
