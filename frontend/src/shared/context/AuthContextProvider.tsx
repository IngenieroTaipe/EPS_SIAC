import { useMemo, useState, type ReactNode } from 'react';
import { AuthContext, type AuthUser } from './AuthContext';
import { apiAuth } from '@/services/apiAuth';
import { hasAccessToken, setAccessToken } from '@/services/httpClient';

/**
 * Provider del AuthContext.
 * Envolver la app con este componente en `main.tsx`.
 *
 * Estado de autenticación basado en la presencia del JWT `access` en
 * localStorage (lo guarda `apiAuth.login` tras un login exitoso).
 */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() =>
    hasAccessToken(),
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const value = useMemo(
    () => ({
      isAuthenticated,
      user,
      isLoggingIn,
      loginError,
      /** True si el usuario logueado es admin (is_staff o is_superuser). */
      isAdmin: !!user && (!!user.is_staff || !!user.is_superuser),
      async login(username: string, password: string) {
        setIsLoggingIn(true);
        setLoginError(null);
        try {
          const res = await apiAuth.login(username, password);
          setAccessToken(res.access);
          setIsAuthenticated(true);
          if (res.user) {
            setUser(res.user as AuthUser);
          } else {
            // dj-rest-auth con JWT no siempre devuelve el usuario en el
            // login; lo pedimos vía /auth/user/ para conocer el rol.
            try {
              const profile = await apiAuth.getProfile();
              if (profile) setUser(profile as AuthUser);
            } catch {
              // No es crítico: el token ya quedó guardado.
            }
          }
        } catch (err: unknown) {
          setAccessToken(null);
          setIsAuthenticated(false);
          setUser(null);
          const e = err as { response?: { data?: { detail?: string } } };
          const msg =
            e?.response?.data?.detail ??
            'No se pudo iniciar sesión. Verifica tus credenciales.';
          setLoginError(msg);
          throw err;
        } finally {
          setIsLoggingIn(false);
        }
      },
      async logout() {
        await apiAuth.logout();
        setIsAuthenticated(false);
        setUser(null);
      },
    }),
    [isAuthenticated, user, isLoggingIn, loginError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}