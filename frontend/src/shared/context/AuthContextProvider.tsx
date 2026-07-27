import { useMemo, useState, type ReactNode } from 'react';
import { AuthContext } from './AuthContext';

/**
 * Provider del AuthContext.
 * Envolver la app con este componente en `main.tsx`.
 *
 * Persistencia mínima en `localStorage` para sobrevivir recargas:
 *   - clave: `eps_siac_auth`
 *   - valor: 'true' | 'false'
 *
 * Lógica provisional (mock); el flujo real se integrará cuando se maquete
 * el formulario de Login y se conecte con `services/api`.
 */

const STORAGE_KEY = 'eps_siac_auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  });

  const value = useMemo(
    () => ({
      isAuthenticated,
      login: () => {
        window.localStorage.setItem(STORAGE_KEY, 'true');
        setIsAuthenticated(true);
      },
      logout: () => {
        window.localStorage.removeItem(STORAGE_KEY);
        setIsAuthenticated(false);
      },
    }),
    [isAuthenticated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}