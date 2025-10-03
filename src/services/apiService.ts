import { AuthService } from './authService';

const API_BASE = 'https://n8n.alliasoft.com/webhook/wiltech';
export class ApiService {
  private static readonly BASE_URL = 'https://n8n.alliasoft.com/webhook/wiltech';

  private static getHeaders(): HeadersInit {
    const token = AuthService.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  static async get<T>(endpoint: string): Promise<T> {
    try {
      const response = await fetch(`${this.BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: this.getHeaders(),
        mode: 'cors',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`GET ${endpoint} error:`, error);
      throw error;
    }
  }

  static async post<T>(endpoint: string, data: any): Promise<T> {
    try {
      const response = await fetch(`${this.BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
        mode: 'cors',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`POST ${endpoint} error:`, error);
      throw error;
    }
  }
}