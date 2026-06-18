import { Client } from '../../../types/client';
import { normalize, safeText } from '../../../utils/textUtils';

export interface OptimizedClient extends Client {
  _tsAgenda: number;      
  _tsCreated: number;     
  _isEnvio: boolean;      
  _normSearch: string;    
  _normSede: string;      
  _normSource: string;    
  _uniqueId: string;      
}

export type Granularity = 'day' | 'week' | 'month';

export const SOURCE_EMPTY = 'Directo';

export const parseToTimestamp = (raw: any, offsetHours = 0): number => {
  if (!raw) return 0;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return 0;
  if (offsetHours) d.setTime(d.getTime() - offsetHours * 3600000);
  return d.getTime();
};

export const hasLogisticsData = (c: any): boolean => {
  return !!(
    safeText(c.guia_direccion) || 
    safeText(c.guia_ciudad) || 
    safeText(c.guia_numero_ida) || 
    safeText(c.guia_nombre_completo) ||
    safeText(c.guia_cedula_id) ||
    safeText(c.guia_numero_retorno) ||
    c.estado_etapa === 'ENVIO_GESTIONADO' ||
    c.estado_envio === 'envio_gestionado'
  );
};

export const getBucketKey = (ts: number, g: Granularity): string => {
  if (ts === 0) return '';
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const date = d.getDate();
  
  if (g === 'day') return `${year}-${month < 10 ? '0' : ''}${month}-${date < 10 ? '0' : ''}${date}`;
  if (g === 'month') return `${year}-${month < 10 ? '0' : ''}${month}`;
  
  // Semana (Lunes de esa semana)
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
  const monday = new Date(d.setDate(diff));
  return `${monday.getFullYear()}-${monday.getMonth() + 1 < 10 ? '0' : ''}${monday.getMonth() + 1}-${monday.getDate() < 10 ? '0' : ''}${monday.getDate()}`;
};

export const SOURCE_PALETTE = ['#6366F1', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#3B82F6', '#14B8A6'];

export const getColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return SOURCE_PALETTE[Math.abs(hash) % SOURCE_PALETTE.length];
};

/**
 * Optimiza la lista de clientes crudos agregando propiedades calculadas pre-indexadas
 */
export const optimizeClients = (list: Client[]): OptimizedClient[] => {
  return list.map((c: any) => ({
    ...c,
    _tsAgenda: parseToTimestamp(c.fecha_agenda),
    _tsCreated: parseToTimestamp(c.created, 5),
    _isEnvio: hasLogisticsData(c),
    _normSearch: normalize(`${c.nombre || ''} ${c.modelo || ''} ${c.ciudad || ''} ${c.whatsapp || ''} ${c.agenda_ciudad_sede || ''}`),
    _normSede: normalize(c.agenda_ciudad_sede || ''),
    _normSource: (c.source || '').trim() || SOURCE_EMPTY,
    _uniqueId: String(c.whatsapp || c.row_number)
  }));
};

/**
 * Agrupa datos para las tres gráficas principales
 */
export const generateChartData = (
  data: OptimizedClient[],
  type: 'agendas' | 'created' | 'envios',
  granularity: Granularity,
  dateRange: { from: string, to: string }
) => {
  const ONE_DAY = 86400000;
  const groups = new Map<string, any>();
  const allKeys = new Set<string>();
  const tsFrom = dateRange.from ? parseToTimestamp(dateRange.from) : 0;
  const tsTo = dateRange.to ? parseToTimestamp(dateRange.to) + ONE_DAY - 1 : Infinity;

  // PROCESAMOS EL ARRAY COMPLETO (Sin límite artificial de 10000)
  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    let ts = 0;

    if (type === 'agendas') ts = c._tsAgenda;
    else if (type === 'created') ts = c._tsCreated;
    else if (type === 'envios') {
      if (!c._isEnvio) continue;
      ts = c._tsCreated; 
    }

    if (!ts || ts < tsFrom || ts > tsTo) continue;

    const key = getBucketKey(ts, granularity);
    if (!groups.has(key)) {
      groups.set(key, { key, label: key, total: 0, uniques: new Set() });
    }
    
    const bucket = groups.get(key);
    const src = c._normSource;
    allKeys.add(src);
    
    bucket[src] = (bucket[src] || 0) + 1;
    bucket.total++;
    bucket.uniques.add(c._uniqueId);
  }

  const result = Array.from(groups.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(b => {
      const uniqueCount = b.uniques.size;
      delete b.uniques;
      return { ...b, uniqueCount };
    });

  return { chartData: result, keys: Array.from(allKeys) };
};

export interface SourceEffectiveness {
  name: string;
  leads: number;
  agendas: number;
  envios: number;
  effAgenda: number;
  effEnvio: number;
}

export interface MonthGroup {
  month: string;
  sources: SourceEffectiveness[];
}

/**
 * Calcula la efectividad mensual de canales
 */
export const calculateEffectiveness = (
  filteredData: OptimizedClient[]
): MonthGroup[] => {
  const buckets = new Map<string, Map<string, { leads: number, agendas: number, envios: number }>>();

  // PROCESAMOS EL ARRAY COMPLETO (Sin límites)
  for (let i = 0; i < filteredData.length; i++) {
    const c = filteredData[i];
    if (!c._tsCreated) continue;
    const monthKey = getBucketKey(c._tsCreated, 'month'); 
    const src = c._normSource;

    if (!buckets.has(monthKey)) buckets.set(monthKey, new Map());
    const monthMap = buckets.get(monthKey)!;

    if (!monthMap.has(src)) monthMap.set(src, { leads: 0, agendas: 0, envios: 0 });
    const stats = monthMap.get(src)!;

    stats.leads += 1;
    if (c._tsAgenda > 0) stats.agendas += 1;
    if (c._isEnvio) stats.envios += 1;
  }

  return Array.from(buckets.entries())
    .sort((a, b) => b[0].localeCompare(a[0])) 
    .slice(0, 24) // Aumentado a 24 meses
    .map(([month, sourcesMap]) => ({
      month,
      sources: Array.from(sourcesMap.entries())
        .map(([name, data]) => ({ 
          name, 
          ...data, 
          effAgenda: data.leads > 0 ? (data.agendas / data.leads) * 100 : 0,
          effEnvio: data.leads > 0 ? (data.envios / data.leads) * 100 : 0
        }))
        .sort((a, b) => b.leads - a.leads) 
    }));
};
