/**
 * requestCache — caché de promesas a nivel módulo (in-memory) + persistencia
 * en localStorage con TTL, para SPAs que no usan React Query / SWR.
 *
 * Objetivo: navegar entre páginas sin refetch repetido Y sobrevivir a recargas
 * del navegador. La memoria guarda la promesa en vuelo (dedupe de llamadas
 * simultáneas); localStorage guarda el valor resolved serializable con su
 * TTL, para que la próxima sesión se hidrate sin red.
 *
 * Mejor práctica real para proyectos grandes: TanStack Query con
 * `staleTime`/`gcTime` + `persistQueryClient`. Esto es el puente ligero
 * equivalente (sin dependencias).
 *
 * Nota: los valores deben ser serializables a JSON (GeoJSON FeatureCollection
 * y arrays de umbrales lo son).
 */

interface Persisted<T> {
  value: T;
  expiresAt: number;
}

const STORAGE_PREFIX = 'eps_cache:';
const memStore = new Map<string, Promise<unknown>>();

function lsKey(key: string) {
  return STORAGE_PREFIX + key;
}

function readPersisted<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(lsKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted<T>;
    if (typeof parsed.expiresAt !== 'number') return null;
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(lsKey(key));
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

function writePersisted<T>(key: string, value: T, ttlMs: number) {
  try {
    const entry: Persisted<T> = { value, expiresAt: Date.now() + ttlMs };
    localStorage.setItem(lsKey(key), JSON.stringify(entry));
  } catch {
    // localStorage lleno o no disponible: ignorar (la caché en memoria sigue
    // funcionando para esta sesión).
  }
}

function removePersisted(key: string) {
  try {
    localStorage.removeItem(lsKey(key));
  } catch {
    /* noop */
  }
}

/**
 * Devuelve el valor cacheado si está fresco (memoria o localStorage); si está
 * caducado o ausente, dispara `fetcher` (deduplicando llamadas en vuelo) y
 * cachea el resultado en memoria + localStorage durante `ttlMs` ms.
 *
 * Pasar `ttlMs = 0` desactiva la caché (siempre refresca).
 */
export function cachedGet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
): Promise<T> {
  // 1. Si hay una promesa en vuelo, reutilizarla (dedupe).
  const inflight = memStore.get(key) as Promise<T> | undefined;
  if (inflight) return inflight;

  // 2. Si hay valor fresco en localStorage, resolver inmediatamente.
  const persisted = readPersisted<T>(key);
  if (persisted !== null) {
    const resolved = Promise.resolve(persisted);
    // Refrescar la entrada de memoria con el valor resuelto (para que la
    // próxima llamada sí reutilice la promesa en memoria).
    memStore.set(key, resolved);
    return resolved;
  }

  // 3. Cache miss: lanzar nueva petición y cachear la promesa + el valor.
  const promise = fetcher()
    .then((value) => {
      writePersisted(key, value, ttlMs);
      // Quitar la promesa del memStore: la próxima llamada leerá de
      // localStorage (inmediato) en lugar de mantener la promesa resuelta.
      memStore.delete(key);
      return value;
    })
    .catch((err) => {
      memStore.delete(key);
      throw err;
    });

  memStore.set(key, promise);
  return promise;
}

/** Invalida una clave en memoria y localStorage (p. ej. tras un POST/DELETE). */
export function invalidateCache(key: string): void {
  memStore.delete(key);
  removePersisted(key);
}

/** Invalida todas las claves que empiezan por el prefijo (mem + localStorage). */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of Array.from(memStore.keys())) {
    if (key.startsWith(prefix)) memStore.delete(key);
  }
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const fullKey = localStorage.key(i);
      if (fullKey && fullKey.startsWith(STORAGE_PREFIX + prefix)) {
        localStorage.removeItem(fullKey);
      }
    }
  } catch {
    /* noop */
  }
}