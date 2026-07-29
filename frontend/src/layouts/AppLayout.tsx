import { Navigate, Outlet } from 'react-router-dom';
import { Sidebar } from '@/layouts/sidebar/Sidebar';
import { TopBar } from '@/layouts/topbar/TopBar';
import { useAuth } from '@/shared/context/AuthContext.hooks';
import { PrecipitationTimelineFooter } from '@/features/mapa/timeline/PrecipitationTimelineFooter';

/**
 * AppLayout: contenedor para páginas PROTEGIDAS (requieren auth).
 *   - Con Sidebar + TopBar.
 *   - Si no está autenticado, redirige a `/` (pestaña pública de inicio).
 *   - Renderiza el contenido de la ruta hija vía `<Outlet />`.
 *   - Pie permanente: `<TimelineBar>` (precipitaciones GFS), montada fuera
 *     del mapa como footer fijo. El panel deslizable de alertas/componentes
 *     se abre hacia arriba desde justo encima de esta timeline.
 *
 * Estructura:
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

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

return (
    <div className="h-screen flex bg-background-main">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            <Outlet />
          </div>
          <PrecipitationTimelineFooter />
        </main>
      </div>
    </div>
  );
}