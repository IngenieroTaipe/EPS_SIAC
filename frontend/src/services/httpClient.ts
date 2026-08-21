import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

const ACCESS_TOKEN_KEY = 'eps_access_token';
const REFRESH_TOKEN_KEY = 'eps_refresh_token';

const baseURL =
  import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const httpClient: AxiosInstance = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Refresh silencioso del access token (Camino B) ────────────────────────
//   Cuando una petición recibe 401, intentamos renovar el access usando el
//   `refresh` de localStorage. Si funciona, reintentamos la petición original
//   con el nuevo token y el usuario no se entera. Si el refresh también falla
//   (p. ej. expiró el refresh de 1 día), caemos al flujo del Camino A:
//   limpiamos sesión y emitimos `auth:unauthorized` para que el AuthProvider
//   sincronice el estado y el AppLayout redirija a `/`.

let refreshInFlight: Promise<string> | null = null;

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return true;
  // Login (credenciales inválidas) y el propio refresh no deben disparar
  // un reintento: no tendría sentido y podría recursar.
  return (
    url.includes('/auth/login/') || url.includes('/auth/token/refresh/')
  );
}

async function refreshAccessToken(): Promise<string> {
  // Dedup: si N peticiones fallan 401 a la vez, todas esperan el mismo
  // refresh y no disparamos N POST /token/refresh/.
  if (refreshInFlight) return refreshInFlight;

  const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refresh) throw new Error('no refresh token');

  refreshInFlight = httpClient
    .post<{ access: string; refresh?: string }>('/auth/token/refresh/', {
      refresh,
    })
    .then((res) => {
      const { access, refresh: newRefresh } = res.data;
      setAccessToken(access);
      // ROTATE_REFRESH_TOKENS=True → el backend emite un nuevo refresh y
      // blacklistea el anterior. Hay que persistirlo o el próximo refresh
      // usará uno ya invalidado y cerrará sesión.
      if (newRefresh) localStorage.setItem(REFRESH_TOKEN_KEY, newRefresh);
      return access;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error?.response?.status;
    const original = error?.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined;

    if (status === 401 && original && !original._retried && !isAuthEndpoint(original.url)) {
      original._retried = true;
      try {
        const newAccess = await refreshAccessToken();
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newAccess}`;
        return httpClient(original);
      } catch {
        // El refresh falló (refresh expirado/blacklisted). Caemos al
        // fallback de logout automático (Camino A) más abajo.
      }
    }

    if (status === 401) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      // Avisa al AuthContext que la sesión quedó inválida para que
      // sincronice el estado de React y el AppLayout redirija a `/`.
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }

    return Promise.reject(error);
  },
);

export function setAccessToken(token: string | null) {
  if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
  else localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function hasAccessToken(): boolean {
  return !!localStorage.getItem(ACCESS_TOKEN_KEY);
}