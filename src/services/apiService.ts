import { countryFetch } from './countryRequest';
// services/apiService.ts
import { AuthService } from './authService';
import { RequestCache } from '../utils/requestCache';
export interface ReadOptions { ttl?: number; force?: boolean }

export class ApiService {
  private static readonly BASE_URL = 'https://n8n.alliasoft.com/webhook/wiltech';

  private static cache = new RequestCache();
  private static cacheSession: string | null = null;
  static invalidateCache() { this.cache.clear(); }

  private static getHeaders(): HeadersInit {
    const token = AuthService.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /** Manejo uniforme de respuestas (incluye 401/403). */
  private static async handle<T>(response: Response): Promise<T> {
    if (response.status === 401 || response.status === 403) {
      // Sesión inválida/expirada: limpiar y enviar a login
      this.invalidateCache();
      AuthService.logout();
      // Opcional: si tienes router, usa navigate('/login')
      window.location.href = '/login';
      throw new Error('Sesión expirada. Por favor, vuelve a iniciar sesión.');
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  static async get<T>(endpoint: string, options: ReadOptions = {}): Promise<T> {
    const session = JSON.stringify([AuthService.getToken(), AuthService.getPaisSede()]);
    if (session !== this.cacheSession) {
      this.invalidateCache();
      this.cacheSession = session;
    }
    if (options.ttl && options.ttl > 0) {
      return this.cache.get(endpoint, () => this.get<T>(endpoint), options.ttl, options.force);
    }
    const response = await countryFetch(`${this.BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders(),
      mode: 'cors',
    });
    return this.handle<T>(response);
  }

  private static async mutate<T>(endpoint: string, init: RequestInit): Promise<T> {
    this.invalidateCache();
    try {
      const response = await countryFetch(`${this.BASE_URL}${endpoint}`, { ...init, mode: 'cors' });
      return await this.handle<T>(response);
    } finally {
      // Also invalidate on network failure: the server may have accepted the write.
      this.invalidateCache();
    }
  }

  static post<T>(endpoint: string, data: unknown): Promise<T> {
    return this.mutate<T>(endpoint, { method: 'POST', headers: this.getHeaders(), body: JSON.stringify(data) });
  }

  static put<T>(endpoint: string, data: unknown): Promise<T> {
    return this.mutate<T>(endpoint, { method: 'PUT', headers: this.getHeaders(), body: JSON.stringify(data) });
  }

  static delete<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.mutate<T>(endpoint, { method: 'DELETE', headers: this.getHeaders(), ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  }

  static postForm<T>(endpoint: string, form: FormData): Promise<T> {
    return this.postFile<T>(endpoint, form);
  }

  static postFile<T>(endpoint: string, form: FormData, headers: Record<string, string> = {}): Promise<T> {
    const token = AuthService.getToken();
    return this.mutate<T>(endpoint, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: form,
    });
  }
}
