// services/apiService.ts
import { AuthService } from './authService';

export class ApiService {
  private static readonly BASE_URL = 'https://n8n.alliasoft.com/webhook/wiltech';

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

  static async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders(),
      mode: 'cors',
    });
    return this.handle<T>(response);
  }

  static async post<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${this.BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
      mode: 'cors',
    });
    return this.handle<T>(response);
  }

  /** Si necesitas subir archivos (FormData) sin 'Content-Type' automático */
  static async postForm<T>(endpoint: string, form: FormData): Promise<T> {
    const token = AuthService.getToken();
    const response = await fetch(`${this.BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
      mode: 'cors',
    });
    return this.handle<T>(response);
  }
}
