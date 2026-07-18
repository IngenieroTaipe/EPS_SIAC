import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { TopBar } from '@/layouts/topbar/TopBar';
import { useAuth } from '@/shared/context/AuthContext.hooks';

/**
 * GuestLayout: contenedor para páginas PÚBLICAS (no requieren auth).
 *   - Sin sidebar (la persona aún no está logueada).
 *   - Con TopBar (header dinámico por ruta).
 *   - Renderiza el contenido de la ruta hija vía `<Outlet />`.
 *   - Si ya está autenticado, redirige a `/alertas` (página interna por defecto).
 *
 * Estructura:
 *   ┌───────────────────────────────────────────┐
 *   │ TopBar                                     │
 *   ├───────────────────────────────────────────┤
 *   │ <Outlet />  (contenido de la ruta hija)    │
 *   └───────────────────────────────────────────┘
 */
export function GuestLayout() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // Si ya está logueado y trata de ir a /login, redirige a /alertas.
  if (isAuthenticated && location.pathname === '/login') {
    return <Navigate to="/alertas" replace />;
  }

  return (
    <div className="h-screen flex flex-col bg-background-main">
      <TopBar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}