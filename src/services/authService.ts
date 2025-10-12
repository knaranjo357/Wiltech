// services/authService.ts
export interface LoginRequest {
  email: string;
  password: string;
}

export interface User {
  email: string;
  token: string;
  role?: string;
  locations?: string[]; // "ciudad"
}

const API_BASE = 'https://n8n.alliasoft.com/webhook/wiltech';

export class AuthService {
  private static readonly TOKEN_KEY = 'wiltech_token';
  private static readonly USER_KEY = 'wiltech_user';

  /** Normaliza rol que puede venir como "\"admin\"" */
  private static normalizeRole(raw: unknown): string | undefined {
    if (raw == null) return undefined;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string') return parsed;
      } catch {/* ignore */}
      return raw.replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '');
    }
    return String(raw);
  }

  static async login(credentials: LoginRequest): Promise<User> {
    const resp = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // sin Authorization
      body: JSON.stringify(credentials),
    });

    // El backend devuelve [] cuando usuario/clave es incorrecto
    const data = await resp.json().catch(() => []);
    if (!Array.isArray(data) || data.length === 0) {
      // MUY IMPORTANTE: limpiar sesión previa para evitar que un token viejo “persista”
      this.logout();
      throw new Error('Usuario o contraseña incorrectos');
    }

    const first = data[0] ?? {};
    const token: string | undefined = first.token;
    if (!token) {
      this.logout();
      throw new Error('Respuesta de login inválida (sin token)');
    }

    const role = this.normalizeRole(first.rol);
    const locations: string[] | undefined = Array.isArray(first.ciudad) ? first.ciudad : undefined;

    const user: User = { email: credentials.email, token, role, locations };

    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));

    return user;
  }

  static logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static getCurrentUser(): User | null {
    const raw = localStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }
}
