// services/agenteService.ts
import { SystemMessage } from '../types/precios';
import { ApiService } from './apiService';

export type AgentSource = 'Wiltech' | 'WiltechBga';

const endpointFor = (source: AgentSource) =>
  source === 'WiltechBga' ? '/system_messageBga' : '/system_message';

export class AgenteService {
  static async getSystemMessage(source: AgentSource = 'Wiltech'): Promise<SystemMessage[]> {
    return ApiService.get<SystemMessage[]>(endpointFor(source));
  }

  static async updateSystemMessage(
    system_message: string,
    source: AgentSource = 'Wiltech'
  ): Promise<SystemMessage> {
    return ApiService.post<SystemMessage>(endpointFor(source), { system_message });
  }
}
