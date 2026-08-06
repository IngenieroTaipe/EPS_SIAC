import { useEffect, useMemo, useState, type ReactNode } from 'react';
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

  // ── Bootstrap: si al montar la app hay un token en localStorage (p. ej.
  //    tras un F5 o reabrir la pestaña) pero todavía no sabemos quién es el
  //    usuario (`user === null`), pedimos el perfil a `/auth/user/` para
  //    reconstruir `is_staff`/`is_superuser`/`groups`. Sin esto, el sidebar
  //    no muestra la sección "Administración" tras un refresh y el guard
  //    `RequireAdmin` redirige a `/alertas` aunque el usuario sea admin.
  //    Si el token está expirado o es inválido, el backend responde 401 y
  //    cerramos sesión local (limpiando `isAuthenticated` y `user`).
  useEffect(() => {
    if (!hasAccessToken() || user) return;
    let cancelled = false;
    // Secuencia de bootstrap canónica (fetch → setUser / setError). Patrón
    // idéntico al de los providers de datos de la app.
    apiAuth
      .getProfile()
      .then((profile) => {
        if (cancelled) return;
        if (profile) {
          setUser(profile as AuthUser);
          setIsAuthenticated(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Token inválido/expirado: el interceptor de axios ya removió el
        // access token del localStorage; sincronizamos el contexto para
        // que el usuario vea la UI pública.
        setAccessToken(null);
        setIsAuthenticated(false);
        setUser(null);
      });
    return () => {
      cancelled = true;
    };
    // Solo en el mount: depends on [] intencional — no re-fetchear al
    // cambiar `user` para evitar bucles tras el login (que ya settea user).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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