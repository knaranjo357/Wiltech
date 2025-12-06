import React, { useEffect, useMemo, useState, useCallback, memo } from 'react';
import { RefreshCw, X, BarChart2, Filter, Search, Calendar, PieChart, Truck, TrendingUp, AlertCircle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Brush, Legend
} from 'recharts';

import { ClientService } from '../services/clientService';
import { Client } from '../types/client';
import { ClientModal } from '../components/ClientModal';
import { formatWhatsApp, getEtapaColor } from '../utils/clientHelpers';

/** 
 * ==============================================================================
 *  TIPOS Y UTILS
 * ==============================================================================
 */
interface OptimizedClient extends Client {
  // Originales
  source?: string | null;
  agenda_ciudad_sede?: string | null;
  modelo?: string | null;
  ciudad?: string | null;
  estado_etapa?: string;
  categoria_contacto?: string;
  
  // Optimizados
  _tsAgenda: number;      
  _tsCreated: number;     
  _isEnvio: boolean;      // Nueva bandera para envíos
  _normSearch: string;    
  _normSede: string;      
  _normSource: string;    
  _uniqueId: string;      
}

type Granularity = 'day' | 'week' | 'month';

// Paleta de colores
const SOURCE_PALETTE = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'];
const getColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return SOURCE_PALETTE[Math.abs(hash) % SOURCE_PALETTE.length];
};

const normalize = (v: any) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim();
const safeText = (v: any) => String(v || '').trim();
const SOURCE_EMPTY = 'Directo';

// Lógica de Envío (Replicada de EnviosPage)
const hasLogisticsData = (c: any): boolean => {
  const v1 = safeText(c.agenda_ciudad_sede);
  const v2 = safeText(c.guia_ciudad);
  const v3 = safeText(c.guia_direccion);
  const valid = v1 && v2 && v3 && v1 !== 'null' && v2 !== 'null' && v3 !== 'null';
  // También consideramos envío si tiene estado_envio explícito
  const explicit = c.estado_envio === 'envio_gestionado';
  return !!(valid || explicit);
};

const parseToTimestamp = (raw: any, offsetHours = 0): number => {
  if (!raw) return 0;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return 0;
  if (offsetHours) d.setTime(d.getTime() - offsetHours * 3600000);
  return d.getTime();
};

const ONE_DAY = 86400000;
const getBucketKey = (ts: number, g: Granularity): string => {
  if (ts === 0) return '';
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const date = d.getDate();
  
  if (g === 'day') return `${year}-${month < 10 ? '0' : ''}${month}-${date < 10 ? '0' : ''}${date}`;
  if (g === 'month') return `${year}-${month < 10 ? '0' : ''}${month}`;
  
  // Semana
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
  const monday = new Date(d.setDate(diff));
  return `${monday.getFullYear()}-${monday.getMonth() + 1}-${monday.getDate()}`;
};

/** 
 * ==============================================================================
 *  COMPONENTES VISUALES
 * ==============================================================================
 */

// 1. TOOLTIP PERSONALIZADO (Muestra Total)
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  // Calculamos el total sumando los valores de la pila actual
  const total = payload.reduce((sum: number, entry: any) => sum + (Number(entry.value) || 0), 0);

  return (
    <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-xl min-w-[180px]">
      <p className="font-bold text-gray-800 mb-2 border-b border-gray-100 pb-1">{label}</p>
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold text-gray-900">Total</span>
        <span className="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs">{total}</span>
      </div>
      <div className="space-y-1">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-gray-600 truncate max-w-[100px]">{entry.name}</span>
            </div>
            <span className="font-medium text-gray-700">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// 2. Componente de Gráfica
const HeavyChart = memo(({ data, keys, onBarClick, colorMap, title, subTitle }: any) => {
  if (!data || data.length === 0) return (
    <div className="h-full flex flex-col items-center justify-center text-gray-300 border rounded-3xl">
      <AlertCircle className="mb-2" />
      <span>Sin datos</span>
    </div>
  );

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 h-[380px] flex flex-col">
       <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-gray-800 text-sm md:text-base">{title}</h3>
          {subTitle && <span className="text-[10px] bg-gray-50 text-gray-500 px-2 py-1 rounded-md font-medium uppercase">{subTitle}</span>}
       </div>
       <div className="flex-1 min-h-0 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} dy={10} minTickGap={20} />
            <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
            
            {/* Usamos el Tooltip Personalizado */}
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} />
            
            <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
            {keys.map((k: string) => (
              <Bar
                key={k}
                dataKey={k}
                name={k === SOURCE_EMPTY ? 'Sin origen' : k}
                stackId="a"
                fill={colorMap[k] || '#CBD5E1'}
                radius={[0, 0, 0, 0]}
                onClick={(p) => onBarClick && onBarClick(p)}
                isAnimationActive={false} 
              />
            ))}
            <Brush dataKey="label" height={15} stroke="#CBD5E1" fill="#F8FAFC" tickFormatter={() => ''} />
          </BarChart>
        </ResponsiveContainer>
       </div>
    </div>
  );
}, (prev, next) => prev.data === next.data && prev.keys.length === next.keys.length);

// 3. Tarjeta KPI
const KPICard = memo(({ title, value, sub, icon: Icon, color }: any) => (
  <div className={`bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group`}>
    <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
       <Icon size={40} />
    </div>
    <div className="relative z-10">
      <div className="flex justify-between items-start mb-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
      <p className="text-[10px] text-gray-400 mt-1 font-medium">{sub}</p>
    </div>
  </div>
));

/** 
 * ==============================================================================
 *  COMPONENTE PRINCIPAL
 * ==============================================================================
 */

export const Resultados: React.FC = () => {
  const [rawData, setRawData] = useState<OptimizedClient[]>([]);
  const [isProcessing, setIsProcessing] = useState(true);
  
  // Filtros
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [sedeFilter, setSedeFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  // UI
  const [detailView, setDetailView] = useState<{ type: 'agendas' | 'created' | 'envios', key: string } | null>(null);
  const [modalClient, setModalClient] = useState<Client | null>(null);

  // --- 1. Carga Inicial ---
  useEffect(() => {
    const load = async () => {
      setIsProcessing(true);
      try {
        const data = await ClientService.getClients();
        const list = Array.isArray(data) ? data : [];
        
        const optimized: OptimizedClient[] = list.map((c: any) => ({
          ...c,
          _tsAgenda: parseToTimestamp(c.fecha_agenda),
          _tsCreated: parseToTimestamp(c.created, 5),
          _isEnvio: hasLogisticsData(c), // Calculamos si es un envío aquí
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

  // --- 2. Selectores ---
  const metaOptions = useMemo(() => {
    const sedes = new Set<string>();
    const sources = new Set<string>();
    rawData.forEach(c => {
      if (c.agenda_ciudad_sede && c._normSede !== 'no aplica') sedes.add(c.agenda_ciudad_sede);
      if (c._normSource) sources.add(c._normSource);
    });
    return {
      sedes: ['ALL', ...Array.from(sedes).sort()],
      sources: ['ALL', ...Array.from(sources).sort((a, b) => b.localeCompare(a))]
    };
  }, [rawData]);

  // --- 3. Filtro Global ---
  const filteredData = useMemo(() => {
    const tsFrom = dateRange.from ? parseToTimestamp(dateRange.from) : 0;
    const tsTo = dateRange.to ? parseToTimestamp(dateRange.to) + ONE_DAY - 1 : Infinity;
    const normSearch = normalize(searchText);
    const normSedeFilter = normalize(sedeFilter);
    const useSedeFilter = sedeFilter !== 'ALL';
    const useSourceFilter = sourceFilter !== 'ALL';

    return rawData.filter(c => {
      if (useSedeFilter && c._normSede !== normSedeFilter) return false;
      if (useSourceFilter && c._normSource !== sourceFilter) return false;
      if (normSearch && !c._normSearch.includes(normSearch)) return false;
      
      const inRangeAgenda = c._tsAgenda >= tsFrom && c._tsAgenda <= tsTo;
      const inRangeCreated = c._tsCreated >= tsFrom && c._tsCreated <= tsTo;
      
      return inRangeAgenda || inRangeCreated;
    });
  }, [rawData, sedeFilter, sourceFilter, searchText, dateRange]);

  // --- 4. Generador de Data para Gráficas ---
  const generateChartData = useCallback((data: OptimizedClient[], type: 'agendas' | 'created' | 'envios') => {
    const groups = new Map<string, any>();
    const allKeys = new Set<string>();
    const tsFrom = dateRange.from ? parseToTimestamp(dateRange.from) : 0;
    const tsTo = dateRange.to ? parseToTimestamp(dateRange.to) + ONE_DAY - 1 : Infinity;

    for (let i = 0; i < data.length; i++) {
      const c = data[i];
      let ts = 0;

      // Selector de campo fecha según tipo
      if (type === 'agendas') ts = c._tsAgenda;
      else if (type === 'created') ts = c._tsCreated;
      else if (type === 'envios') {
        // Para envios usamos created como fecha base de la solicitud, pero filtramos que SEA envío
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
      .map(b => ({ ...b, uniqueCount: b.uniques.size }));

    return { chartData: result, keys: Array.from(allKeys) };
  }, [granularity, dateRange]);

  const agendas = useMemo(() => generateChartData(filteredData, 'agendas'), [filteredData, generateChartData]);
  const creados = useMemo(() => generateChartData(filteredData, 'created'), [filteredData, generateChartData]);
  const envios = useMemo(() => generateChartData(filteredData, 'envios'), [filteredData, generateChartData]);

  // Colores consistentes
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    const allKeys = new Set([...agendas.keys, ...creados.keys, ...envios.keys]);
    allKeys.forEach(k => map[k] = getColor(k));
    return map;
  }, [agendas.keys, creados.keys, envios.keys]);

  // --- 5. Lógica de Efectividad Mensual ---
  const effectivenessData = useMemo(() => {
    const buckets = new Map<string, Map<string, { leads: number, agendas: number, envios: number }>>();

    filteredData.forEach(c => {
      // Usamos fecha de creación para agrupar el LEAD en el mes que llegó
      if (!c._tsCreated) return;
      const monthKey = getBucketKey(c._tsCreated, 'month'); // YYYY-MM
      const src = c._normSource;

      if (!buckets.has(monthKey)) buckets.set(monthKey, new Map());
      const monthMap = buckets.get(monthKey)!;

      if (!monthMap.has(src)) monthMap.set(src, { leads: 0, agendas: 0, envios: 0 });
      const stats = monthMap.get(src)!;

      stats.leads += 1;
      if (c._tsAgenda > 0) stats.agendas += 1;
      if (c._isEnvio) stats.envios += 1;
    });

    // Convertir a array ordenado por mes descendente
    return Array.from(buckets.entries())
      .sort((a, b) => b[0].localeCompare(a[0])) // Meses más recientes primero
      .map(([month, sourcesMap]) => ({
        month,
        sources: Array.from(sourcesMap.entries())
          .map(([name, data]) => ({ 
            name, 
            ...data, 
            effAgenda: (data.agendas / data.leads) * 100,
            effEnvio: (data.envios / data.leads) * 100
          }))
          .sort((a, b) => b.leads - a.leads) // Canales con más leads primero
      }));
  }, [filteredData]);

  // --- Render ---
  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 font-sans">
      
      {/* HEADER */}
      <div className="sticky top-4 z-30 px-4 md:px-8 mb-8">
        <div className="bg-white/90 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl p-4 md:p-5">
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-center">
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

            <div className="flex flex-wrap gap-3 w-full lg:w-auto justify-end">
              <div className="relative group w-full sm:w-40">
                 <select 
                   value={sedeFilter} onChange={e => setSedeFilter(e.target.value)}
                   className="w-full pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer font-medium text-gray-700"
                 >
                   {metaOptions.sedes.map(s => <option key={s} value={s}>{s === 'ALL' ? 'Todas las Sedes' : s}</option>)}
                 </select>
                 <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              <div className="flex bg-gray-50 border border-gray-200 rounded-xl overflow-hidden w-full sm:w-auto">
                 <input type="date" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} className="bg-transparent px-3 py-2 text-sm outline-none w-full sm:w-36 text-gray-600 font-medium" />
                 <div className="w-px bg-gray-300 my-2"></div>
                 <input type="date" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} className="bg-transparent px-3 py-2 text-sm outline-none w-full sm:w-36 text-gray-600 font-medium" />
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  placeholder="Buscar cliente..." 
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 space-y-6 animate-in fade-in duration-500">
        {isProcessing ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400 gap-3">
            <RefreshCw className="animate-spin" />
            <p>Procesando datos...</p>
          </div>
        ) : (
          <>
            {/* 1. KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard 
                title="Leads (Creados)" 
                value={creados.chartData.reduce((a, b) => a + b.total, 0)} 
                sub={`${creados.chartData.reduce((a, b) => a + b.uniqueCount, 0)} únicos`}
                icon={PieChart}
                color="text-blue-500"
              />
              <KPICard 
                title="Citas Agendadas" 
                value={agendas.chartData.reduce((a, b) => a + b.total, 0)} 
                sub={`${agendas.chartData.reduce((a, b) => a + b.uniqueCount, 0)} únicos`}
                icon={Calendar} 
                color="text-purple-500"
              />
              <KPICard 
                title="Envíos Generados" 
                value={envios.chartData.reduce((a, b) => a + b.total, 0)} 
                sub={`${envios.chartData.reduce((a, b) => a + b.uniqueCount, 0)} únicos`}
                icon={Truck} 
                color="text-orange-500"
              />
              {/* Filtro Rápido Source */}
              <div className="col-span-1 bg-white rounded-2xl border border-gray-100 p-4 flex flex-col justify-center">
                 <span className="text-xs font-semibold text-gray-400 uppercase mb-2">Canal (Source)</span>
                 <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto scrollbar-hide">
                    {metaOptions.sources.map(s => (
                      <button key={s} onClick={() => setSourceFilter(s)} className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all flex items-center gap-1.5 ${sourceFilter === s ? 'bg-gray-800 text-white border-gray-800' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                        {s !== 'ALL' && <span className="w-1.5 h-1.5 rounded-full" style={{ background: colorMap[s] }} />}
                        {s === 'ALL' ? 'Todos' : s}
                      </button>
                    ))}
                 </div>
              </div>
            </div>

            {/* 2. GRÁFICAS TEMPORALES */}
            <div className="grid lg:grid-cols-3 gap-6">
              <HeavyChart title="Leads Nuevos" subTitle="Fecha Creación" data={creados.chartData} keys={creados.keys} colorMap={colorMap} onBarClick={(d: any) => handleBarClick(d, 'created')} />
              <HeavyChart title="Agendamientos" subTitle="Fecha Cita" data={agendas.chartData} keys={agendas.keys} colorMap={colorMap} onBarClick={(d: any) => handleBarClick(d, 'agendas')} />
              <HeavyChart title="Logística / Envíos" subTitle="Fecha Solicitud" data={envios.chartData} keys={envios.keys} colorMap={colorMap} onBarClick={(d: any) => handleBarClick(d, 'envios')} />
            </div>

            {/* 3. MATRIZ DE EFECTIVIDAD (CHANNEL EFFECTIVENESS) */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
               <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><TrendingUp size={20} /></div>
                  <div>
                    <h3 className="font-bold text-gray-900">Efectividad por Canal</h3>
                    <p className="text-xs text-gray-500">Comparativa mensual de conversión (Leads → Agendas / Envíos)</p>
                  </div>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                   <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-semibold">
                     <tr>
                       <th className="px-6 py-4">Mes</th>
                       <th className="px-6 py-4">Canal</th>
                       <th className="px-6 py-4 text-center">Total Leads</th>
                       <th className="px-6 py-4 w-1/3">Conversión Agenda</th>
                       <th className="px-6 py-4 w-1/3">Conversión Envíos</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                     {effectivenessData.map((monthGroup) => (
                       <React.Fragment key={monthGroup.month}>
                         {monthGroup.sources.map((src, idx) => (
                           <tr key={`${monthGroup.month}-${src.name}`} className="hover:bg-gray-50/50 transition-colors group">
                             {/* Mostrar mes solo en la primera fila del grupo */}
                             {idx === 0 && (
                               <td rowSpan={monthGroup.sources.length} className="px-6 py-4 font-bold text-gray-800 align-top border-r border-gray-100 bg-gray-50/30 w-32">
                                 {monthGroup.month}
                               </td>
                             )}
                             <td className="px-6 py-3 font-medium text-gray-700 flex items-center gap-2">
                               <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorMap[src.name] || '#ccc' }} />
                               {src.name === SOURCE_EMPTY ? 'Sin origen' : src.name}
                             </td>
                             <td className="px-6 py-3 text-center">
                               <span className="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-xs font-bold min-w-[3rem]">
                                 {src.leads}
                               </span>
                             </td>
                             <td className="px-6 py-3">
                               <div className="flex items-center gap-3">
                                 <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                   <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(src.effAgenda, 100)}%` }} />
                                 </div>
                                 <span className="text-xs font-bold text-purple-700 w-12 text-right">{src.effAgenda.toFixed(1)}%</span>
                               </div>
                               <div className="text-[10px] text-gray-400 mt-0.5">{src.agendas} agendas</div>
                             </td>
                             <td className="px-6 py-3">
                               <div className="flex items-center gap-3">
                                 <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                   <div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.min(src.effEnvio, 100)}%` }} />
                                 </div>
                                 <span className="text-xs font-bold text-orange-700 w-12 text-right">{src.effEnvio.toFixed(1)}%</span>
                               </div>
                               <div className="text-[10px] text-gray-400 mt-0.5">{src.envios} envíos</div>
                             </td>
                           </tr>
                         ))}
                         {/* Separador de meses */}
                         {effectivenessData.length > 1 && (
                           <tr className="bg-gray-50/50 h-2 border-t border-b border-gray-200"><td colSpan={5}></td></tr>
                         )}
                       </React.Fragment>
                     ))}
                   </tbody>
                 </table>
                 {effectivenessData.length === 0 && (
                   <div className="p-10 text-center text-gray-400">No hay datos suficientes para calcular efectividad.</div>
                 )}
               </div>
            </div>

          </>
        )}
      </div>

      {/* DRAWER DETALLES */}
      {detailView && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20 backdrop-blur-sm p-0 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50/80 backdrop-blur-sm">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  {detailView.type === 'agendas' ? '📅 Agendas' : detailView.type === 'envios' ? '🚚 Envíos' : '🆕 Creados'} <span className="text-gray-400">|</span> <span className="text-blue-600">{detailView.key}</span>
                </h2>
                <p className="text-xs text-gray-500 mt-1">Registros correspondientes a la selección</p>
              </div>
              <button onClick={() => setDetailView(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              <div className="space-y-2">
                {filteredData
                  .filter(c => {
                    let ts = 0;
                    if (detailView.type === 'agendas') ts = c._tsAgenda;
                    else if (detailView.type === 'created') ts = c._tsCreated;
                    else if (detailView.type === 'envios' && c._isEnvio) ts = c._tsCreated;
                    return getBucketKey(ts, granularity) === detailView.key;
                  })
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edición */}
      <ClientModal 
        isOpen={!!modalClient} 
        onClose={() => setModalClient(null)} 
        client={modalClient} 
        onUpdate={async () => { setModalClient(null); window.location.reload(); return true; }} 
      />
    </div>
  );
};

export default Resultados;