import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext.hooks';

/**
 * RequireAdmin — guard de ruta para páginas de administración.
 *
 * Si el usuario no está autenticado o no es admin (`is_staff`/`is_superuser`),
 * redirige a `/alertas` (página por defecto tras login). Pensado para
 * envolver el grupo de rutas `/admin/*` dentro de `AppLayout`.
 *
 * Se asume que `AuthProvider` ya pobló `user` (vía `getProfile()` si el
 * JWT del login no incluía los campos de rol). Si `user` aún es null
 * porque el perfil está cargando, se trata como no-admin y redirige —
 * no hay flash visible porque el `AuthProvider` resuelve el perfil en
 * el mismo `useEffect` de login.
 */
export function RequireAdmin() {
  const { isAuthenticated, isAdmin } = useAuth();

  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/alertas" replace />;
  }

  return <Outlet />;
}