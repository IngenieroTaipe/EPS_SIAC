import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import { Sidebar } from '@/layouts/sidebar/Sidebar';
import { TopBar } from '@/layouts/topbar/TopBar';
import { MapLayout } from '@/layouts/MapLayout';
import { MapLayersProvider } from '@/features/mapa/context/MapLayersProvider';
import { useAuth } from '@/shared/context/AuthContext.hooks';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { PrecipitationTimelineFooter } from '@/features/mapa/timeline/PrecipitationTimelineFooter';

/** Rutas con vista geoespacial: el mapa se muestra (y las páginas sólo
 *  registran overlays). En el resto, el mapa queda oculto (keep-alive). */
const MAP_ROUTES = new Set(['/alertas', '/componentes']);

/**
 * AppLayout: contenedor para páginas PROTEGIDAS (requieren auth).
 *   - Con Sidebar + TopBar.
 *   - Si no está autenticado, redirige a `/` (pestaña pública de inicio).
 *   - Renderiza el contenido de la ruta hija vía `<Outlet />`.
 *   - Pie permanente: `<TimelineBar>` (precipitaciones GFS), montada fuera
 *     del mapa como footer fijo. El panel deslizable de alertas/componentes
 *     se abre hacia arriba desde justo encima de esta timeline.
 *
 * Comportamiento responsivo del Sidebar:
 *   - <sm (móvil): drawer overlay. Cerrado por defecto; el botón hamburguesa
 *     del TopBar lo abre, el overlay `bg-black/50` lo cierra al tocar fuera,
 *     y la navegación (cambio de ruta) también lo cierra. El sidebar pasa
 *     a `fixed` + `translate-x-full/0` y se elimina del flujo de layout; el
 *     mapa ocupa todo el ancho.
 *   - >=sm (tablet/desktop): comportamiento sticky original (extendido/
 *     colapsado con el toggle circular). Se renderiza `position: relative`
 *     y participa del flex layout.
 *
 * Estructura (desktop):
 *   ┌──────────┬────────────────────────────────────┐
 *   │ Sidebar  │ TopBar (h-20, bg primary-main)      │
 *   │          ├─────────────────────────────────────┤
 *   │          │ <Outlet />  (contenido de la ruta)   │
 *   │          │                                      │
 *   │          ├─────────────────────────────────────┤
 *   │          │ <TimelineBar />  (footer de precip.) │
 *   └──────────┴─────────────────────────────────────┘
 *
 * Para añadir una nueva página protegida, agrega una <Route> hija en `App.tsx`
 * dentro de este layout (ver `AppRouter`).
 */
export function AppLayout() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  // sm breakpoint de Tailwind = 640px. Por debajo, sidebar como drawer.
  const isDesktop = useMediaQuery('(min-width: 640px)');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Cerrar el drawer al cambiar de ruta (ranura seleccionada en el sidebar).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- patrón canónico: cerrar overlay de navegación al cambiar de ruta.
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  // Bloquear scroll del body cuando el drawer está abierto (móvil).
  useEffect(() => {
    if (isDesktop) return;
    if (!mobileSidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isDesktop, mobileSidebarOpen]);

  // ¿La ruta actual es una vista de mapa? (decide qué capa se ve: el mapa
  // keep-alive o el contenido de la ruta — ambos siempre montados).
  const esRutaMapa = MAP_ROUTES.has(location.pathname);

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="h-screen flex bg-background-main">
      <Sidebar
        isDesktop={isDesktop}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Overlay oscuro detrás del drawer en móvil */}
      {!isDesktop && mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 sm:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar onOpenSidebar={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <MapLayersProvider>
            <div className="relative flex-1 min-h-0 overflow-hidden">
              {/* ── Mapa KEEP-ALIVE: SIEMPRE montado ─────────────────────
                  Oculto con `visibility` (NO `display: none`: colapsaría
                  el tamaño del contenedor de Leaflet y exigiría
                  invalidateSize al volver). Al volver de cualquier pestaña
                  está exactamente como se dejó — cero re-dibujo de los
                  ~300 polígonos de precipitaciones (parpadeo de ~1s). */}
              <div
                className={cn(
                  'absolute inset-0',
                  !esRutaMapa && 'invisible',
                )}
                aria-hidden={!esRutaMapa}
              >
                <MapLayout />
              </div>

              {/* ── Contenido de la ruta (Outlet) ────────────────────────
                  Encima del mapa (cada página trae fondo opaco) cuando la
                  ruta NO es de mapa; invisible en rutas de mapa (las
                  páginas de mapa sólo registran overlays en el contexto
                  y no renderizan contenido propio). */}
              <div
                className={cn(
                  'absolute inset-0 overflow-hidden',
                  esRutaMapa && 'invisible pointer-events-none',
                )}
              >
                <Outlet />
              </div>
            </div>
          </MapLayersProvider>
          <PrecipitationTimelineFooter />
        </main>
      </div>
    </div>
  );
}