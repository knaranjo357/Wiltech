// services/clientService.ts
import { Client } from '../types/client';
import { ApiService } from './apiService';

export class ClientService {
  static async getClients(): Promise<Client[]> {
    return ApiService.get<Client[]>('/clientes');
  }

  /** Obtiene solo clientes con fecha_agenda (para AgendaPage) */
  static async getAgendaClients(): Promise<Client[]> {
    return ApiService.get<Client[]>('/agenda');
  }

  /** Obtiene solo clientes con solicitud de ayuda (para AsistenciaPage) */
  static async getAsistenciaClients(): Promise<Client[]> {
    return ApiService.get<Client[]>('/asistencia');
  }

  /** Obtiene solo clientes con envío gestionado o en revisión (para EnviosPage) */
  static async getEnviosClients(): Promise<Client[]> {
    return ApiService.get<Client[]>('/envios');
  }

  static async updateClient(client: Partial<Client>): Promise<Client> {
    return ApiService.post<Client>('/clientes', client);
  }

  /** Crear nuevo cliente (usa ApiService → incluye Authorization automáticamente) */
  static async createClient(client: Partial<Client>): Promise<any> {
    return ApiService.post<any>('/clientes-nuevo', client);
  }
}
