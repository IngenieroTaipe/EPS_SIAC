import { Outlet } from 'react-router-dom';
import { TopBar } from '@/layouts/topbar/TopBar';
import { PrecipitationTimelineFooter } from '@/features/mapa/timeline/PrecipitationTimelineFooter';

/**
 * GuestLayout: contenedor para páginas PÚBLICAS (no requieren auth).
 *   - Sin sidebar (la persona aún no está logueada).
 *   - Con TopBar (header dinámico por ruta).
 *   - Renderiza el contenido de la ruta hija vía `<Outlet />`.
 *   - Pie permanente: `<PrecipitationTimelineFooter />` (timeline de
 *     precipitaciones GFS). El Provider vive fuera, en `App.tsx`, así
 *     cubre tanto las rutas públicas como las protegidas.
 *
 * Nota: `/login` NO usa este layout — tiene su propio layout sin TopBar.
 *
 * Estructura:
 *   ┌───────────────────────────────────────────┐
 *   │ TopBar                                     │
 *   ├───────────────────────────────────────────┤
 *   │ <Outlet />  (contenido de la ruta hija)    │
 *   ├───────────────────────────────────────────┤
 *   │ <PrecipitationTimelineFooter />            │
 *   └───────────────────────────────────────────┘
 */
export function GuestLayout() {
  return (
    <div className="h-screen flex flex-col bg-background-main">
      <TopBar />
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </div>
        <PrecipitationTimelineFooter />
      </main>
    </div>
  );
}