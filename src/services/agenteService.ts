// services/agenteService.ts
import { SystemMessage } from "../types/precios";
import { ApiService, type ReadOptions } from "./apiService";
import { AuthService } from './authService';
import { validatePromptIdentity } from '../utils/agentDocument';

export type AgentSource = "Wiltech" | "WiltechBga" | "WiltechCRM" | "WiltechPrecios";

const endpointFor = (source: AgentSource) => {
  switch (source) {
    case "WiltechBga":
      return "/system_messageBga";
    case "WiltechCRM":
      return "/system_message_crm";
    case "WiltechPrecios":
      return "/system_message_precios";
    case "Wiltech":
    default:
      return "/system_message";
  }
};

export class AgenteService {
  static async getSystemMessage(source: AgentSource = "Wiltech", options: ReadOptions = {}): Promise<SystemMessage[]> {
    return ApiService.get<SystemMessage[]>(endpointFor(source), { ttl: 60_000, ...options });
  }

  static async updateSystemMessage(
    system_message: string,
    source: AgentSource,
    record: Pick<SystemMessage, 'row_number' | 'pais_sede' | 'Tipo'>
  ): Promise<SystemMessage> {
    validatePromptIdentity(record, AuthService.getPaisSede(), source === 'WiltechPrecios');
    return ApiService.post<SystemMessage>(endpointFor(source), {
      system_message,
      row_number: record.row_number,
      pais_sede: record.pais_sede,
      ...(source === 'WiltechPrecios' ? { Tipo: 'prompt' } : {}),
    });
  }
}
