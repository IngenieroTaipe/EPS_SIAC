import { httpClient, setAccessToken } from './httpClient';

export interface LoginResponse {
  access: string;
  refresh: string;
  user?: {
    pk: number | string;
    username: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    is_staff?: boolean;
    is_superuser?: boolean;
    groups?: string[];
  };
}

export const apiAuth = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await httpClient.post<LoginResponse>('/auth/login/', {
      username,
      password,
    });
    const { access, refresh } = res.data;
    setAccessToken(access);
    if (refresh) {
      localStorage.setItem('eps_refresh_token', refresh);
    }
    return res.data;
  },

  async logout(): Promise<void> {
    try {
      const refresh = localStorage.getItem('eps_refresh_token');
      if (refresh) {
        await httpClient.post('/auth/logout/', { refresh });
      }
    } catch {
      // logout es best-effort: aunque falle backend, limpiar local.
    } finally {
      setAccessToken(null);
      localStorage.removeItem('eps_refresh_token');
    }
  },

  async getProfile(): Promise<LoginResponse['user']> {
    const res = await httpClient.get('/auth/user/');
    return res.data;
  },

  // === Administración de usuarios (solo admin) ===
  async listUsers(): Promise<unknown[]> {
    const res = await httpClient.get('/auth/users/');
    const data = res.data;
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  async createUser(payload: {
    username: string;
    email?: string;
    password: string;
    first_name?: string;
    last_name?: string;
    is_staff?: boolean;
    is_active?: boolean;
    groups?: number[];
  }): Promise<unknown> {
    const res = await httpClient.post('/auth/users/', payload);
    return res.data;
  },

  async updateUser(
    id: number | string,
    payload: Partial<{
      username: string;
      email: string;
      first_name: string;
      last_name: string;
      is_staff: boolean;
      is_active: boolean;
      groups: number[];
      password: string;
    }>,
  ): Promise<unknown> {
    const res = await httpClient.patch(`/auth/users/${id}/`, payload);
    return res.data;
  },

  async deleteUser(id: number | string): Promise<void> {
    await httpClient.delete(`/auth/users/${id}/`);
  },
};