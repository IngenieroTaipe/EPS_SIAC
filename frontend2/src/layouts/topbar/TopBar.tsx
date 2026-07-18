import { useLocation } from 'react-router-dom';
import {
  topBarConfig,
  fallbackConfig,
  SUBTITLE_TEXT,
  HIDE_UNIDAD_OPERATIVA_ROUTES,
  type TopBarPageConfig,
} from './TopBarConfig';
import { UnidadOperativaSelector } from './TopBarWidgets';
import { renderWidget } from './TopBarWidgets.render';
import { cn } from '@/shared/lib/cn';

/**
 * TopBar (cabecera) de la aplicación EPS SIAC.
 *
 * Es dinámica: cambia según la ruta activa usando `topBarConfig` (ver
 * `TopBarConfig.ts`). Cada página define su título y los widgets derechos que
 * debe mostrar.
 *
 * Estructura visual (todos los headers comparten):
 *
 * ┌─ bg-primary-main h-24 ─────────────────────────────────────────────┐
 * │ │ ┃  Título grande (text-3xl bold blanco)                         │
 * │ │ ┃  Subtítulo "EPS Selva Central" (text-base, weight varía)      │
 * │ │                       [widgets derecha]    [Unidad Operativa]   │
 * └───────────────────────────────────────────────────────────────────┘
 *
 * El selector "Unidad Operativa" es PERSISTENTE excepto en login
 * (donde en su lugar se muestra el botón "Iniciar Sesión").
 *
 * Para añadir/editar el contenido por página, modifica `TopBarConfig.ts`;
 * aquí solo se renderiza el layout. Si una página no está en el array,
 * se usa `fallbackConfig`.
 */
export function TopBar() {
  const location = useLocation();

  // Matching longest-prefix: la primera entrada en `topBarConfig` (en orden
  // de precedencia) cuya ruta sea igual a la actual O la ruta actual empiece
  // por ella + '/' (para soportar rutas dinámicas tipo `/alertas/PK-001/editar`
  // macheando contra `/alertas/editar`).
  // Para rutas más específicas, ponlas antes en el array `topBarConfig`.
  function matches(pathname: string, route: string): boolean {
    if (route === pathname) return true;
    // Sustituir `:param` por un wildcard de comparación.
    // Ruta configurada con `:id` → comparar por estructura de segmentos.
    if (route.includes(':')) {
      const rSeg = route.split('/');
      const pSeg = pathname.split('/');
      if (rSeg.length !== pSeg.length) return false;
      return rSeg.every((s, i) => s === pSeg[i] || s.startsWith(':'));
    }
    // Caso general: ruta configurada es un prefijo del pathname.
    return pathname === route || pathname.startsWith(route + '/');
  }

  // Encontrar el match más específico (más largo primero).
  const cfg: TopBarPageConfig =
    topBarConfig.find((c) => matches(location.pathname, c.route)) ?? fallbackConfig;

  const isLogin = cfg.route === '/login';
  const subtitleWeight = cfg.subtitleWeight ?? 'normal';
  // En rutas de gestión (backoffice) no se muestra "Unidad Operativa".
  // Comparación por prefijo para cubrir también `/alertas/PK-001/editar`
  // que se trata como gestión.
  const hideUnidadOperativa = HIDE_UNIDAD_OPERATIVA_ROUTES.some(
    (r) => location.pathname === r || location.pathname.startsWith(r + '/'),
  );

  return (
    <header
      className={cn(
        'self-stretch bg-primary-main',
        'outline outline-1 outline-offset-[-1px] outline-white',
        'h-20 flex items-center',
      )}
      role="banner"
    >
      {/* ── Línea vertical decorativa antes del título ─────────────── */}
      <div
        className="w-px h-12 mx-4 bg-text-invert-primary"
        aria-hidden="true"
      />

      {/* ── Bloque izquierdo: título + subtítulo ───────────────────── */}
      <div className="pl-1 pr-8 py-[2px] flex flex-col justify-center items-start gap-[2px] overflow-hidden">
        <h1 className="text-text-invert-primary text-xl font-bold font-sans leading-6 whitespace-nowrap">
          {cfg.title}
        </h1>
        <p
          className={cn(
            'text-text-invert-primary text-sm font-sans',
            subtitleWeight === 'semibold' ? 'font-semibold' : 'font-normal',
          )}
        >
          {SUBTITLE_TEXT}
        </p>
      </div>

      {/* ── Bloque derecho: widgets + Unidad Operativa ─────────────── */}
      <div className="ml-auto flex justify-end items-center gap-5 px-2">
        {cfg.widgets?.map((widget) => renderWidget(widget))}
        {!isLogin && !hideUnidadOperativa && <UnidadOperativaSelector />}
      </div>
    </header>
  );
}