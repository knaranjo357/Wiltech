// services/clientService.ts
import { Client } from '../types/client';
import { ApiService, type ReadOptions } from './apiService';

export class ClientService {
  static async getClients(options: ReadOptions = {}): Promise<Client[]> {
    return ApiService.get<Client[]>('/clientes', { ttl: 30_000, ...options });
  }

  /** Obtiene solo clientes con fecha_agenda (para AgendaPage) */
  static async getAgendaClients(options: ReadOptions = {}): Promise<Client[]> {
    return ApiService.get<Client[]>('/agenda', { ttl: 30_000, ...options });
  }

  /** Obtiene solo clientes con solicitud de ayuda (para AsistenciaPage) */
  static async getAsistenciaClients(options: ReadOptions = {}): Promise<Client[]> {
    return ApiService.get<Client[]>('/asistencia', { ttl: 30_000, ...options });
  }

  /** Obtiene solo clientes con envío gestionado o en revisión (para EnviosPage) */
  static async getEnviosClients(options: ReadOptions = {}): Promise<Client[]> {
    return ApiService.get<Client[]>('/envios', { ttl: 30_000, ...options });
  }

  static async updateClient(client: Partial<Client>): Promise<Client> {
    return ApiService.post<Client>('/clientes', client);
  }

  /** Crear nuevo cliente (usa ApiService → incluye Authorization automáticamente) */
  static async createClient(client: Partial<Client>): Promise<any> {
    return ApiService.post<any>('/clientes-nuevo', client);
  }
}
