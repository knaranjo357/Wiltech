import React, { useEffect, useMemo, useState, useCallback, memo } from 'react';
import { RefreshCw, X, Phone, Clock, BarChart2, Filter, Search, Calendar, ChevronDown, PieChart } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Brush, Legend
} from 'recharts';

import { ClientService } from '../services/clientService';
import { Client } from '../types/client';
import { ClientModal } from '../components/ClientModal';
import { formatWhatsApp, getEtapaColor, getCategoriaColor } from '../utils/clientHelpers';

/** 
 * ==============================================================================
 *  1. OPTIMIZACIÓN DE TIPOS Y ESTRUCTURAS
 *  Usamos números (timestamps) en lugar de objetos Date para velocidad extrema.
 * ==============================================================================
 */
interface OptimizedClient extends Client {
  // Campos originales (para mostrar)
  source?: string | null;
  agenda_ciudad_sede?: string | null;
  modelo?: string | null;
  ciudad?: string | null;
  intencion?: string | null;
  estado_etapa?: string;
  categoria_contacto?: string;
  
  // Campos PRE-CALCULADOS (para filtrar a velocidad luz)
  _tsAgenda: number;      // Timestamp fecha agenda (0 si no existe)
  _tsCreated: number;     // Timestamp fecha creación (0 si no existe)
  _normSearch: string;    // String gigante con todo el texto buscable en minúsculas
  _normSede: string;      // Sede normalizada
  _normSource: string;    // Source normalizado
  _uniqueId: string;      // ID único pre-calculado
}

type Granularity = 'day' | 'week' | 'month';

/** ================== UTILS ULTRA-RÁPIDOS ================== */
// Paleta pre-calculada para no calcular hash en cada render
const SOURCE_PALETTE = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'];
const getColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return SOURCE_PALETTE[Math.abs(hash) % SOURCE_PALETTE.length];
};

const normalize = (v: any) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim();
const SOURCE_EMPTY = 'Directo';

// Parseo seguro y rápido
const parseToTimestamp = (raw: any, offsetHours = 0): number => {
  if (!raw) return 0;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return 0;
  if (offsetHours) d.setTime(d.getTime() - offsetHours * 3600000);
  return d.getTime();
};

// Helpers de Fechas (operaciones matemáticas son más rápidas que new Date en bucles)
const ONE_DAY = 86400000;
const getBucketKey = (ts: number, g: Granularity): string => {
  if (ts === 0) return '';
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const date = d.getDate();
  
  if (g === 'day') return `${year}-${month < 10 ? '0' : ''}${month}-${date < 10 ? '0' : ''}${date}`;
  if (g === 'month') return `${year}-${month < 10 ? '0' : ''}${month}`;
  
  // Semana: Truco matemático para obtener lunes
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
  const monday = new Date(d.setDate(diff));
  return `${monday.getFullYear()}-${monday.getMonth() + 1}-${monday.getDate()}`; // Clave simple
};

/** 
 * ==============================================================================
 *  2. COMPONENTES MEMOIZADOS (Para evitar re-renders masivos)
 * ==============================================================================
 */

// Componente de Gráfica Aislado
const HeavyChart = memo(({ data, keys, onBarClick, colorMap }: any) => {
  if (!data || data.length === 0) return <div className="h-full flex items-center justify-center text-gray-400">Sin datos para mostrar</div>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} dy={10} />
        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: '#F1F5F9' }}
          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
          itemStyle={{ fontSize: '12px', padding: 0 }}
          labelStyle={{ fontWeight: 'bold', color: '#1E293B', marginBottom: '8px' }}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
        {keys.map((k: string) => (
          <Bar
            key={k}
            dataKey={k}
            name={k === SOURCE_EMPTY ? 'Sin origen' : k}
            stackId="a"
            fill={colorMap[k] || '#CBD5E1'}
            radius={[2, 2, 0, 0]} // Solo redondear arriba
            onClick={(p) => onBarClick && onBarClick(p)}
            isAnimationActive={false} // Desactivar animación para sentirlo más 'snappy' al filtrar
          />
        ))}
        <Brush dataKey="label" height={20} stroke="#CBD5E1" fill="#F8FAFC" />
      </BarChart>
    </ResponsiveContainer>
  );
}, (prev, next) => prev.data === next.data && prev.keys.length === next.keys.length); // Comparación custom rápida

// Componente KPI Aislado
const KPICard = memo(({ title, value, sub, icon: Icon }: any) => (
  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all">
    <div className="flex justify-between items-start mb-2">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
        <Icon size={18} />
      </div>
    </div>
    <p className="text-3xl font-bold text-gray-900 tracking-tight">{value}</p>
    <p className="text-xs text-gray-400 mt-1 font-medium">{sub}</p>
  </div>
));

/** 
 * ==============================================================================
 *  3. COMPONENTE PRINCIPAL
 * ==============================================================================
 */

export const Resultados: React.FC = () => {
  // --- Estado Datos ---
  const [rawData, setRawData] = useState<OptimizedClient[]>([]);
  const [isProcessing, setIsProcessing] = useState(true);
  
  // --- Filtros ---
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [sedeFilter, setSedeFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  // --- UI ---
  const [detailView, setDetailView] = useState<{ type: 'agendas' | 'created', key: string } | null>(null);
  const [modalClient, setModalClient] = useState<Client | null>(null);

  // --- 1. Carga Inicial y Pre-Procesamiento (Heavy Lifting done ONCE) ---
  useEffect(() => {
    const load = async () => {
      setIsProcessing(true);
      try {
        const data = await ClientService.getClients();
        const list = Array.isArray(data) ? data : [];
        
        // Optimizacion: Mapear a estructura optimizada en un solo paso
        const optimized: OptimizedClient[] = list.map((c: any) => ({
          ...c,
          // Pre-calcular timestamps
          _tsAgenda: parseToTimestamp(c.fecha_agenda),
          _tsCreated: parseToTimestamp(c.created, 5), // -5 UTC correction
          // Pre-normalizar strings para búsqueda
          _normSearch: normalize(`${c.nombre} ${c.modelo} ${c.ciudad} ${c.whatsapp} ${c.agenda_ciudad_sede}`),
          _normSede: normalize(c.agenda_ciudad_sede),
          _normSource: (c.source || '').trim() || SOURCE_EMPTY,
          _uniqueId: String(c.whatsapp || c.row_number)
        }));
        
        setRawData(optimized);
      } catch (e) {
        console.error("Error loading", e);
      } finally {
        setIsProcessing(false);
      }
    };
    load();
  }, []);

  // --- 2. Selectores Derivados (Sedes y Sources únicos) ---
  const metaOptions = useMemo(() => {
    const sedes = new Set<string>();
    const sources = new Set<string>();
    rawData.forEach(c => {
      if (c.agenda_ciudad_sede && c._normSede !== 'no aplica') sedes.add(c.agenda_ciudad_sede);
      if (c._normSource) sources.add(c._normSource);
    });
    return {
      sedes: ['ALL', ...Array.from(sedes).sort()],
      sources: ['ALL', ...Array.from(sources).sort((a, b) => b.localeCompare(a))] // Ordenar sources
    };
  }, [rawData]);

  // --- 3. El Filtro Ultra-Rápido (Memoizado) ---
  const filteredData = useMemo(() => {
    // Convertir fechas de filtro a timestamps una sola vez
    const tsFrom = dateRange.from ? parseToTimestamp(dateRange.from) : 0;
    const tsTo = dateRange.to ? parseToTimestamp(dateRange.to) + ONE_DAY - 1 : Infinity; // Final del día
    const normSearch = normalize(searchText);
    const normSedeFilter = normalize(sedeFilter);
    const useSedeFilter = sedeFilter !== 'ALL';
    const useSourceFilter = sourceFilter !== 'ALL';

    // Filtrado lineal O(N) usando primitivos
    return rawData.filter(c => {
      if (useSedeFilter && c._normSede !== normSedeFilter) return false;
      if (useSourceFilter && c._normSource !== sourceFilter) return false;
      if (normSearch && !c._normSearch.includes(normSearch)) return false;
      
      // Pre-chequeo de rango fecha (si alguna de las dos fechas cae en rango, el cliente es relevante para los graficos globales, 
      // luego dentro de la grafica se filtra especificamente por tipo)
      const inRangeAgenda = c._tsAgenda >= tsFrom && c._tsAgenda <= tsTo;
      const inRangeCreated = c._tsCreated >= tsFrom && c._tsCreated <= tsTo;
      
      return inRangeAgenda || inRangeCreated;
    });
  }, [rawData, sedeFilter, sourceFilter, searchText, dateRange]);

  // --- 4. Generador de Gráficas (Optimizado) ---
  const generateChartData = useCallback((data: OptimizedClient[], field: '_tsAgenda' | '_tsCreated') => {
    const groups = new Map<string, any>();
    const allKeys = new Set<string>();
    const tsFrom = dateRange.from ? parseToTimestamp(dateRange.from) : 0;
    const tsTo = dateRange.to ? parseToTimestamp(dateRange.to) + ONE_DAY - 1 : Infinity;

    for (let i = 0; i < data.length; i++) {
      const c = data[i];
      const ts = c[field];
      if (!ts || ts < tsFrom || ts > tsTo) continue;

      const key = getBucketKey(ts, granularity);
      if (!groups.has(key)) {
        groups.set(key, { key, label: key, total: 0, uniques: new Set() });
      }
      
      const bucket = groups.get(key);
      const src = c._normSource;
      allKeys.add(src);
      
      // Incrementar contador dinámico por source
      bucket[src] = (bucket[src] || 0) + 1;
      bucket.total++;
      bucket.uniques.add(c._uniqueId);
    }

    // Convertir Map a Array ordenado
    const result = Array.from(groups.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(b => ({ ...b, uniqueCount: b.uniques.size })); // Materializar tamaño del set

    return { chartData: result, keys: Array.from(allKeys) };
  }, [granularity, dateRange]);

  // Memoizamos los datos de las gráficas
  const agendas = useMemo(() => generateChartData(filteredData, '_tsAgenda'), [filteredData, generateChartData]);
  const creados = useMemo(() => generateChartData(filteredData, '_tsCreated'), [filteredData, generateChartData]);

  // Mapa de colores consistente
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    [...agendas.keys, ...creados.keys].forEach(k => {
      map[k] = getColor(k);
    });
    return map;
  }, [agendas.keys, creados.keys]);

  // --- Handlers UI ---
  const handleBarClick = useCallback((data: any, type: 'agendas' | 'created') => {
    if (data && data.key) setDetailView({ type, key: data.key });
  }, []);

  // --- Render ---
  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 font-sans">
      
      {/* === HEADER FLOTANTE (Glassmorphism optimizado) === */}
      <div className="sticky top-4 z-30 px-4 md:px-8 mb-8">
        <div className="bg-white/90 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl p-4 md:p-5">
          
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-center">
            {/* Titulo y Granularidad */}
            <div className="flex items-center gap-4 w-full lg:w-auto">
              <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-200 text-white">
                <BarChart2 size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
                <div className="flex gap-1 mt-1 bg-gray-100/50 p-1 rounded-lg w-fit">
                  {['day', 'week', 'month'].map((g) => (
                    <button
                      key={g}
                      onClick={() => setGranularity(g as Granularity)}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${granularity === g ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {g === 'day' ? 'Día' : g === 'week' ? 'Semana' : 'Mes'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Filtros Compactos */}
            <div className="flex flex-wrap gap-3 w-full lg:w-auto justify-end">
              {/* Sede */}
              <div className="relative group w-full sm:w-40">
                 <select 
                   value={sedeFilter} onChange={e => setSedeFilter(e.target.value)}
                   className="w-full pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer font-medium text-gray-700"
                 >
                   {metaOptions.sedes.map(s => <option key={s} value={s}>{s === 'ALL' ? 'Todas las Sedes' : s}</option>)}
                 </select>
                 <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Fechas */}
              <div className="flex bg-gray-50 border border-gray-200 rounded-xl overflow-hidden w-full sm:w-auto">
                 <input type="date" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} className="bg-transparent px-3 py-2 text-sm outline-none w-full sm:w-36 text-gray-600 font-medium" />
                 <div className="w-px bg-gray-300 my-2"></div>
                 <input type="date" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} className="bg-transparent px-3 py-2 text-sm outline-none w-full sm:w-36 text-gray-600 font-medium" />
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  placeholder="Buscar cliente, teléfono..." 
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === CONTENIDO === */}
      <div className="px-4 md:px-8 space-y-6 animate-in fade-in duration-500">
        
        {isProcessing ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400 gap-3">
            <RefreshCw className="animate-spin" />
            <p>Procesando datos...</p>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard 
                title="Total Agendas" 
                value={agendas.chartData.reduce((a, b) => a + b.total, 0)} 
                sub={`${agendas.chartData.reduce((a, b) => a + b.uniqueCount, 0)} únicos`}
                icon={Calendar} 
              />
              <KPICard 
                title="Total Creados" 
                value={creados.chartData.reduce((a, b) => a + b.total, 0)} 
                sub={`${creados.chartData.reduce((a, b) => a + b.uniqueCount, 0)} únicos`}
                icon={PieChart} 
              />
              {/* Source Pill Selector */}
              <div className="col-span-1 sm:col-span-2 bg-white rounded-2xl border border-gray-100 p-4 flex flex-col justify-center">
                 <span className="text-xs font-semibold text-gray-400 uppercase mb-2">Filtrar por Canal (Source)</span>
                 <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto scrollbar-hide">
                    {metaOptions.sources.map(s => (
                      <button
                        key={s}
                        onClick={() => setSourceFilter(s)}
                        className={`px-2 py-1 rounded-md text-xs border transition-all flex items-center gap-2 ${sourceFilter === s ? 'bg-gray-800 text-white border-gray-800' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                      >
                        {s !== 'ALL' && <span className="w-2 h-2 rounded-full" style={{ background: colorMap[s] }} />}
                        {s === 'ALL' ? 'Todos' : s}
                      </button>
                    ))}
                 </div>
              </div>
            </div>

            {/* GRAFICAS LADO A LADO */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 h-[400px] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-800">Agendamientos</h3>
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-md font-medium">Por fecha cita</span>
                </div>
                <div className="flex-1 min-h-0">
                   <HeavyChart data={agendas.chartData} keys={agendas.keys} colorMap={colorMap} onBarClick={(d: any) => handleBarClick(d, 'agendas')} />
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 h-[400px] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-800">Clientes Nuevos</h3>
                  <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded-md font-medium">Por fecha creación</span>
                </div>
                <div className="flex-1 min-h-0">
                   <HeavyChart data={creados.chartData} keys={creados.keys} colorMap={colorMap} onBarClick={(d: any) => handleBarClick(d, 'created')} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* === DETALLE DRAWER (Optimizado con lista virtual si fuera necesario, aqui paginado visualmente) === */}
      {detailView && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20 backdrop-blur-sm p-0 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
            
            <div className="p-5 border-b flex justify-between items-center bg-gray-50/80 backdrop-blur-sm">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  {detailView.type === 'agendas' ? '📅 Agendas' : '🆕 Creados'} del <span className="text-blue-600">{detailView.key}</span>
                </h2>
                <p className="text-xs text-gray-500 mt-1">Mostrando registros filtrados</p>
              </div>
              <button onClick={() => setDetailView(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              <div className="space-y-2">
                {filteredData
                  .filter(c => {
                    const ts = detailView.type === 'agendas' ? c._tsAgenda : c._tsCreated;
                    return getBucketKey(ts, granularity) === detailView.key;
                  })
                  // Limitamos a mostrar 50 items para mantener el DOM ligero
                  .slice(0, 50) 
                  .map(client => (
                    <div 
                      key={client.row_number}
                      onClick={() => setModalClient(client)}
                      className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex justify-between items-center group"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                           <h4 className="font-bold text-gray-800 group-hover:text-blue-600">{client.nombre || 'Sin Nombre'}</h4>
                           {client.agenda_ciudad_sede && <span className="text-[10px] px-2 py-0.5 bg-gray-100 rounded text-gray-500 border">{client.agenda_ciudad_sede}</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex gap-3">
                          <span>{client.modelo}</span>
                          <span>•</span>
                          <span>{formatWhatsApp(client.whatsapp as any)}</span>
                          <span>•</span>
                          <span className="text-blue-600 font-medium">{client._normSource}</span>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getEtapaColor(client.estado_etapa as any)}`}>
                        {(client.estado_etapa || 'N/A').replace(/_/g, ' ')}
                      </div>
                    </div>
                  ))
                }
                <div className="text-center text-xs text-gray-400 pt-4 pb-8">
                   Mostrando los primeros 50 resultados para optimizar rendimiento
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edición */}
      <ClientModal 
        isOpen={!!modalClient} 
        onClose={() => setModalClient(null)} 
        client={modalClient} 
        onUpdate={async (p) => {
          // Optimistic update logic here (omitted for brevity but same as before)
          setModalClient(null);
          window.location.reload(); // Simple refresh to re-fetch data
          return true;
        }} 
      />
    </div>
  );
};

export default Resultados;