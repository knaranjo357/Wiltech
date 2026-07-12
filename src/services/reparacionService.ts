import { ApiService } from './apiService';
import type { Reparacion } from '../types/reparacion';

const asRows = (response: Reparacion | Reparacion[]): Reparacion[] =>
  Array.isArray(response) ? response : response ? [response] : [];

export const ReparacionService = {
  getAll: async (): Promise<Reparacion[]> =>
    asRows(await ApiService.get<Reparacion | Reparacion[]>('/reparaciones')),

  getByClient: async (crmRowNumber: number): Promise<Reparacion[]> => {
    const rows = await ReparacionService.getAll();
    return rows.filter(row => Number(row.crm_row_number) === Number(crmRowNumber));
  },

  create: async (data: Partial<Reparacion>): Promise<Reparacion> => {
    const rows = asRows(await ApiService.post<Reparacion | Reparacion[]>('/reparaciones', data));
    if (!rows[0]) throw new Error('Supabase no devolvió la reparación creada');
    return rows[0];
  },

  update: async (data: Partial<Reparacion> & { id: number }): Promise<Reparacion> => {
    const rows = asRows(await ApiService.put<Reparacion | Reparacion[]>('/reparaciones', data));
    if (!rows[0]) throw new Error('No se encontró la reparación');
    return rows[0];
  },
};
