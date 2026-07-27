import { NavLink, useLocation } from 'react-router-dom';
import type { NavItem as NavItemType } from './SidebarConfig';
import { toggleIcon } from './SidebarConfig';
import { cn } from '@/shared/lib/cn';

interface SidebarNavItemProps {
  item: NavItemType;
  /** Si el sidebar está colapsado (solo iconos). */
  collapsed: boolean;
}

/**
 * Peso de fuente del item SELECCIONADO.
 * Para probar entre semibold / bold, edita este valor:
 *   'font-semibold' (600)  — recomendado, equilibrio sutil.
 *   'font-bold'      (700)  — más fuerte, mayor contraste.
 */
const SELECTED_FONT_WEIGHT = 'font-semibold';

const ITEM_BASE =
  'self-stretch p-2.5 rounded-md flex items-center gap-2.5 transition-colors duration-150';

/**
 * Item de navegación del sidebar con tres estados según Figma:
 *
 *  - Normal:   bg-transparent (hereda sidebar blanco), texto text-primary, font-normal.
 *  - Hover:    bg primary-main al 40% (modificador Tailwind /40) + sombra suave,
 *              texto sigue text-primary.
 *  - Selected: bg primary-main sólido + texto text-invert-primary + semibold + sombra.
 *
 * El parent permanece activo cuando hay un subitem seleccionado (sin `end`),
 * para mostrar siempre los subitems debajo con divisoria vertical.
 * Para los subitems se usa `end` en el índice ("Vista Geoespacial") para que
 * solo uno quede seleccionado a la vez (comportamiento tipo radio).
 */
export function SidebarNavItem({ item, collapsed }: SidebarNavItemProps) {
  const Icon = item.icon;
  const location = useLocation();
  // El parent está activo si la ruta actual empieza con su `to`.
  const parentActive =
    location.pathname === item.to ||
    location.pathname.startsWith(item.to + '/');

  return (
    <div className="self-stretch flex flex-col items-start">
      <NavLink
        to={item.to}
        title={collapsed ? item.label : undefined}
        className={({ isActive }) =>
          cn(
            ITEM_BASE,
            isActive
              ? cn(
                  'bg-primary-main text-text-invert-primary',
                  SELECTED_FONT_WEIGHT,
                  'shadow-[0px_2px_4px_0px_rgba(0,0,0,0.25)]',
                )
              : 'bg-transparent text-text-primary font-normal hover:bg-primary-main/40 hover:shadow-[0px_2px_4px_0px_rgba(0,0,0,0.25)]',
          )
        }
      >
        <Icon className="size-6 shrink-0" strokeWidth={2} aria-hidden="true" />
        {!collapsed && (
          <span className="text-base font-sans leading-6 truncate">
            {item.label}
          </span>
        )}
      </NavLink>

      {/* Sub-items: solo cuando el parent está activo y hay subitems. */}
      {/* Se renderizan en flujo natural (sin posición absoluta) para no cortar. */}
      {!collapsed && parentActive && item.subitems && (
        <div className="self-stretch pl-2.5 pt-2 flex justify-start gap-2.5">
          {/* Línea divisoria vertical (text-secondary) */}
          <div className="w-px bg-text-secondary" aria-hidden="true" />
          <div className="flex flex-col gap-[5px]">
            {item.subitems.map((sub) => (
              <NavLink
                key={sub.to}
                to={sub.to}
                // `end` para que el subitem índice solo coincida con su ruta exacta.
                end={sub.to === item.to}
                className={({ isActive }) =>
                  cn(
                    'w-48 px-2.5 py-[5px] rounded-md transition-colors duration-150',
                    'text-base font-normal font-sans leading-6',
                    isActive
                      ? cn(
                          'bg-primary-main text-text-invert-primary',
                          SELECTED_FONT_WEIGHT,
                          'shadow-[0px_2px_4px_0px_rgba(0,0,0,0.25)]',
                        )
                      : 'bg-white text-text-primary hover:bg-primary-main/40 hover:shadow-[0px_2px_4px_0px_rgba(0,0,0,0.25)]',
                  )
                }
              >
                {sub.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Botón circular para alternar sidebar extendido/colapsado.
 * Posicionado en el borde derecho del sidebar; sale hacia la derecha
 * (translate-x-1/2) y se eleva con z-50 para no ser tapado por el contenido.
 */
export function SidebarToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const FlechaIcon = toggleIcon;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
      className={cn(
        'size-10 absolute top-20 z-50 bg-primary-light rounded-full',
        'flex items-center justify-center',
        'right-0 translate-x-1/2',
        'hover:bg-primary-main/40',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2',
      )}
    >
      {/* flecha-lado apunta hacia la izquierda (colapsar) por defecto.
          Al estar colapsado, se rota 180° para que apunte a la derecha (expandir). */}
      <FlechaIcon
        className={cn(
          'size-5 text-text-invert-primary transition-transform duration-200',
          collapsed && 'rotate-180',
        )}
        aria-hidden="true"
      />
    </button>
  );
}