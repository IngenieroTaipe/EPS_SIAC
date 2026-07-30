/**
 * requestCache — caché de promesas a nivel módulo (singleton) para SPAs que no
 * usan React Query / SWR.
 *
 * Objetivo: navegar entre páginas sin refetch repetido. La primera llamada a
 * `cachedGet(key, fetcher)` dispara la petición; las siguientes (mientras
 * viva el TTL) devuelven el valor cacheado. Si hay una petición en vuelo,
 * se reutiliza la misma promesa (dedupe).
 *
 * No substituye a una librería de data-fetching, pero resuelve el 90% del
 * caso de uso de "datos de catálogo / read-only que cambian poco" sin
 * añadir dependencias.
 *
 * Mejor práctica real para proyectos grandes: TanStack Query con
 * `staleTime`/`gcTime` configurados. Esto es el puente ligero equivalente.
 */

interface CacheEntry<T> {
  promise: Promise<T>;
  value?: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/**
 * Devuelve el valor cacheado si está fresco; si está caducado o ausente,
 * dispara `fetcher` (deduplicando llamadas en vuelo) y cachea el resultado
 * durante `ttlMs` ms.
 *
 * Pasar `ttlMs = 0` desactiva la caché (siempre refresca).
 */
export function cachedGet<T>(key: string, fetcher: () => Promise<T>, ttlMs: number): Promise<T> {
  const now = Date.now();
  const existing = store.get(key) as CacheEntry<T> | undefined;

  // Fresco: devolver promesa ya resuelta (o la en-vuelo).
  if (existing && existing.expiresAt > now) {
    return existing.promise;
  }

  // Caducado o ausente: lanzar nueva petición y cachear la promesa.
  const promise = fetcher()
    .then((value) => {
      const entry = store.get(key) as CacheEntry<T> | undefined;
      if (entry) entry.value = value;
      return value;
    })
    .catch((err) => {
      // En error, limpiar la entrada para que el próximo intento reintente.
      store.delete(key);
      throw err;
    });

  store.set(key, { promise, expiresAt: now + ttlMs });
  return promise;
}

/** Invalida una clave (p. ej. tras un POST/PATCH/DELETE). */
export function invalidateCache(key: string): void {
  store.delete(key);
}

/** Invalida todas las claves que empiezan por el prefijo. */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}