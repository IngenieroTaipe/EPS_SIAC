import { useState } from 'react';
import { navConfig, logoutConfig } from './SidebarConfig';
import { SidebarNavItem, SidebarToggle } from './SidebarNavItem';
import { cn } from '@/shared/lib/cn';
import logoUrl from '@/assets/images/logo.png';

/**
 * Sidebar de la aplicación EPS SIAC.
 *
 * Características (según diseño Figma):
 *  - Dos estados: extendido (icono + texto) y colapsado (solo iconos).
 *  - Grupos de navegación ("Mapas", "Monitoreo") con etiqueta placeholder.
 *  - Items con estado Normal / Hover / Selected (ver SidebarNavItem).
 *  - Sub-items expandibles al activar el ítem (sin posición absoluta).
 *  - Botón de cierre de sesión al fondo, con hover rojo (secondary).
 *  - Botón circular (primary-light) en el borde derecho para alternar estado.
 *
 * El `aside` NO usa overflow-hidden (cortaría el toggle circular);
 * en su lugar el cuerpo interior es `overflow-y-auto` para que los subitems
 * empujen el flujo sin saltar del contenedor.
 */
export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [logoutHover, setLogoutHover] = useState(false);
  const LogoutIcon = logoutConfig.icon;

  return (
    <aside
      className={cn(
        'relative h-screen sticky top-0 bg-background-main rounded-section shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]',
        'flex flex-col items-center gap-6 px-2.5 py-10',
        'transition-[width] duration-200 shrink-0',
        collapsed ? 'w-20' : 'w-72',
      )}
      aria-label="Navegación principal"
    >
      {/* ── Header: logo + título ─────────────────────────────────── */}
      <div
        className={cn(
          'w-full inline-flex justify-center items-center gap-2.5',
          collapsed && 'justify-center',
        )}
      >
        <img
          src={logoUrl}
          alt="Logo EPS Selva Central"
          className="w-9 h-14 object-contain"
        />
        {!collapsed && (
          <div className="py-0.5 flex justify-center items-center gap-2.5">
            <span className="text-center text-text-primary text-2xl font-bold font-sans leading-6 whitespace-nowrap">
              EPS Selva Central
            </span>
          </div>
        )}
      </div>

      {/* ── Separador entre header (logo) y cuerpo de navegación ──── */}
      <div className="self-stretch h-px bg-text-secondary shadow-[2px_3px_3px_0px_rgba(0,0,0,0.80)]" />

      {/* ── Cuerpo scrollable de navegación ──────────────────────── */}
      <div className="self-stretch flex-1 py-2.5 flex flex-col justify-start items-start gap-2 overflow-y-auto overflow-x-visible">
        {navConfig.map((group, index) => (
          <div
            key={group.label}
            className="self-stretch flex flex-col justify-start items-start gap-2"
          >
            {/* Separador superior de grupo (excepto el primero) */}
            {index > 0 && (
              <div className="self-stretch h-px bg-text-secondary shadow-[2px_3px_3px_0px_rgba(0,0,0,0.80)]" />
            )}

            {/* Etiqueta del grupo */}
            <div className={cn(
              "self-stretch rounded-md inline-flex justify-start items-center gap-2.5",
              index > 0 && 'mt-5',
            )}>
              <span
                className={cn(
                  'text-text-secondary font-normal font-sans leading-6',
                  collapsed ? 'text-[11px] w-full text-left' : 'text-base',
                )}
              >
                {group.label}
              </span>
            </div>

            {/* Items del grupo */}
            {group.items.map((item) => (
              <SidebarNavItem
                key={item.to}
                item={item}
                collapsed={collapsed}
              />
            ))}
          </div>
        ))}
      </div>

      {/* ── Cierre de sesión (al fondo) ────────────────────────────── */}
      <div className="self-stretch flex flex-col justify-end items-center gap-2.5">
        <button
          type="button"
          onMouseEnter={() => setLogoutHover(true)}
          onMouseLeave={() => setLogoutHover(false)}
          className={cn(
            'w-full p-2.5 rounded-md outline outline-1 outline-offset-[-1px] transition-colors',
            'inline-flex justify-start items-center gap-2.5',
            logoutHover
              ? 'bg-secondary-background outline-secondary-main text-text-invert-primary'
              : 'bg-background-main outline-button-stroke text-text-primary',
          )}
          title={collapsed ? logoutConfig.label : undefined}
        >
          <LogoutIcon
            className="size-6 shrink-0"
            strokeWidth={2}
            aria-hidden="true"
          />
          {!collapsed && (
            <span className="text-base font-normal font-sans leading-6">
              {logoutConfig.label}
            </span>
          )}
        </button>
      </div>

      {/* ── Toggle flotante ────────────────────────────────────────── */}
      <SidebarToggle
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
      />
    </aside>
  );
}