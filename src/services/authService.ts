// services/authService.ts
export interface LoginRequest {
  email: string;
  password: string;
}

export interface User {
  pais_sede?: string;
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

    const pais_sede = this.parseCountries(first.pais_sede).join(',');
    const user: User = { email: credentials.email, token, role, locations, pais_sede };
    sessionStorage.removeItem('wiltech_active_country');

    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));

    return user;
  }

  static logout(): void {
    sessionStorage.removeItem('wiltech_active_country');
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static getPaisSede(): string {
    const countries = this.getAllowedCountries();
    const country = sessionStorage.getItem('wiltech_active_country');
    if (country && countries.includes(country)) return country;
    if (countries.length) return countries[0];
    if (!countries.length) {
      throw new Error('La sesión no tiene pais_sede. Vuelve a iniciar sesión con un usuario que tenga país asignado.');
    }
    throw new Error('Selecciona el país con el que vas a trabajar.');
  }

  static getAllowedCountries(): string[] {
    const countries = this.parseCountries(this.getCurrentUser()?.pais_sede);
    return this.isRoot() ? countries : countries.slice(0, 1);
  }

  static isRoot(): boolean {
    return this.getCurrentUser()?.role?.split(',').some(role => role.trim().toLowerCase() === 'root') ?? false;
  }

  /** Accept arrays, serialized arrays and the legacy comma-separated format. */
  static parseCountries(raw: unknown): string[] {
    if (typeof raw === 'string') {
      const text = raw.trim();
      try {
        const parsed: unknown = JSON.parse(text);
        if (Array.isArray(parsed)) return this.parseCountries(parsed);
      } catch { /* Legacy lists can contain brackets without JSON quotes. */ }
      raw = text.replace(/^\[/, '').replace(/\]$/, '').split(',');
    }
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.filter((value): value is string => typeof value === 'string')
      .map(value => value.trim().replace(/^["']|["']$/g, '').trim()).filter(Boolean))];
  }

  static setPaisSede(country: string): void {
    if (!this.getAllowedCountries().includes(country)) throw new Error('País no autorizado.');
    sessionStorage.setItem('wiltech_active_country', country);
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
