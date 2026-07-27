import { Outlet } from 'react-router-dom';
import { TopBar } from '@/layouts/topbar/TopBar';

/**
 * GuestLayout: contenedor para páginas PÚBLICAS (no requieren auth).
 *   - Sin sidebar (la persona aún no está logueada).
 *   - Con TopBar (header dinámico por ruta).
 *   - Renderiza el contenido de la ruta hija vía `<Outlet />`.
 *
 * Nota: `/login` NO usa este layout — tiene su propio layout sin TopBar
 * (el login no requiere encabezado). El redirect de autenticado → `/alertas`
 * se maneja en la propia `LoginPage` para evitar dobles protecciones.
 *
 * Estructura:
 *   ┌───────────────────────────────────────────┐
 *   │ TopBar                                     │
 *   ├───────────────────────────────────────────┤
 *   │ <Outlet />  (contenido de la ruta hija)    │
 *   └───────────────────────────────────────────┘
 */
export function GuestLayout() {
  return (
    <div className="h-screen flex flex-col bg-background-main">
      <TopBar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}