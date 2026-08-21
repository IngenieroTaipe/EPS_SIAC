import { useEffect, useState } from 'react';

/**
 * useMediaQuery — hook ligero para detectar coincidencias de un media query
 * CSS en tiempo real. Se sincroniza con `matchMedia` y escucha cambios
 * (resize, rotación), reaplicando SSR-safe (devuelve false en server).
 *
 * Caso de uso principal: distinguir móvil (<sm) de tablet/desktop para
 * alternar entre drawer overlay y sidebar sticky sin depender de JS media
 * queries hardcoded en CSS (que no pueden togglear la lógica de React).
 *
 * @example
 *   const isDesktop = useMediaQuery('(min-width: 768px)');
 *   if (!isDesktop) openMobileSidebar();
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange(); // reconcilia tras mount (el SSR-safe inicial pudo ser falso)
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}