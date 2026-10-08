import { ApiService } from './apiService';
import { AuthService } from './authService';
import { parseCountryConfig, type CountryConfig } from '../utils/countryConfig';

export interface CountryRecord { id: number; pais_sede: string; configuracion: unknown }
export const CountryService = {
  async get(force = false): Promise<CountryRecord | null> {
    const country = AuthService.getPaisSede();
    const data = await ApiService.get<CountryRecord[]>('/paises', { ttl: 60_000, force });
    if (!Array.isArray(data)) throw new Error('La respuesta de países es inválida.');
    const rows = data.filter(row => row?.pais_sede === country);
    if (rows.length > 1) throw new Error('Hay varios registros de configuración para este país.');
    if (rows[0] && (!Number.isInteger(rows[0].id) || rows[0].id <= 0)) throw new Error('El país no tiene un ID válido.');
    return rows[0] ?? null;
  },
  async save(record: CountryRecord | null, config: CountryConfig): Promise<void> {
    if (!AuthService.isRoot()) throw new Error('No tienes permiso para configurar países.');
    const country = AuthService.getPaisSede();
    if (record && record.pais_sede !== country) throw new Error('El país cambió. Recarga la configuración.');
    const body = { pais_sede: country, configuracion: parseCountryConfig(config, country), ...(record ? { id_pais: record.id } : {}) };
    if (record) await ApiService.put('/paises', body);
    else await ApiService.post('/paises', body);
  },
};
