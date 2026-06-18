import React, { memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Brush, Legend
} from 'recharts';
import { AlertCircle, PieChart, Calendar, Truck } from 'lucide-react';
import { SOURCE_EMPTY } from '../utils/dataProcessor';

// Tooltip personalizado
const CustomTooltip = memo(({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  const total = payload.reduce((sum: number, entry: any) => sum + (Number(entry.value) || 0), 0);

  return (
    <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-xl min-w-[180px] z-50">
      <p className="font-bold text-gray-800 mb-2 border-b border-gray-100 pb-1">{label}</p>
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold text-gray-900">Total</span>
        <span className="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs">{total.toLocaleString()}</span>
      </div>
      <div className="space-y-1">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-gray-600 truncate max-w-[100px]">{entry.name}</span>
            </div>
            <span className="font-medium text-gray-700">{(entry.value as number).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

interface HeavyChartProps {
  data: any[];
  keys: string[];
  onBarClick?: (data: any) => void;
  colorMap: Record<string, string>;
  title: string;
  subTitle?: string;
  icon: React.ElementType;
}

const HeavyChart = memo(({ data, keys, onBarClick, colorMap, title, subTitle, icon: Icon }: HeavyChartProps) => {
  if (!data || data.length === 0) return (
    <div className="h-full flex flex-col items-center justify-center text-gray-300 border rounded-3xl bg-white p-6">
      <AlertCircle className="mb-2 w-8 h-8 opacity-20" />
      <span className="text-sm font-medium">Sin datos para mostrar</span>
    </div>
  );

  const disableAnimation = data.length > 90;
  const grandTotal = data.reduce((acc: number, curr: any) => acc + curr.total, 0);

  return (
    <div className="bg-white rounded-2xl p-5 shadow-[var(--wt-shadow-sm)] border border-slate-100 h-[400px] flex flex-col transition-all hover:shadow-[var(--wt-shadow-md)] hover:border-slate-200">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-50 rounded-lg text-gray-500"><Icon size={18} /></div>
          <div>
            <h3 className="font-bold text-gray-800 text-base leading-tight">{title}</h3>
            {subTitle && <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{subTitle}</span>}
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-gray-900">{grandTotal.toLocaleString()}</span>
          <p className="text-[10px] text-gray-400">{data.length} períodos</p>
        </div>
      </div>
      <div className="flex-1 min-h-0 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#94A3B8' }}
              tickLine={false}
              axisLine={false}
              dy={10}
              minTickGap={10}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94A3B8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '15px', color: '#64748B' }} />
            {keys.map((k: string) => (
              <Bar
                key={k}
                dataKey={k}
                name={k === SOURCE_EMPTY ? 'Directo' : k}
                stackId="a"
                fill={colorMap[k] || '#CBD5E1'}
                radius={[2, 2, 0, 0]}
                onClick={(p) => onBarClick && onBarClick(p)}
                isAnimationActive={!disableAnimation}
                animationDuration={400}
              />
            ))}
            <Brush dataKey="label" height={12} stroke="#CBD5E1" fill="#F8FAFC" tickFormatter={() => ''} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}, (prev, next) => (
  prev.data === next.data &&
  prev.keys.length === next.keys.length &&
  prev.title === next.title
));

interface ResultChartsProps {
  creadosData: any[];
  creadosKeys: string[];
  agendasData: any[];
  agendasKeys: string[];
  enviosData: any[];
  enviosKeys: string[];
  colorMap: Record<string, string>;
  onBarClick: (data: any, type: 'agendas' | 'created' | 'envios') => void;
}

export const ResultCharts: React.FC<ResultChartsProps> = ({
  creadosData, creadosKeys,
  agendasData, agendasKeys,
  enviosData, enviosKeys,
  colorMap,
  onBarClick
}) => {
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <HeavyChart
        title="Leads Nuevos"
        subTitle="Fecha Creación"
        data={creadosData}
        keys={creadosKeys}
        colorMap={colorMap}
        onBarClick={(d: any) => onBarClick(d, 'created')}
        icon={PieChart}
      />
      <HeavyChart
        title="Agendamientos"
        subTitle="Fecha Cita"
        data={agendasData}
        keys={agendasKeys}
        colorMap={colorMap}
        onBarClick={(d: any) => onBarClick(d, 'agendas')}
        icon={Calendar}
      />
      <HeavyChart
        title="Logística / Envíos"
        subTitle="Fecha Solicitud"
        data={enviosData}
        keys={enviosKeys}
        colorMap={colorMap}
        onBarClick={(d: any) => onBarClick(d, 'envios')}
        icon={Truck}
      />
    </div>
  );
};

export default ResultCharts;
