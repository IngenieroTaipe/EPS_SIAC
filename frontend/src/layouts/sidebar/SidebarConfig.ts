/**
 * Definición de tipos para la navegación del sidebar.
 * Cada ítem puede tener sub-items (mostrados al expandir el ítem activo),
 * indicando vista geoespacial y gestión en Figma.
 *
 * Los iconos se cargan como componentes React desde `src/assets/icons/*.svg` vía
 * `vite-plugin-svgr` (sufijo `?react`). Los SVG usan `currentColor` para que
 * hereden el color del estado (Normal / Hover / Selected) automáticamente.
 */

import type { ComponentType, SVGProps } from 'react';

// Componente tipo icono: SVG de Figma cargado como React component.
export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export interface NavSubItem {
  /** Ruta destino (react-router `to`). */
  to: string;
  /** Etiqueta visible en estado extendido. */
  label: string;
}

export interface NavItem {
  /** Ruta destino del ítem principal. */
  to: string;
  /** Etiqueta visible en estado extendido. */
  label: string;
  /** Icono del ítem (SVG importado como componente React). */
  icon: IconComponent;
  /** Sub-items opcionales (se muestran al activar el ítem). */
  subitems?: NavSubItem[];
}

export interface NavGroup {
  /** Etiqueta del grupo (e.g. "Mapas", "Monitoreo"). Estado placeholder. */
  label: string;
  /** Items del grupo. */
  items: NavItem[];
}

// ── Iconos de Figma (SVG → componente React) ─────────────────────────────
import CerrarSesionIcon from '@/assets/icons/cerrar-sesion.svg?react';
import FlechaLadoIcon from '@/assets/icons/flecha-lado.svg?react';
import MapaIcon from '@/assets/icons/mapa.svg?react';

/**
 * Configuración por defecto del sidebar.
 * Ajustable al recibir las interfaces completas del usuario.
 * Rutas provisionales — se alinearán con `AppRouter` cuando se maquete.
 *
 * Mapeo icono → pantalla:
 *   - mapa.svg        → Mapa de Alertas Climáticas (vista general de alertas)
 *   - alert.svg       → Mapa de Alertas (detección/confirmación) [placeholder]
 *
 * Nota: si más adelante necesitas distinguir tipos de componente
 * (captación, reservorio, planta de tratamiento), los iconos ya están
 * disponibles en src/assets/icons/.
 */
export const navConfig: NavGroup[] = [
  {
    label: 'Mapas',
    items: [
      {
        to: '/alertas',
        label: 'Mapa de Alertas Climáticas',
        icon: MapaIcon,
        subitems: [
          { to: '/alertas', label: 'Vista Geoespacial' },
          { to: '/alertas/gestion', label: 'Gestionar Alertas' },
        ],
      },
      {
        to: '/componentes',
        label: 'Mapa de Componentes',
        icon: MapaIcon,
        subitems: [
          { to: '/componentes', label: 'Vista Geoespacial' },
          { to: '/componentes/gestion', label: 'Gestionar Componentes' },
        ],
      },
    ],
  },
  {
    label: 'Monitoreo',
    items: [
      {
        to: '/climatico',
        label: 'Mapa Climático',
        icon: MapaIcon,
        subitems: [
          { to: '/climatico', label: 'Vista Geoespacial' },
          { to: '/umbrales/gestion', label: 'Gestionar Umbrales' },
        ],
      },
    ],
  },
];

/** Configuración del botón de cierre de sesión. */
export const logoutConfig: { label: string; icon: IconComponent } = {
  label: 'Cerrar Sesión',
  icon: CerrarSesionIcon,
};

/** Icono para el toggle (flecha-lado → expandir/colapsar). */
export const toggleIcon: IconComponent = FlechaLadoIcon;