import { createContext } from 'react';

/**
 * AuthContext — contexto de React que guarda el estado de autenticación.
 *
 * Solo la definición del contexto vive aquí. El Provider (componente) está
 * en `AuthContextProvider.tsx` y el hook `useAuth` en `AuthContext.hooks.ts`.
 * Esto cumple la regla `react-refresh/only-export-components` de ESLint.
 */

export interface AuthUser {
  pk: number | string;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

export interface AuthContextValue {
  isAuthenticated: boolean;
  /** Inicia sesión real contra el backend. Lanza si las credenciales fallan. */
  login: (username: string, password: string) => Promise<void>;
  /** Cierra sesión (backend + local). */
  logout: () => Promise<void>;
  /** Usuario autenticado, si lo hay. */
  user: AuthUser | null;
  /** True mientras se está validando el login. */
  isLoggingIn: boolean;
  /** Mensaje de error del último intento de login (se limpia al reintentar). */
  loginError: string | null;
}

export const AuthContext = createContext<AuthContextValue | null>(null);