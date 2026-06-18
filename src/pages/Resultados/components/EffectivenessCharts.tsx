import React, { memo, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell
} from 'recharts';
import { TrendingUp, AlertCircle, BarChart2, Percent } from 'lucide-react';
import { MonthGroup, SOURCE_EMPTY, getColor } from '../utils/dataProcessor';

type ViewMode = 'conversion' | 'volume';
type SortMode = 'leads' | 'effAgenda' | 'effEnvio';

interface Props {
  data: MonthGroup[];
  colorMap: Record<string, string>;
}

const EffTooltip = memo(({ active, payload, label, viewMode }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-xl min-w-[200px] z-50">
      <p className="font-bold text-gray-800 mb-2 border-b border-gray-100 pb-1 truncate max-w-[180px]">{label}</p>
      <div className="space-y-1">
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-gray-600">{entry.name}</span>
            </div>
            <span className="font-bold text-gray-800">
              {viewMode === 'conversion' ? `${(entry.value as number).toFixed(1)}%` : (entry.value as number).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

export const EffectivenessCharts: React.FC<Props> = ({ data, colorMap }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('conversion');
  const [sortMode, setSortMode] = useState<SortMode>('leads');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');

  const months = useMemo(() => ['ALL', ...data.map(d => d.month)], [data]);

  // Datos procesados para la gráfica según el mes y modo seleccionado
  const chartData = useMemo(() => {
    const monthGroups = selectedMonth === 'ALL' ? data : data.filter(d => d.month === selectedMonth);

    // Agregar todos los canales del período seleccionado
    const merged = new Map<string, { name: string; leads: number; agendas: number; envios: number; }>();

    for (const mg of monthGroups) {
      for (const src of mg.sources) {
        const existing = merged.get(src.name) || { name: src.name, leads: 0, agendas: 0, envios: 0 };
        existing.leads += src.leads;
        existing.agendas += src.agendas;
        existing.envios += src.envios;
        merged.set(src.name, existing);
      }
    }

    let rows = Array.from(merged.values()).map(r => ({
      ...r,
      effAgenda: r.leads > 0 ? (r.agendas / r.leads) * 100 : 0,
      effEnvio: r.leads > 0 ? (r.envios / r.leads) * 100 : 0,
      displayName: r.name === SOURCE_EMPTY ? 'Directo' : r.name,
    }));

    // Ordenar
    if (sortMode === 'leads') rows.sort((a, b) => b.leads - a.leads);
    else if (sortMode === 'effAgenda') rows.sort((a, b) => b.effAgenda - a.effAgenda);
    else if (sortMode === 'effEnvio') rows.sort((a, b) => b.effEnvio - a.effEnvio);

    return rows;
  }, [data, selectedMonth, sortMode]);

  const totalLeads = chartData.reduce((s, r) => s + r.leads, 0);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 flex flex-col items-center justify-center text-gray-300">
        <AlertCircle className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">No hay datos suficientes para calcular efectividad.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><TrendingUp size={20} /></div>
          <div>
            <h3 className="font-bold text-gray-900">Efectividad por Canal</h3>
            <p className="text-xs text-gray-500">
              {totalLeads.toLocaleString()} leads totales · {chartData.length} canales
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Selector de mes */}
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="pl-3 pr-7 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 outline-none focus:ring-2 focus:ring-indigo-400 appearance-none cursor-pointer"
          >
            {months.map(m => <option key={m} value={m}>{m === 'ALL' ? 'Todos los meses' : m}</option>)}
          </select>

          {/* Toggle vista */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setViewMode('conversion')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'conversion' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-800'}`}
            >
              <Percent size={12} /> Conversión
            </button>
            <button
              onClick={() => setViewMode('volume')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'volume' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-800'}`}
            >
              <BarChart2 size={12} /> Volumen
            </button>
          </div>

          {/* Ordenar */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            {([['leads', 'Leads'], ['effAgenda', 'Citas %'], ['effEnvio', 'Envíos %']] as [SortMode, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortMode(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${sortMode === key ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-800'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Gráfica */}
      <div className="p-6">
        <div style={{ height: Math.max(300, chartData.length * 42) }}>
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'conversion' ? (
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 60, left: 10, bottom: 0 }}
                barCategoryGap="25%"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#94A3B8' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="displayName"
                  tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <Tooltip content={<EffTooltip viewMode="conversion" />} cursor={{ fill: '#F8FAFC' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="effAgenda" name="% Conv. Cita" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={10} isAnimationActive={false}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={colorMap[entry.name] || getColor(entry.name)} fillOpacity={0.9} />
                  ))}
                </Bar>
                <Bar dataKey="effEnvio" name="% Conv. Envío" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={10} isAnimationActive={false} />
              </BarChart>
            ) : (
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 60, left: 10, bottom: 0 }}
                barCategoryGap="25%"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: '#94A3B8' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <YAxis
                  type="category"
                  dataKey="displayName"
                  tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <Tooltip content={<EffTooltip viewMode="volume" />} cursor={{ fill: '#F8FAFC' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="leads" name="Leads" stackId="a" fill="#6366F1" radius={[0, 0, 0, 0]} barSize={14} isAnimationActive={false} />
                <Bar dataKey="agendas" name="Agendas" stackId="b" fill="#8B5CF6" radius={[0, 0, 0, 0]} barSize={14} isAnimationActive={false} />
                <Bar dataKey="envios" name="Envíos" stackId="c" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default EffectivenessCharts;
