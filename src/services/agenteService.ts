// services/agenteService.ts
import { SystemMessage } from "../types/precios";
import { ApiService } from "./apiService";

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
  static async getSystemMessage(source: AgentSource = "Wiltech"): Promise<SystemMessage[]> {
    return ApiService.get<SystemMessage[]>(endpointFor(source));
  }

  static async updateSystemMessage(
    system_message: string,
    source: AgentSource = "Wiltech"
  ): Promise<SystemMessage> {
    return ApiService.post<SystemMessage>(endpointFor(source), { system_message });
  }
}