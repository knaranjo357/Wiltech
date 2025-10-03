import { LoginRequest, LoginResponse, User } from '../types/auth';

const API_BASE = 'https://n8n.alliasoft.com/webhook/wiltech';

export class AuthService {
  private static readonly TOKEN_KEY = 'wiltech_token';
  private static readonly USER_KEY = 'wiltech_user';

  static async login(credentials: LoginRequest): Promise<User> {
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        throw new Error('Credenciales incorrectas');
      }

      const data: LoginResponse = await response.json();
      const user: User = {
        email: credentials.email,
        token: data.token,
      };

      // Guardar en localStorage
      localStorage.setItem(this.TOKEN_KEY, data.token);
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));

      return user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  static logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static getCurrentUser(): User | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  static isAuthenticated(): boolean {
    return !!this.getToken();
  }
}