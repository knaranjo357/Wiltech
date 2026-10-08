import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { CountryService, type CountryRecord } from '../services/countryService';
import { AuthService } from '../services/authService';
import { parseCountryConfig, type CountryConfig } from '../utils/countryConfig';
import { RepairLoader } from './RepairLoader';
import { CountryContext } from '../hooks/countryContext';

export function CountryProvider({ children }: { children: ReactNode }) {
  const country = AuthService.getPaisSede();
  const [state, setState] = useState<{ record: CountryRecord | null; config: CountryConfig } | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async (force = false) => {
    setError('');
    try {
      const record = await CountryService.get(force);
      setState({ record, config: parseCountryConfig(record?.configuracion, country) });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo cargar el país.');
      throw error;
    }
  }, [country]);
  useEffect(() => { void load().catch(() => {}); }, [load]);
  if (!state) return error ? <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"><p role="alert">{error}</p><button className="btn-primary" onClick={() => void load(true).catch(() => {})}>Reintentar configuración del país</button><button className="text-sm underline" onClick={() => { AuthService.logout(); window.location.reload(); }}>Volver al inicio de sesión</button></div> : <RepairLoader label={`Preparando ${country}`} />;
  return <CountryContext.Provider value={{ country, ...state, reload: () => load(true) }}>{children}</CountryContext.Provider>;
}
