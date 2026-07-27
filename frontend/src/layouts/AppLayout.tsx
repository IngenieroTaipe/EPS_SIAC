import { Navigate, Outlet } from 'react-router-dom';
import { Sidebar } from '@/layouts/sidebar/Sidebar';
import { TopBar } from '@/layouts/topbar/TopBar';
import { useAuth } from '@/shared/context/AuthContext.hooks';

/**
 * AppLayout: contenedor para páginas PROTEGIDAS (requieren auth).
 *   - Con Sidebar + TopBar.
 *   - Si no está autenticado, redirige a `/` (pestaña pública de inicio).
 *   - Renderiza el contenido de la ruta hija vía `<Outlet />`.
 *
 * Estructura:
 *   ┌──────────┬────────────────────────────────────┐
 *   │ Sidebar  │ TopBar (h-20, bg primary-main)      │
 *   │          ├─────────────────────────────────────┤
 *   │          │ <Outlet />  (contenido de la ruta)   │
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
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}