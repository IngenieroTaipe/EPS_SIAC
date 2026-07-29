import { Navigate, Outlet } from 'react-router-dom';
import { Sidebar } from '@/layouts/sidebar/Sidebar';
import { TopBar } from '@/layouts/topbar/TopBar';
import { useAuth } from '@/shared/context/AuthContext.hooks';
import { TimelineBar } from '@/features/mapa/components/TimelineBar';
import { PrecipitationTimelineProvider } from '@/features/mapa/timeline/PrecipitationTimelineProvider';
import { usePrecipitationTimeline } from '@/features/mapa/timeline/usePrecipitationTimeline';

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
    <PrecipitationTimelineProvider>
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
    </PrecipitationTimelineProvider>
  );
}

/**
 * PrecipitationTimelineFooter — wrapper que lee el contexto y decide si
 * renderizar la timeline (sólo cuando hay frames GFS disponibles). Si la
 * ventana está vacía (sin pronóstico) no muestra nada para no ocupar altura.
 */
function PrecipitationTimelineFooter() {
  const { frames, timelineProps } = usePrecipitationTimeline();
  if (frames.length === 0) return null;
  return <TimelineBar {...timelineProps} />;
}