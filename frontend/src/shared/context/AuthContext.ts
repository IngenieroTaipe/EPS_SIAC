import { createContext } from 'react';

/**
 * AuthContext — contexto de React que guarda el estado de autenticación.
 *
 * Solo la definición del contexto vive aquí. El Provider (componente) está
 * en `AuthContextProvider.tsx` y el hook `useAuth` en `AuthContext.hooks.ts`.
 * Esto cumple la regla `react-refresh/only-export-components` de ESLint.
 */

export interface AuthContextValue {
  isAuthenticated: boolean;
  /** Inicia sesión. En el mock solo marca isAuthenticated=true y persiste. */
  login: () => void;
  /** Cierra sesión. */
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);