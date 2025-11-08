// services/clientService.ts
import { Client } from '../types/client';
import { ApiService } from './apiService';

export class ClientService {
  static async getClients(): Promise<Client[]> {
    return ApiService.get<Client[]>('/clientes');
  }

  static async updateClient(client: Partial<Client>): Promise<Client> {
    return ApiService.post<Client>('/clientes', client);
  }

  /** Crear nuevo cliente (usa ApiService → incluye Authorization automáticamente) */
  static async createClient(client: Partial<Client>): Promise<any> {
    return ApiService.post<any>('/clientes-nuevo', client);
  }
}
