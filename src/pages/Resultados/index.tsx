import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { RefreshCw, X, BarChart2, Filter, Search, Calendar } from 'lucide-react';

import { ClientService } from '../../services/clientService';
import { Client } from '../../types/client';
import { ClientModal } from '../../components/ClientModal';
import { formatWhatsApp, getEtapaColor } from '../../utils/clientHelpers';
import { normalize } from '../../utils/textUtils';

import {
  OptimizedClient,
  Granularity,
  optimizeClients,
  generateChartData,
  calculateEffectiveness,
  getColor,
  getBucketKey,
  SOURCE_EMPTY,
} from './utils/dataProcessor';

import { KPICards } from './components/KPICards';
import { ResultCharts } from './components/ResultCharts';
import { EffectivenessCharts } from './components/EffectivenessCharts';

const ONE_DAY = 86400000;

const parseToTimestamp = (raw: any): number => {
  if (!raw) return 0;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

export const Resultados: React.FC = () => {
  const [rawData, setRawData] = useState<OptimizedClient[]>([]);
  const [isProcessing, setIsProcessing] = useState(true);

  // Filtros
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [sedeFilter, setSedeFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  // UI
  const [detailView, setDetailView] = useState<{ type: 'agendas' | 'created' | 'envios'; key: string } | null>(null);
  const [modalClient, setModalClient] = useState<Client | null>(null);

  // Debounce búsqueda
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 350);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Carga Inicial
  useEffect(() => {
    const load = async () => {
      setIsProcessing(true);
      try {
        const data = await ClientService.getClients();
        const list = Array.isArray(data) ? data : [];
        setRawData(optimizeClients(list));
      } catch (e) {
        console.error('Error loading Resultados', e);
      } finally {
        setIsProcessing(false);
      }
    };
    load();
  }, []);

  // Filtro Global
  const filteredData = useMemo(() => {
    const tsFrom = dateRange.from ? parseToTimestamp(dateRange.from) : 0;
    const tsTo = dateRange.to ? parseToTimestamp(dateRange.to) + ONE_DAY - 1 : Infinity;
    const normSearch = normalize(debouncedSearch);
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
  }, [rawData, sedeFilter, sourceFilter, debouncedSearch, dateRange]);

  // Datos para gráficas
  const agendas = useMemo(
    () => generateChartData(filteredData, 'agendas', granularity, dateRange),
    [filteredData, granularity, dateRange]
  );
  const creados = useMemo(
    () => generateChartData(filteredData, 'created', granularity, dateRange),
    [filteredData, granularity, dateRange]
  );
  const envios = useMemo(
    () => generateChartData(filteredData, 'envios', granularity, dateRange),
    [filteredData, granularity, dateRange]
  );

  // Efectividad
  const effectivenessData = useMemo(() => calculateEffectiveness(filteredData), [filteredData]);

  // Color map consistente
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    const allKeys = new Set([...agendas.keys, ...creados.keys, ...envios.keys]);
    allKeys.forEach(k => (map[k] = getColor(k)));
    return map;
  }, [agendas.keys, creados.keys, envios.keys]);

  // Meta opciones
  const metaOptions = useMemo(() => {
    const sedes = new Set<string>();
    const sources = new Set<string>();
    rawData.forEach(c => {
      if (c.agenda_ciudad_sede && c._normSede !== 'no aplica') sedes.add(c.agenda_ciudad_sede);
      if (c._normSource) sources.add(c._normSource);
    });
    return {
      sedes: ['ALL', ...Array.from(sedes).sort()],
      sources: ['ALL', ...Array.from(sources).sort((a, b) => b.localeCompare(a))],
    };
  }, [rawData]);

  // Click en barra
  const handleBarClick = useCallback((data: any, type: 'agendas' | 'created' | 'envios') => {
    if (data && data.label) setDetailView({ type, key: data.label });
  }, []);

  // KPI totals
  const kpiTotals = useMemo(() => ({
    totalLeads: creados.chartData.reduce((a, b) => a + Number(b.total), 0),
    uniqueLeads: creados.chartData.reduce((a, b) => a + Number(b.uniqueCount), 0),
    totalAgendas: agendas.chartData.reduce((a, b) => a + Number(b.total), 0),
    uniqueAgendas: agendas.chartData.reduce((a, b) => a + Number(b.uniqueCount), 0),
    totalEnvios: envios.chartData.reduce((a, b) => a + Number(b.total), 0),
    uniqueEnvios: envios.chartData.reduce((a, b) => a + Number(b.uniqueCount), 0),
  }), [creados.chartData, agendas.chartData, envios.chartData]);

  return (
    <div className="page-container flex flex-col space-y-6">

      {/* HEADER */}
      <div className="header-bar rounded-2xl flex flex-col lg:flex-row gap-4 justify-between items-center">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200/50">
            <BarChart2 size={22} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 leading-none tracking-tight">Dashboard</h1>
            <p className="text-xs text-slate-400 mt-0.5">{rawData.length.toLocaleString()} registros cargados</p>
            <div className="wt-filter-group mt-2">
              {(['day', 'week', 'month'] as Granularity[]).map(g => (
                <button
                  key={g}
                  onClick={() => setGranularity(g)}
                  className={`wt-filter-pill ${granularity === g ? 'wt-filter-pill-active' : ''}`}
                >
                  {g === 'day' ? 'Día' : g === 'week' ? 'Semana' : 'Mes'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 w-full lg:w-auto justify-end">
          {/* Filtro Sede */}
          <div className="relative group w-full sm:w-40">
            <select
              value={sedeFilter}
              onChange={e => setSedeFilter(e.target.value)}
              className="w-full pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer font-medium text-gray-700"
            >
              {metaOptions.sedes.map(s => (
                <option key={s} value={s}>{s === 'ALL' ? 'Todas las Sedes' : s}</option>
              ))}
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Rango de fechas */}
          <div className="flex bg-gray-50 border border-gray-200 rounded-xl overflow-hidden w-full sm:w-auto">
            <input
              type="date"
              value={dateRange.from}
              onChange={e => setDateRange({ ...dateRange, from: e.target.value })}
              className="bg-transparent px-3 py-2 text-sm outline-none w-full sm:w-36 text-gray-600 font-medium"
            />
            <div className="w-px bg-gray-300 my-2"></div>
            <input
              type="date"
              value={dateRange.to}
              onChange={e => setDateRange({ ...dateRange, to: e.target.value })}
              className="bg-transparent px-3 py-2 text-sm outline-none w-full sm:w-36 text-gray-600 font-medium"
            />
          </div>

          {/* Búsqueda */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              placeholder="Buscar cliente..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
            />
            {searchText !== debouncedSearch && (
              <RefreshCw size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 animate-spin" />
            )}
          </div>
        </div>
      </div>

      {/* CONTENIDO */}
      <div className="w-full mx-auto space-y-6 animate-in fade-in duration-500">
        {isProcessing ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400 gap-3">
            <RefreshCw className="animate-spin" />
            <p>Procesando datos...</p>
          </div>
        ) : (
          <>
            {/* 1. KPIs */}
            <KPICards
              {...kpiTotals}
              sources={metaOptions.sources}
              sourceFilter={sourceFilter}
              colorMap={colorMap}
              onSourceSelect={setSourceFilter}
            />

            {/* 2. Gráficas Temporales */}
            <ResultCharts
              creadosData={creados.chartData}
              creadosKeys={creados.keys}
              agendasData={agendas.chartData}
              agendasKeys={agendas.keys}
              enviosData={envios.chartData}
              enviosKeys={envios.keys}
              colorMap={colorMap}
              onBarClick={handleBarClick}
            />

            {/* 3. Efectividad por Canal (Gráfica de Barras) */}
            <EffectivenessCharts data={effectivenessData} colorMap={colorMap} />
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
                  {detailView.type === 'agendas' ? '📅 Agendas' : detailView.type === 'envios' ? '🚚 Envíos' : '🆕 Creados'}
                  <span className="text-gray-400">|</span>
                  <span className="text-blue-600">{detailView.key}</span>
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
                  .slice(0, 100)
                  .map(client => (
                    <div
                      key={client.row_number}
                      onClick={() => setModalClient(client)}
                      className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex justify-between items-center group"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-gray-800 group-hover:text-blue-600">{client.nombre || 'Sin Nombre'}</h4>
                          {client.agenda_ciudad_sede && (
                            <span className="text-[10px] px-2 py-0.5 bg-gray-100 rounded text-gray-500 border">{client.agenda_ciudad_sede}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex gap-3">
                          <span>{client.modelo}</span>
                          <span>•</span>
                          <span>{formatWhatsApp(client.whatsapp as any)}</span>
                          <span>•</span>
                          <span className="text-blue-600 font-medium">
                            {client._normSource === SOURCE_EMPTY ? 'Sin origen' : client._normSource}
                          </span>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getEtapaColor(client.estado_etapa as any)}`}>
                        {(client.estado_etapa || 'N/A').replace(/_/g, ' ')}
                      </div>
                    </div>
                  ))}
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
