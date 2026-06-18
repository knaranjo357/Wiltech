import React, { memo } from 'react';
import { PieChart, Calendar, Truck } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: number;
  sub: string;
  icon: React.ElementType;
  color: string;
  bgClass: string;
}

const KPICard = memo(({ title, value, sub, icon: Icon, color, bgClass }: KPICardProps) => (
  <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[var(--wt-shadow-sm)] hover:shadow-[var(--wt-shadow-md)] hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden group">
    <div className={`absolute -right-6 -top-6 p-6 opacity-5 rounded-full ${bgClass} transition-transform group-hover:scale-110`}></div>
    <div className="flex justify-between items-start relative z-10">
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900 tracking-tight">{value.toLocaleString()}</p>
        <p className="text-[11px] text-gray-400 mt-1 font-medium">{sub}</p>
      </div>
      <div className={`p-3 rounded-xl ${bgClass} ${color} bg-opacity-10`}>
        <Icon size={24} />
      </div>
    </div>
  </div>
));

interface SourceFilterCardProps {
  sources: string[];
  sourceFilter: string;
  colorMap: Record<string, string>;
  onSelect: (s: string) => void;
}

const SourceFilterCard = memo(({ sources, sourceFilter, colorMap, onSelect }: SourceFilterCardProps) => (
  <div className="col-span-1 bg-white rounded-2xl border border-gray-100 p-4 flex flex-col justify-center">
    <span className="text-xs font-semibold text-gray-400 uppercase mb-2">Canal (Source)</span>
    <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto scrollbar-hide">
      {sources.map(s => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all flex items-center gap-1.5 ${
            sourceFilter === s
              ? 'bg-gray-800 text-white border-gray-800'
              : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
          }`}
        >
          {s !== 'ALL' && <span className="w-1.5 h-1.5 rounded-full" style={{ background: colorMap[s] }} />}
          {s === 'ALL' ? 'Todos' : s}
        </button>
      ))}
    </div>
  </div>
));

interface KPICardsProps {
  totalLeads: number;
  uniqueLeads: number;
  totalAgendas: number;
  uniqueAgendas: number;
  totalEnvios: number;
  uniqueEnvios: number;
  sources: string[];
  sourceFilter: string;
  colorMap: Record<string, string>;
  onSourceSelect: (s: string) => void;
}

export const KPICards: React.FC<KPICardsProps> = ({
  totalLeads, uniqueLeads,
  totalAgendas, uniqueAgendas,
  totalEnvios, uniqueEnvios,
  sources, sourceFilter, colorMap, onSourceSelect
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        title="Leads Nuevos"
        value={totalLeads}
        sub={`${uniqueLeads.toLocaleString()} únicos`}
        icon={PieChart}
        color="text-blue-500"
        bgClass="bg-blue-500"
      />
      <KPICard
        title="Citas Agendadas"
        value={totalAgendas}
        sub={`${uniqueAgendas.toLocaleString()} únicos`}
        icon={Calendar}
        color="text-purple-500"
        bgClass="bg-purple-500"
      />
      <KPICard
        title="Envíos Generados"
        value={totalEnvios}
        sub={`${uniqueEnvios.toLocaleString()} únicos`}
        icon={Truck}
        color="text-orange-500"
        bgClass="bg-orange-500"
      />
      <SourceFilterCard
        sources={sources}
        sourceFilter={sourceFilter}
        colorMap={colorMap}
        onSelect={onSourceSelect}
      />
    </div>
  );
};

export default KPICards;
