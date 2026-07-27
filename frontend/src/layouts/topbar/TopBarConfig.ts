import type { ComponentType, SVGProps } from 'react';

/**
 * Configuración del TopBar por ruta.
 *
 * El TopBar es dinámico: cambia su título y sus widgets derechos según la
 * página activa. Esta configuración describe qué debe mostrarse en cada ruta.
 *
 * Tipos de widgets disponibles (definidos en `TopBarWidgets.tsx`):
 *   - updatedAt       : "Actualizado hace X min" con icono de reloj.
 *   - alertBadge      : Badge rojo "N Confirmadas".
 *   - stats           : Bloque "N Componentes / M en Estado Crítico".
 *   - loadDataButton  : Botón "Cargar Datos" (primary-dark).
 *   - loginButton     : Botón "Iniciar Sesión" (login layout).
 *
 * El selector "Unidad Operativa" es PERSISTENTE en todas las páginas excepto
 * login, por eso no va en este array — lo gestiona `TopBar.tsx` directamente.
 */

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export type TopBarWidget =
  | { kind: 'updatedAt'; text?: string }
  | { kind: 'alertBadge'; text: string }
  | { kind: 'stats'; components: string; critical: string }
  | { kind: 'loadDataButton' }
  | { kind: 'loginButton' };

export interface TopBarPageConfig {
  /** Ruta a la que aplica ( comparación exacta con `location.pathname`). */
  route: string;
  /** Título principal de la página (text-3xl bold, blanco). */
  title: string;
  /** Peso del subtítulo "EPS Selva Central".
   *  - 'normal'    (default) — páginas internas.
   *  - 'semibold'             — header login. */
  subtitleWeight?: 'normal' | 'semibold';
  /** Widgets derechos en el orden en que deben aparecer. */
  widgets?: TopBarWidget[];
}

/** Texto del widget "Actualizado". Se renderiza en 2 líneas:
 *   línea 1: UPDATED_LABEL_PREFIX  ("Actualizado hace")
 *   línea 2: UPDATED_VALUE         ("30 min", "1 hora", etc.)
 *
 * Para cambiar el valor dinámicamente (cada 5 min) actualiza `UPDATED_VALUE`
 * o pasa `text` al widget `updatedAt` desde la config de la página.
 */
export const UPDATED_LABEL_PREFIX = 'Actualizado hace';
export const UPDATED_VALUE = '30 min';

/** Texto del subtítulo siempre visible. */
export const SUBTITLE_TEXT = 'EPS Selva Central';

/** Etiqueta del selector persistente. */
export const UNIDAD_OPERATIVA_LABEL = 'Unidad Operativa';

/**
 * Opciones del dropdown "Unidad Operativa".
 * Editables aquí: añade/quita/renombra una opción sin tocar el componente.
 */
export const UNIDAD_OPERATIVA_OPTIONS: string[] = [
  'Todas',
  'La Merced',
  'San Ramón',
  'Oxapampa',
  'Satipo',
  'Pichanaqui',
];

/**
 * Opciones del dropdown "Cargar Datos" (modo de carga).
 * Añade aquí nuevos formatos si hace falta.
 */
export const CARGAR_DATOS_OPTIONS: string[] = [
  'Manual',
  'Excel',
  'Csv',
];

/**
 * Configuración por ruta. El `TopBar` consultará este array usando
 * `location.pathname` (match exacto). Si no hay match, usa fallback.
 *
 * Para añadir una nueva página, copia un bloque y ajusta `route`, `title`
 * y `widgets`. No hace falta tocar `TopBar.tsx`.
 */
export const topBarConfig: TopBarPageConfig[] = [
  // Pestaña principal (pública): home antes de loguearse.
  // El botón "Iniciar Sesión" lleva a /login.
  // Nota: `/login` no usa GuestLayout (no tiene TopBar).
  {
    route: '/',
    title: 'Sistema de Alertas Climáticas',
    subtitleWeight: 'semibold',
    widgets: [{ kind: 'loginButton' }],
  },
  {
    route: '/alertas/gestion',
    title: 'Gestión de Alertas',
    widgets: [{ kind: 'updatedAt' }],
  },
  {
    route: '/alertas',
    title: 'Mapa de Alertas Climáticas',
    widgets: [{ kind: 'updatedAt' }],
  },
  {
    route: '/alertas-confirmed',
    title: 'Mapa de Alertas Climáticas',
    widgets: [
      { kind: 'alertBadge', text: '2 Confirmadas' },
      { kind: 'updatedAt' },
    ],
  },
  {
    route: '/climatico',
    title: 'Monitoreo de Precipitaciones',
    widgets: [{ kind: 'updatedAt' }],
  },
  {
    route: '/componentes/gestion',
    title: 'Gestión de Componentes',
    widgets: [{ kind: 'updatedAt' }, { kind: 'loadDataButton' }],
  },
  {
    route: '/componentes/:id/editar',
    title: 'Editor de Componente',
    subtitleWeight: 'semibold',
  },
  {
    route: '/componentes/nuevo',
    title: 'Nuevo Componente',
    subtitleWeight: 'semibold',
  },
  {
    route: '/componentes',
    title: 'Mapa de Componentes',
    widgets: [
      { kind: 'stats', components: '128 Componentes', critical: '6 en Estado Crítico' },
      { kind: 'updatedAt' },
    ],
  },
];

/** Config por defecto si la ruta no coincide con ninguna en `topBarConfig`. */
export const fallbackConfig: TopBarPageConfig = {
  route: '*',
  title: 'Sistema de Alertas Climáticas',
  subtitleWeight: 'semibold',
  widgets: [],
};

/**
 * Rutas de gestión (backoffice) en las que NO se muestra el selector
 * "Unidad Operativa" (según feedback del usuario: en gestión se trabaja
 * sobre datos concretos, no sobre el ámbito de la unidad).
 *
 * Para añadir/quitar rutas de esta lista, edita el array.
 */
export const HIDE_UNIDAD_OPERATIVA_ROUTES: string[] = [
  '/componentes/gestion',
  '/alertas/gestion',
  '/componentes/nuevo',
];