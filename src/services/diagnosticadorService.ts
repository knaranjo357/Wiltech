import { ApiService } from './apiService';
import type { FlowData, FlowConfig, EquipoSegunda } from '../types/diagnosticador';

export const flowApi = {
  getAll: async (): Promise<FlowData[]> => {
    return ApiService.get<FlowData[]>('/diagnosticador/diagrama_diagnosticador');
  },

  create: async (configuracion: FlowConfig): Promise<FlowData> => {
    return ApiService.post<FlowData>('/diagnosticador/diagrama_diagnosticador', { configuracion });
  },

  update: async (id: number, configuracion: FlowConfig): Promise<FlowData> => {
    return ApiService.put<FlowData>('/diagnosticador/diagrama_diagnosticador', { id, configuracion });
  },

  delete: async (id: number): Promise<void> => {
    return ApiService.delete<void>('/diagnosticador/diagrama_diagnosticador', { id });
  }
};

export const agenteApi = {
  getSystemMessage: async () => {
    const response = await ApiService.get<any[]>('/diagnosticador/system_message_agente');
    return response[0];
  },
  updateSystemMessage: async (data: { row_number: number, system_message: string }) => {
    return ApiService.put<any>('/diagnosticador/system_message_agente', data);
  },
  chat: async (payload: { mensaje: string, sessionId: string, historial: any[], informacion_contexto: any }) => {
    return ApiService.post<any>('/diagnosticador/agente_diagnosticador', payload);
  }
};

export const equiposSegundaApi = {
  getAll: async (): Promise<EquipoSegunda[]> => {
    return ApiService.get<EquipoSegunda[]>('/diagnosticador/equipos_segunda');
  },
  create: async (data: Omit<EquipoSegunda, 'id' | 'created_at'>): Promise<EquipoSegunda> => {
    return ApiService.post<EquipoSegunda>('/diagnosticador/equipos_segunda', data);
  },
  update: async (data: Omit<EquipoSegunda, 'created_at'>): Promise<EquipoSegunda> => {
    return ApiService.put<EquipoSegunda>('/diagnosticador/equipos_segunda', data);
  },
  delete: async (id: number): Promise<void> => {
    return ApiService.delete<void>('/diagnosticador/equipos_segunda', { id });
  }
};
