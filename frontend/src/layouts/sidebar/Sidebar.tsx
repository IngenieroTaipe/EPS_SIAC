import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { navConfig, logoutConfig } from './SidebarConfig';
import { SidebarNavItem, SidebarToggle } from './SidebarNavItem';
import { UserBadge } from '@/shared/components/UserBadge';
import { cn } from '@/shared/lib/cn';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useAuth } from '@/shared/context/AuthContext.hooks';
import logoUrl from '@/assets/images/logo.png';

/**
 * Sidebar de la aplicación EPS SIAC.
 *
 * Comportamiento responsivo:
 *
 *  - Desktop (>=sm, `isDesktop=true`): sticky `w-72`/`w-20` con toggle
 *    circular. Hereda la maquetación original del Figma (extendido/
 *    colapsado). Pertenece al flex layout del `AppLayout`.
 *
 *  - Móvil (<sm, `isDesktop=false`): drawer overlay siempre extendido
 *    (`w-72`), que se desliza desde la izquierda. Fuera del flujo del
 *    layout (`fixed inset-y-0 left-0`), tapa el contenido con un overlay
 *    oscuro gestionado por el `AppLayout`. El control de cierre es:
 *      1. Botón X en el header del drawer.
 *      2. Tap fuera (overlay) → invoca `onCloseMobile()`.
 *      3. Cambio de ruta → el `AppLayout` cierra automáticamente.
 *
 * Internamente el estado `collapsed` sólo aplica en desktop (programado
 * por el toggle circular `SidebarToggle`). En móvil se ignora siempre
 * se muestra extendido (su lugar es un overlay amplio).
 *
 * El `aside` NO usa overflow-hidden (cortaría el toggle circular); el body
 * interior es `overflow-y-auto` para que los subitems empujen el flujo sin
 * saltar del contenedor.
 */
export interface SidebarProps {
  /** True en >=sm. Controla si el sidebar es sticky (desktop) o drawer (móvil). */
  isDesktop?: boolean;
  /** En móvil, si el drawer está abierto. */
  mobileOpen?: boolean;
  /** En móvil, callback para cerrar el drawer (lo dispara el botón X, el
   *  overlay y la navegación). */
  onCloseMobile?: () => void;
}

export function Sidebar({
  isDesktop = true,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps = {}) {
  const [collapsed, setCollapsed] = useState(false);
  const [logoutHover, setLogoutHover] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const LogoutIcon = logoutConfig.icon;

  function handleLogoutClick() {
    setShowLogoutConfirm(true);
  }

  function handleLogoutConfirm() {
    logout();
    setShowLogoutConfirm(false);
    navigate('/', { replace: true });
  }

  // En móvil forzamos extensible (drawer amplio); `collapsed` sólo aplica desktop.
  const isCollapsed = isDesktop ? collapsed : false;

  return (
    <aside
      className={cn(
        // Base estilos siempre aplicables
        'bg-background-main rounded-section shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]',
        'flex flex-col items-center gap-6 px-2.5 pt-5 pb-5',
        'transition-[width,transform] duration-200 shrink-0',
        // Modo desktop (sticky, en flujo): ancho toggleable.
        isDesktop &&
          cn(
            'relative h-screen sticky top-0 z-30',
            collapsed ? 'w-20' : 'w-72',
          ),
        // Modo móvil (drawer, fuera de flujo):
        // - Siempre w-72 extendido.
        // - fixed para no afectar al flujo del mapa.
        // - translate para animar entrada/salida.
        // - z alto (encima del overlay z-40 del AppLayout).
        !isDesktop &&
          cn(
            'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw]',
            'shadow-[4px_0_12px_0px_rgba(0,0,0,0.25)]',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          ),
      )}
      aria-label="Navegación principal"
      aria-hidden={!isDesktop && !mobileOpen ? 'true' : undefined}
    >
      {/* ── Header: logo + título (+ botón X en móvil) ──────────── */}
      <div
        className={cn(
          'w-full inline-flex justify-center items-center gap-2.5',
          isCollapsed && isDesktop && 'justify-center',
        )}
      >
        {/* Botón cerrar drawer (sólo móvil). */}
        {!isDesktop && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="absolute top-3 right-3 p-1.5 rounded-md text-text-primary
                       hover:bg-primary-main/10 transition-colors
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main"
            aria-label="Cerrar menú de navegación"
          >
            <X className="size-5" strokeWidth={2} aria-hidden="true" />
          </button>
        )}

        <img
          src={logoUrl}
          alt="Logo EPS Selva Central"
          className="w-9 h-14 object-contain"
        />
        {!isCollapsed && (
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
        {navConfig
          .filter((group) => !group.adminOnly || isAdmin)
          .map((group, index) => (
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
                  isCollapsed && isDesktop ? 'text-[11px] w-full text-left' : 'text-base',
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
                collapsed={isCollapsed}
              />
            ))}
          </div>
        ))}
      </div>

      {/* ── Cierre de sesión (al fondo) ────────────────────────────── */}
      <div className="self-stretch flex flex-col justify-end items-center gap-2.5">
        {/* Badge de usuario con rol (sesión iniciada) */}
        <UserBadge collapsed={isCollapsed} />

        <button
          type="button"
          onMouseEnter={() => setLogoutHover(true)}
          onMouseLeave={() => setLogoutHover(false)}
          onClick={handleLogoutClick}
          className={cn(
            'w-full p-2.5 rounded-md outline outline-1 outline-offset-[-1px] transition-colors',
            'inline-flex justify-start items-center gap-2.5',
            logoutHover
              ? 'bg-secondary-background outline-secondary-main text-text-invert-primary'
              : 'bg-background-main outline-button-stroke text-text-primary',
          )}
          title={isCollapsed ? logoutConfig.label : undefined}
        >
          <LogoutIcon
            className="size-6 shrink-0"
            strokeWidth={2}
            aria-hidden="true"
          />
          {!isCollapsed && (
            <span className="text-base font-normal font-sans leading-6">
              {logoutConfig.label}
            </span>
          )}
        </button>

        <ConfirmDialog
          open={showLogoutConfirm}
          title="Cerrar Sesión"
          message="¿Seguro que quieres cerrar sesión? Volverás a la pantalla de inicio."
          confirmText="Cerrar Sesión"
          cancelText="Cancelar"
          variant="danger"
          onConfirm={handleLogoutConfirm}
          onClose={() => setShowLogoutConfirm(false)}
        />
      </div>

      {/* ── Toggle flotante (solo desktop) ────────────────────────── */}
      {isDesktop && (
        <SidebarToggle
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
        />
      )}
    </aside>
  );
}