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

  const cfg: TopBarPageConfig =
    topBarConfig.find((c) => c.route === location.pathname) ?? fallbackConfig;

  const isLogin = cfg.route === '/login';
  const subtitleWeight = cfg.subtitleWeight ?? 'normal';
  // En rutas de gestión (backoffice) no se muestra "Unidad Operativa".
  const hideUnidadOperativa = HIDE_UNIDAD_OPERATIVA_ROUTES.includes(
    location.pathname,
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