import { ApiService, type ReadOptions } from './apiService';
import { AuthService } from './authService';
import { selectAgentDocument, validatePromptIdentity } from '../utils/agentDocument';
import { normalizeFlowRows } from '../utils/diagnosticFlow';
import type { FlowData, FlowConfig, EquipoSegunda, Diagnostico, DiagnosticoMultimedia } from '../types/diagnosticador';

export const flowApi = {
  getAll: async (flowName?: string): Promise<FlowData[]> => {
    const query = flowName ? `?flow_name=${encodeURIComponent(flowName)}` : '';
    const country = AuthService.getPaisSede();
    return normalizeFlowRows(await ApiService.get<FlowData[]>(`/diagnosticador/diagrama_diagnosticador${query}`), country);
  },

  create: async (flowName: string, configuracion: FlowConfig): Promise<FlowData> => {
    const country = AuthService.getPaisSede();
    const response = await ApiService.post<FlowData>('/diagnosticador/diagrama_diagnosticador', { flow_name: flowName, configuracion });
    const created = normalizeFlowRows(response, country)[0];
    if (!created) throw new Error('No se recibió el diagrama creado para este país.');
    return created;
  },

  update: async (id: number, flowName: string, configuracion: FlowConfig): Promise<FlowData> => {
    const country = AuthService.getPaisSede();
    const response = await ApiService.put<FlowData>('/diagnosticador/diagrama_diagnosticador', { id, flow_name: flowName, configuracion });
    const saved = normalizeFlowRows(response, country)[0];
    if (!saved || saved.id !== id || saved.flow_name !== flowName) throw new Error('No se confirmó el diagrama actualizado.');
    return saved;
  },

  delete: async (id: number, flowName: string): Promise<void> => {
    return ApiService.delete<void>('/diagnosticador/diagrama_diagnosticador', { id, flow_name: flowName });
  }
};

export const agenteApi = {
  getSystemMessage: async (options: ReadOptions = {}) => {
    const response = await ApiService.get<any[]>('/diagnosticador/system_message_agente', { ttl: 60_000, ...options });
    const prompt = selectAgentDocument(response, AuthService.getPaisSede()).prompt;
    if (!prompt) throw new Error('No se recibió el prompt de diagnóstico para el país activo.');
    return prompt;
  },
  updateSystemMessage: async (data: { row_number: number, system_message: string, pais_sede: string }) => {
    validatePromptIdentity(data, AuthService.getPaisSede());
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

export const diagnosticoApi = {
  create: async (data: { id_reparacion?: number; id_diagrama: number; flow_name: string }): Promise<Diagnostico> => {
    const payload = {
      ...(data.id_reparacion ? { id: data.id_reparacion } : {}),
      id_diagrama: data.id_diagrama,
      flow_name: data.flow_name,
      estado: 'diagnostico',
      estado_diagnostico: 'en_progreso',
    };
    const repair = data.id_reparacion
      ? await ApiService.put<any>('/reparaciones', payload)
      : await ApiService.post<any>('/reparaciones', payload);
    const row = Array.isArray(repair) ? repair[0] : repair;
    if (!row?.id) {
      throw new Error(data.id_reparacion
        ? `No existe la reparación #${data.id_reparacion}`
        : 'El POST /reparaciones no devolvió la fila creada');
    }
    return {
      ...row,
      id: row.id,
      id_reparacion: row.id,
      id_diagrama: row.id_diagrama,
      flow_name: row.flow_name,
      estado: row.estado_diagnostico || 'en_progreso',
      respuestas: row.respuestas || {},
      multimedia: row.multimedia || [],
    };
  },

  update: async (data: Pick<Diagnostico, 'id' | 'respuestas' | 'estado'> & { paso_actual?: string | null }): Promise<Diagnostico> =>
    ApiService.put<Diagnostico>('/reparaciones', {
      id: data.id,
      respuestas: data.respuestas,
      paso_actual: data.paso_actual,
      estado_diagnostico: data.estado,
    }),

  upload: async (file: File, type: string): Promise<{ imagen_url: string }> => {
    const form = new FormData();
    form.append('upload_file', file);
    const safeFilename = file.name.normalize('NFD').replace(/[^\x00-\x7F]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    return ApiService.postFile<{ imagen_url: string }>('/upload_file', form, { type, filename: safeFilename });
  },

  saveMedia: async (id: number, multimedia: DiagnosticoMultimedia[]): Promise<Diagnostico> =>
    ApiService.put<Diagnostico>('/reparaciones', { id, multimedia }),
};
