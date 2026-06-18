import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { RefreshCw, BarChart2, Calendar } from 'lucide-react';
import { KPICards } from './components/KPICards';
import { getColor, MonthGroup } from './utils/dataProcessor';
import { ApiService } from '../../services/apiService';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';
import {
  AlertCircle, PieChart, Truck, TrendingUp, TrendingDown,
  Users, CalendarCheck,
} from 'lucide-react';

// ── Tipos de la API ──────────────────────────────────────────────────────────
interface ApiChartEntry {
  label: string;
  total: number;
  uniqueCount: number;
  [key: string]: number | string;
}
interface ApiSection { keys: string[]; chartData: ApiChartEntry[]; }
interface ApiResponse { envios: ApiSection; agendas: ApiSection; creados: ApiSection; }

type Granularity = 'day' | 'week' | 'month';

// ── Constantes de rendimiento ────────────────────────────────────────────────
const MAX_BARS     = 60;
const MAX_CHANNELS = 8;
const OTROS_KEY    = 'Otros';
const SKIP_FIELDS  = new Set(['label', 'total', 'uniqueCount']);

// ── Agrupación ───────────────────────────────────────────────────────────────
const getGroupKey = (label: string, g: Granularity): string => {
  if (g === 'day') return label;
  const d = new Date(label + 'T00:00:00');
  if (isNaN(d.getTime())) return label;
  if (g === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const tmp = new Date(d);
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
  const ys = new Date(tmp.getFullYear(), 0, 1);
  const week = Math.ceil((((tmp as any) - (ys as any)) / 86400000 + 1) / 7);
  return `${tmp.getFullYear()}-W${String(week).padStart(2, '0')}`;
};

const groupChartData = (data: ApiChartEntry[], g: Granularity): ApiChartEntry[] => {
  if (g === 'day') return data;
  const map = new Map<string, ApiChartEntry>();
  for (const entry of data) {
    const key = getGroupKey(entry.label, g);
    if (!map.has(key)) map.set(key, { label: key, total: 0, uniqueCount: 0 });
    const acc = map.get(key)!;
    for (const [k, v] of Object.entries(entry)) {
      if (k === 'label') continue;
      acc[k] = ((acc[k] as number) || 0) + (Number(v) || 0);
    }
  }
  return Array.from(map.values());
};

const filterByDate = (data: ApiChartEntry[], from: string, to: string): ApiChartEntry[] => {
  if (!from && !to) return data;
  return data.filter(e => (!from || e.label >= from) && (!to || e.label <= to));
};

const slimData = (data: ApiChartEntry[], allKeys: string[]): { data: ApiChartEntry[]; keys: string[] } => {
  const sliced = data.slice(-MAX_BARS);
  const totals: Record<string, number> = {};
  for (const entry of sliced)
    for (const k of allKeys) totals[k] = (totals[k] || 0) + (Number(entry[k]) || 0);
  const sorted  = allKeys.slice().sort((a, b) => (totals[b] || 0) - (totals[a] || 0));
  const top     = sorted.slice(0, MAX_CHANNELS);
  const rest    = sorted.slice(MAX_CHANNELS);
  const hasOtros = rest.length > 0;
  const outData = sliced.map(entry => {
    const row: ApiChartEntry = { label: entry.label, total: entry.total, uniqueCount: entry.uniqueCount };
    for (const k of top) row[k] = Number(entry[k]) || 0;
    if (hasOtros) row[OTROS_KEY] = rest.reduce((s, k) => s + (Number(entry[k]) || 0), 0);
    return row;
  });
  return { data: outData, keys: hasOtros ? [...top, OTROS_KEY] : top };
};

// ── Reporte mensual ──────────────────────────────────────────────────────────
interface MonthStat { total: number; upToToday: number; }
interface MonthReport {
  currentMonth: string;
  prevMonth: string;
  todayDay: number;
  leads:   { cur: MonthStat; prev: MonthStat };
  agendas: { cur: MonthStat; prev: MonthStat };
  envios:  { cur: MonthStat; prev: MonthStat };
}

const getPrevMonth = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

const monthStat = (data: ApiChartEntry[], ym: string, todayDay: number): MonthStat => {
  const entries = data.filter(e => String(e.label).startsWith(ym));
  const total   = entries.reduce((s, e) => s + Number(e.total), 0);
  const upToToday = entries
    .filter(e => parseInt(String(e.label).split('-')[2] || '0', 10) <= todayDay)
    .reduce((s, e) => s + Number(e.total), 0);
  return { total, upToToday };
};

const MONTH_NAMES: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo',  '06': 'Junio',   '07': 'Julio', '08': 'Agosto',
  '09': 'Sep.',  '10': 'Oct.',    '11': 'Nov.',  '12': 'Dic.',
};
const fmtMonth = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES[m] || m} ${y}`;
};

const buildMonthReport = (
  creados: ApiChartEntry[], agendas: ApiChartEntry[], envios: ApiChartEntry[]
): MonthReport => {
  const now      = new Date();
  const todayDay = now.getDate();
  const curYM    = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevYM   = getPrevMonth(curYM);
  return {
    currentMonth: curYM, prevMonth: prevYM, todayDay,
    leads:   { cur: monthStat(creados, curYM, todayDay), prev: monthStat(creados, prevYM, todayDay) },
    agendas: { cur: monthStat(agendas, curYM, todayDay), prev: monthStat(agendas, prevYM, todayDay) },
    envios:  { cur: monthStat(envios,  curYM, todayDay), prev: monthStat(envios,  prevYM, todayDay) },
  };
};

// ── Efectividad ──────────────────────────────────────────────────────────────
const buildEffectiveness = (
  creados: ApiChartEntry[], agendas: ApiChartEntry[], envios: ApiChartEntry[]
): MonthGroup[] => {
  const monthMap = new Map<string, { leads: Record<string, number>; ags: Record<string, number>; envs: Record<string, number> }>();
  const addToMap = (entries: ApiChartEntry[], field: 'leads' | 'ags' | 'envs') => {
    for (const entry of entries) {
      const month = String(entry.label).slice(0, 7);
      if (!monthMap.has(month)) monthMap.set(month, { leads: {}, ags: {}, envs: {} });
      const acc = monthMap.get(month)!;
      for (const [k, v] of Object.entries(entry)) {
        if (SKIP_FIELDS.has(k)) continue;
        acc[field][k] = (acc[field][k] || 0) + (Number(v) || 0);
      }
    }
  };
  addToMap(creados, 'leads');
  addToMap(agendas, 'ags');
  addToMap(envios,  'envs');
  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { leads, ags, envs }]) => {
      const allKeys = new Set([...Object.keys(leads), ...Object.keys(ags), ...Object.keys(envs)]);
      return {
        month,
        sources: Array.from(allKeys).map(name => {
          const l = leads[name] || 0, a = ags[name] || 0, e = envs[name] || 0;
          return { name, leads: l, agendas: a, envios: e,
            effAgenda: l > 0 ? (a / l) * 100 : 0,
            effEnvio:  l > 0 ? (e / l) * 100 : 0 };
        }),
      };
    });
};

// ── Tooltip ──────────────────────────────────────────────────────────────────
const SimpleTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0);
  return (
    <div className="bg-white border border-gray-100 shadow-xl rounded-xl p-3 min-w-[160px] z-50">
      <p className="font-bold text-gray-700 text-xs mb-1 border-b pb-1">{label}</p>
      <p className="text-xs font-bold text-gray-900 mb-1">Total: {total.toLocaleString()}</p>
      {payload.slice(0, 8).map((e: any, i: number) => (
        <div key={i} className="flex justify-between text-[11px] gap-3">
          <span className="flex items-center gap-1 text-gray-500">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
            {e.name}
          </span>
          <span className="font-medium text-gray-800">{Number(e.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

// ── ChartCard ────────────────────────────────────────────────────────────────
interface ChartCardProps {
  title: string; subtitle: string; icon: React.ElementType;
  data: ApiChartEntry[]; keys: string[]; colorMap: Record<string, string>;
}
const ChartCard: React.FC<ChartCardProps> = ({ title, subtitle, icon: Icon, data, keys, colorMap }) => {
  const grandTotal = data.reduce((s, e) => s + Number(e.total), 0);
  if (!data.length) return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col items-center justify-center h-[360px] text-gray-300">
      <AlertCircle className="w-8 h-8 mb-2 opacity-30" /><span className="text-sm">Sin datos</span>
    </div>
  );
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col h-[360px]">
      <div className="flex justify-between items-start mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gray-50 rounded-lg text-gray-400"><Icon size={16} /></div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm leading-tight">{title}</h3>
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">{subtitle}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-gray-900">{grandTotal.toLocaleString()}</p>
          <p className="text-[10px] text-gray-400">{data.length} periodos</p>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false} dy={6} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
            <Tooltip content={<SimpleTooltip />} cursor={{ fill: '#F8FAFC' }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', paddingTop: '8px', color: '#64748B' }} />
            {keys.map(k => (
              <Bar key={k} dataKey={k} name={k} stackId="a"
                fill={k === OTROS_KEY ? '#CBD5E1' : (colorMap[k] || getColor(k))}
                isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ── MonthlyReport ────────────────────────────────────────────────────────────
const pct = (cur: number, prev: number) =>
  prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);

interface StatCardProps {
  label: string; icon: React.ElementType; iconBg: string; iconText: string;
  curTotal: number; prevTotal: number; curUpTo: number; prevUpTo: number;
  todayDay: number; curMonth: string; prevMonth: string;
}
const StatCard: React.FC<StatCardProps> = ({
  label, icon: Icon, iconBg, iconText,
  curTotal, prevTotal, curUpTo, prevUpTo,
  todayDay, curMonth, prevMonth,
}) => {
  const diff   = pct(curUpTo, prevUpTo);
  const isUp   = diff >= 0;
  const barPct = prevUpTo > 0 ? Math.min(100, (curUpTo / prevUpTo) * 100) : 100;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`p-2.5 rounded-xl ${iconBg}`}>
            <Icon size={16} className={iconText} />
          </div>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</span>
        </div>
        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
          isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
        }`}>
          {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {isUp ? '+' : ''}{diff}%
        </div>
      </div>

      {/* Número grande */}
      <div>
        <p className="text-4xl font-extrabold text-gray-900 tracking-tight leading-none tabular-nums">
          {curUpTo.toLocaleString()}
        </p>
        <p className="text-[11px] text-gray-400 mt-1.5">
          Hasta el <span className="font-semibold text-gray-600">día {todayDay}</span> de {fmtMonth(curMonth)}
        </p>
      </div>

      {/* Barra progreso */}
      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-1.5">
          <span>vs {fmtMonth(prevMonth)} (mismo día)</span>
          <span className="font-semibold text-gray-600">{prevUpTo.toLocaleString()}</span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${isUp ? 'bg-emerald-400' : 'bg-red-400'}`}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>

      {/* Totales del mes completo */}
      <div className="flex justify-between pt-3 border-t border-gray-50">
        <div>
          <p className="text-[10px] text-gray-400 mb-0.5">Total {fmtMonth(curMonth)}</p>
          <p className="text-sm font-bold text-gray-800">{curTotal.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-400 mb-0.5">Total {fmtMonth(prevMonth)}</p>
          <p className="text-sm font-bold text-gray-400">{prevTotal.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};

const MonthlyReport: React.FC<{ report: MonthReport }> = ({ report }) => {
  const { currentMonth, prevMonth, todayDay, leads, agendas, envios } = report;
  const diffLeads = pct(leads.cur.upToToday, leads.prev.upToToday);
  const isUp      = diffLeads >= 0;
  const summaryTxt = isUp
    ? `Este mes llevas <b>+${diffLeads}%</b> más de leads que ${fmtMonth(prevMonth)} en el mismo período.`
    : `Este mes llevas <b>${diffLeads}%</b> de leads respecto a ${fmtMonth(prevMonth)} en el mismo período.`;

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-gray-800">
              📊 Reporte mensual —{' '}
              <span className="text-slate-700">{fmtMonth(currentMonth)}</span>
            </h2>
            <span className="text-xs text-gray-400 font-normal hidden sm:inline">
              vs {fmtMonth(prevMonth)}
            </span>
          </div>
          <p
            className="text-xs text-gray-500 mt-0.5"
            dangerouslySetInnerHTML={{ __html: summaryTxt }}
          />
        </div>
        <span className="self-start sm:self-auto text-[10px] bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full font-semibold whitespace-nowrap">
          Hoy: día {todayDay}
        </span>
      </div>

      {/* 3 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Leads Nuevos" icon={Users} iconBg="bg-blue-50" iconText="text-blue-500"
          curTotal={leads.cur.total}     prevTotal={leads.prev.total}
          curUpTo={leads.cur.upToToday}  prevUpTo={leads.prev.upToToday}
          todayDay={todayDay} curMonth={currentMonth} prevMonth={prevMonth}
        />
        <StatCard
          label="Agendamientos" icon={CalendarCheck} iconBg="bg-violet-50" iconText="text-violet-500"
          curTotal={agendas.cur.total}    prevTotal={agendas.prev.total}
          curUpTo={agendas.cur.upToToday} prevUpTo={agendas.prev.upToToday}
          todayDay={todayDay} curMonth={currentMonth} prevMonth={prevMonth}
        />
        <StatCard
          label="Envíos" icon={Truck} iconBg="bg-orange-50" iconText="text-orange-500"
          curTotal={envios.cur.total}    prevTotal={envios.prev.total}
          curUpTo={envios.cur.upToToday} prevUpTo={envios.prev.upToToday}
          todayDay={todayDay} curMonth={currentMonth} prevMonth={prevMonth}
        />
      </div>
    </div>
  );
};

// ── Efectividad tabla ─────────────────────────────────────────────────────────
const EffectivenessSimple: React.FC<{ data: MonthGroup[]; colorMap: Record<string, string> }> = ({ data, colorMap }) => {
  const merged = new Map<string, { leads: number; agendas: number; envios: number }>();
  for (const mg of data)
    for (const s of mg.sources) {
      const e = merged.get(s.name) || { leads: 0, agendas: 0, envios: 0 };
      e.leads += s.leads; e.agendas += s.agendas; e.envios += s.envios;
      merged.set(s.name, e);
    }
  const rows = Array.from(merged.entries())
    .map(([name, d]) => ({
      name, ...d,
      effAgenda: d.leads > 0 ? +((d.agendas / d.leads) * 100).toFixed(1) : 0,
      effEnvio:  d.leads > 0 ? +((d.envios  / d.leads) * 100).toFixed(1) : 0,
    }))
    .filter(r => r.leads > 0)
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 15);

  if (!rows.length) return null;
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
            <th className="py-2 pr-4 font-semibold">Canal</th>
            <th className="py-2 px-4 font-semibold text-right">Leads</th>
            <th className="py-2 px-4 font-semibold text-right">Citas</th>
            <th className="py-2 px-4 font-semibold text-right">% Cita</th>
            <th className="py-2 px-4 font-semibold text-right">Envíos</th>
            <th className="py-2 pl-4 font-semibold text-right">% Envío</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.name} className="border-b border-gray-50 hover:bg-gray-50 transition">
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: colorMap[r.name] || getColor(r.name) }} />
                  <span className="font-medium text-gray-700 truncate max-w-[120px]">{r.name}</span>
                </div>
              </td>
              <td className="py-2 px-4 text-right font-bold text-gray-900">{r.leads.toLocaleString()}</td>
              <td className="py-2 px-4 text-right text-gray-600">{r.agendas.toLocaleString()}</td>
              <td className="py-2 px-4 text-right">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  r.effAgenda >= 50 ? 'bg-green-100 text-green-700'
                  : r.effAgenda >= 20 ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-600'}`}>
                  {r.effAgenda}%
                </span>
              </td>
              <td className="py-2 px-4 text-right text-gray-600">{r.envios.toLocaleString()}</td>
              <td className="py-2 pl-4 text-right">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  r.effEnvio >= 20 ? 'bg-blue-100 text-blue-700'
                  : r.effEnvio >= 5 ? 'bg-sky-100 text-sky-600'
                  : 'bg-gray-100 text-gray-500'}`}>
                  {r.effEnvio}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── Componente principal ─────────────────────────────────────────────────────
export const Resultados: React.FC = () => {
  const [apiData, setApiData]         = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [dateRange, setDateRange]     = useState({ from: '', to: '' });
  const [showEff, setShowEff]         = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const json = await ApiService.get<ApiResponse | ApiResponse[]>('/resultadosdb');
      const payload: ApiResponse = Array.isArray(json) ? json[0] : json;
      setApiData(payload);
    } catch (e: any) {
      setError(e?.message || 'Error al cargar datos');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filtrar por fecha
  const creadosFiltered = useMemo(() =>
    apiData?.creados?.chartData ? filterByDate(apiData.creados.chartData, dateRange.from, dateRange.to) : [],
    [apiData, dateRange]);
  const agendasFiltered = useMemo(() =>
    apiData?.agendas?.chartData ? filterByDate(apiData.agendas.chartData, dateRange.from, dateRange.to) : [],
    [apiData, dateRange]);
  const enviosFiltered  = useMemo(() =>
    apiData?.envios?.chartData  ? filterByDate(apiData.envios.chartData,  dateRange.from, dateRange.to) : [],
    [apiData, dateRange]);

  // Agrupar
  const creadosGrouped = useMemo(() => groupChartData(creadosFiltered, granularity), [creadosFiltered, granularity]);
  const agendasGrouped = useMemo(() => groupChartData(agendasFiltered, granularity), [agendasFiltered, granularity]);
  const enviosGrouped  = useMemo(() => groupChartData(enviosFiltered,  granularity), [enviosFiltered,  granularity]);

  // Keys
  const rawCreadosKeys = useMemo(() => apiData?.creados?.keys || [], [apiData]);
  const rawAgendasKeys = useMemo(() => apiData?.agendas?.keys || [], [apiData]);
  const rawEnviosKeys  = useMemo(() => apiData?.envios?.keys  || [], [apiData]);

  // Slim
  const slimCreados = useMemo(() => slimData(creadosGrouped, rawCreadosKeys), [creadosGrouped, rawCreadosKeys]);
  const slimAgendas = useMemo(() => slimData(agendasGrouped, rawAgendasKeys), [agendasGrouped, rawAgendasKeys]);
  const slimEnvios  = useMemo(() => slimData(enviosGrouped,  rawEnviosKeys),  [enviosGrouped,  rawEnviosKeys]);

  // Color map
  const colorMap = useMemo(() => {
    const all = new Set([...slimCreados.keys, ...slimAgendas.keys, ...slimEnvios.keys]);
    const map: Record<string, string> = {};
    all.forEach(k => { map[k] = getColor(k); });
    return map;
  }, [slimCreados.keys, slimAgendas.keys, slimEnvios.keys]);

  // KPIs
  const kpiTotals = useMemo(() => ({
    totalLeads:    creadosFiltered.reduce((a, b) => a + Number(b.total), 0),
    uniqueLeads:   creadosFiltered.reduce((a, b) => a + Number(b.uniqueCount), 0),
    totalAgendas:  agendasFiltered.reduce((a, b) => a + Number(b.total), 0),
    uniqueAgendas: agendasFiltered.reduce((a, b) => a + Number(b.uniqueCount), 0),
    totalEnvios:   enviosFiltered.reduce((a, b)  => a + Number(b.total), 0),
    uniqueEnvios:  enviosFiltered.reduce((a, b)  => a + Number(b.uniqueCount), 0),
  }), [creadosFiltered, agendasFiltered, enviosFiltered]);

  // Efectividad lazy
  const effectivenessData = useMemo(
    () => showEff ? buildEffectiveness(creadosFiltered, agendasFiltered, enviosFiltered) : [],
    [showEff, creadosFiltered, agendasFiltered, enviosFiltered]
  );

  // Reporte mensual (sin filtro de fecha — siempre sobre datos completos)
  const monthReport = useMemo(() => {
    if (!apiData) return null;
    return buildMonthReport(
      apiData.creados?.chartData || [],
      apiData.agendas?.chartData || [],
      apiData.envios?.chartData  || []
    );
  }, [apiData]);

  const allSources = useMemo(() =>
    ['ALL', ...Array.from(new Set([...rawCreadosKeys, ...rawAgendasKeys, ...rawEnviosKeys])).sort()],
    [rawCreadosKeys, rawAgendasKeys, rawEnviosKeys]);

  return (
    <div className="page-container flex flex-col space-y-6">

      {/* HEADER */}
      <div className="header-bar rounded-2xl flex flex-col lg:flex-row gap-4 justify-between items-center">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-900/20">
            <BarChart2 size={22} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 leading-none tracking-tight">Dashboard</h1>
            <p className="text-xs text-slate-400 mt-0.5">Datos consolidados</p>
            <div className="wt-filter-group mt-2">
              {(['month', 'week', 'day'] as Granularity[]).map(g => (
                <button key={g} onClick={() => setGranularity(g)}
                  className={`wt-filter-pill ${granularity === g ? 'wt-filter-pill-active' : ''}`}>
                  {g === 'day' ? 'Día' : g === 'week' ? 'Semana' : 'Mes'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 w-full lg:w-auto justify-end items-center">
          <div className="flex bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center pl-3 text-gray-400"><Calendar size={14} /></div>
            <input type="date" value={dateRange.from}
              onChange={e => setDateRange(r => ({ ...r, from: e.target.value }))}
              className="bg-transparent px-3 py-2 text-sm outline-none w-36 text-gray-600 font-medium" />
            <div className="w-px bg-gray-300 my-2" />
            <input type="date" value={dateRange.to}
              onChange={e => setDateRange(r => ({ ...r, to: e.target.value }))}
              className="bg-transparent px-3 py-2 text-sm outline-none w-36 text-gray-600 font-medium" />
            {(dateRange.from || dateRange.to) && (
              <button onClick={() => setDateRange({ from: '', to: '' })}
                className="px-3 text-gray-400 hover:text-red-400 text-xs font-bold">✕</button>
            )}
          </div>
          <button onClick={load} disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 transition-all">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* CONTENIDO */}
      <div className="w-full space-y-6">
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400 gap-3">
            <RefreshCw className="animate-spin" size={28} />
            <p className="text-sm font-medium">Cargando datos...</p>
          </div>
        ) : error ? (
          <div className="h-64 flex flex-col items-center justify-center text-red-400 gap-3 bg-red-50 rounded-2xl border border-red-100">
            <p className="font-semibold">Error al cargar</p>
            <p className="text-xs text-red-300">{error}</p>
            <button onClick={load} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition">Reintentar</button>
          </div>
        ) : (
          <>
            {/* ① REPORTE MENSUAL */}
            {monthReport && <MonthlyReport report={monthReport} />}

            {/* ② KPIs globales (según filtro de fecha) */}
            <KPICards
              {...kpiTotals}
              sources={allSources}
              sourceFilter="ALL"
              colorMap={colorMap}
              onSourceSelect={() => {}}
            />

            {/* ③ Advertencia vista día */}
            {granularity === 'day' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-700 font-medium flex items-center gap-2">
                <span>⚠️</span>
                <span>Vista por día: se muestran los últimos {MAX_BARS} períodos. Usa "Mes" para mejor rendimiento.</span>
              </div>
            )}

            {/* ④ Gráficas */}
            <div className="grid lg:grid-cols-3 gap-5">
              <ChartCard title="Leads Creados" subtitle="Fecha creación" icon={PieChart}
                data={slimCreados.data} keys={slimCreados.keys} colorMap={colorMap} />
              <ChartCard title="Agendamientos" subtitle="Fecha cita" icon={CalendarCheck}
                data={slimAgendas.data} keys={slimAgendas.keys} colorMap={colorMap} />
              <ChartCard title="Envíos" subtitle="Fecha solicitud" icon={Truck}
                data={slimEnvios.data} keys={slimEnvios.keys} colorMap={colorMap} />
            </div>

            {/* ⑤ Efectividad (lazy) */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <button onClick={() => setShowEff(v => !v)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-50 text-slate-600 rounded-lg"><TrendingUp size={18} /></div>
                  <div className="text-left">
                    <p className="font-bold text-gray-800 text-sm">Efectividad por Canal</p>
                    <p className="text-xs text-gray-400">Conversión leads → citas → envíos</p>
                  </div>
                </div>
                <span className="text-gray-400 text-lg">{showEff ? '▲' : '▼'}</span>
              </button>
              {showEff && effectivenessData.length > 0 && (
                <div className="px-6 pb-6 border-t border-gray-100">
                  <EffectivenessSimple data={effectivenessData} colorMap={colorMap} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Resultados;
