import { SystemMessage } from '../types/precios';
import { ApiService } from './apiService';

export class AgenteService {
  static async getSystemMessage(): Promise<SystemMessage[]> {
    return ApiService.get<SystemMessage[]>('/system_message');
  }

  static async updateSystemMessage(system_message: string): Promise<SystemMessage> {
    return ApiService.post<SystemMessage>('/system_message', { system_message });
  }
}