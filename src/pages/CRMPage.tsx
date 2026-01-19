import React, { useEffect, useMemo, useState } from 'react';
import { 
  Search, Filter, Plus, Calendar, Smartphone, MapPin, 
  MoreHorizontal, Edit3, MessageCircle, ChevronLeft, ChevronRight, 
  Users, RefreshCw, Truck, CheckCircle2, X
} from 'lucide-react';

import { ClientService } from '../services/clientService';
import { Client } from '../types/client';
import { ClientModal } from '../components/ClientModal';
import { NuevoCliente } from '../components/NuevoCliente';
import { formatWhatsApp, getEtapaColor, formatDate } from '../utils/clientHelpers';

/** 
 * ==============================================================================
 *  TIPOS Y UTILS (Basados en tu Resultados.tsx para consistencia)
 * ==============================================================================
 */
interface OptimizedClient extends Client {
  _tsAgenda: number;      
  _tsCreated: number;     
  _isEnvio: boolean;
  _normSearch: string;    
  _normSede: string;      
  _normSource: string;    
  _normEtapa: string;
}

const safeText = (v: any) => {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  const lower = s.toLowerCase();
  if (lower === 'null' || lower === 'undefined' || lower === 'no aplica') return '';
  return s;
};

const normalize = (v: any) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim();
const SOURCE_EMPTY = 'Directo';

// Lógica de detección de envío (Idéntica a Resultados)
const hasLogisticsData = (c: any): boolean => {
  return !!(
    safeText(c.guia_direccion) || safeText(c.guia_ciudad) || safeText(c.guia_numero_ida) || 
    safeText(c.guia_nombre_completo) || safeText(c.guia_cedula_id) || safeText(c.guia_numero_retorno) ||
    c.estado_etapa === 'ENVIO_GESTIONADO' || c.estado_envio === 'envio_gestionado'
  );
};

const parseToTimestamp = (raw: any, offsetHours = 0): number => {
  if (!raw) return 0;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return 0;
  if (offsetHours) d.setTime(d.getTime() - offsetHours * 3600000);
  return d.getTime();
};

const ONE_DAY = 86400000;

// Generador de iniciales para avatar
const getInitials = (name: string) => {
  const parts = normalize(name).split(' ').filter(Boolean);
  if (parts.length === 0) return '??';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

const getRandomColor = (str: string) => {
  const colors = ['bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-purple-100 text-purple-700', 'bg-orange-100 text-orange-700', 'bg-pink-100 text-pink-700'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

/** 
 * ==============================================================================
 *  COMPONENTE CRM PAGE
 * ==============================================================================
 */
export const CRMPage: React.FC = () => {
  // --- Estados de Datos ---
  const [rawData, setRawData] = useState<OptimizedClient[]>([]);
  const [isProcessing, setIsProcessing] = useState(true);

  // --- Estados de Filtros ---
  const [searchText, setSearchText] = useState('');
  const [sedeFilter, setSedeFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [etapaFilter, setEtapaFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  // --- Paginación ---
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // --- UI & Modales ---
  const [modalClient, setModalClient] = useState<Client | null>(null);
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);

  // 1. Carga de Datos (Idéntica a Resultados)
  const loadData = async () => {
    setIsProcessing(true);
    try {
      const data = await ClientService.getClients();
      const list = Array.isArray(data) ? data : [];
      
      const optimized: OptimizedClient[] = list.map((c: any) => ({
        ...c,
        _tsAgenda: parseToTimestamp(c.fecha_agenda),
        _tsCreated: parseToTimestamp(c.created, 5),
        _isEnvio: hasLogisticsData(c),
        _normSearch: normalize(`${c.nombre} ${c.modelo} ${c.ciudad} ${c.whatsapp} ${c.agenda_ciudad_sede}`),
        _normSede: normalize(c.agenda_ciudad_sede),
        _normSource: (c.source || '').trim() || SOURCE_EMPTY,
        _normEtapa: (c.estado_etapa || '').trim()
      }));
      
      // Ordenar por fecha de agenda (más reciente primero) por defecto
      optimized.sort((a, b) => (b._tsAgenda || b._tsCreated) - (a._tsAgenda || a._tsCreated));

      setRawData(optimized);
    } catch (e) {
      console.error("Error loading CRM", e);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // 2. Generación de Opciones de Filtro Dinámicas
  const metaOptions = useMemo(() => {
    const sedes = new Set<string>();
    const sources = new Set<string>();
    const etapas = new Set<string>();
    
    rawData.forEach(c => {
      if (c.agenda_ciudad_sede && c._normSede !== 'no aplica') sedes.add(c.agenda_ciudad_sede);
      if (c._normSource) sources.add(c._normSource);
      if (c.estado_etapa) etapas.add(c.estado_etapa);
    });

    return {
      sedes: ['ALL', ...Array.from(sedes).sort()],
      sources: ['ALL', ...Array.from(sources).sort()],
      etapas: ['ALL', ...Array.from(etapas).sort()]
    };
  }, [rawData]);

  // 3. Filtrado (Optimizado)
  const filteredData = useMemo(() => {
    const tsFrom = dateRange.from ? parseToTimestamp(dateRange.from) : 0;
    const tsTo = dateRange.to ? parseToTimestamp(dateRange.to) + ONE_DAY - 1 : Infinity;
    const normSearch = normalize(searchText);
    const normSede = normalize(sedeFilter);
    const useDate = !!(dateRange.from || dateRange.to);

    return rawData.filter(c => {
      // Filtros rápidos
      if (sedeFilter !== 'ALL' && c._normSede !== normSede) return false;
      if (sourceFilter !== 'ALL' && c._normSource !== sourceFilter) return false;
      if (etapaFilter !== 'ALL' && c.estado_etapa !== etapaFilter) return false;
      
      // Buscador texto
      if (normSearch && !c._normSearch.includes(normSearch)) return false;

      // Filtro Fecha (Aplica a Agenda O Creación)
      if (useDate) {
        const inAgenda = c._tsAgenda >= tsFrom && c._tsAgenda <= tsTo;
        const inCreated = c._tsCreated >= tsFrom && c._tsCreated <= tsTo;
        if (!inAgenda && !inCreated) return false;
      }
      
      return true;
    });
  }, [rawData, sedeFilter, sourceFilter, etapaFilter, searchText, dateRange]);

  // 4. Paginación
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Reseteo de página al filtrar
  useEffect(() => setCurrentPage(1), [filteredData.length]);

  // Manejadores
  const handleUpdateClient = async (updated: Partial<Client>) => {
    // Actualización optimista o recarga
    await ClientService.updateClient(updated);
    setModalClient(null);
    loadData(); // Recargamos para refrescar timestamps y orden
    return true;
  };

  const handleWhatsApp = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    if (!phone) return;
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`, '_blank');
  };

  // --- Render ---
  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 font-sans relative">
      
      {/* Botón Flotante Nuevo Cliente */}
      <div className="fixed bottom-8 right-8 z-50 animate-in zoom-in duration-300">
         <NuevoCliente onCreated={loadData} />
      </div>

      {/* HEADER STICKY & FILTROS */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="px-4 md:px-8 py-4">
          
          {/* Fila Superior: Título y Totales */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
                <Users size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Base de Contactos</h1>
                <p className="text-xs text-gray-500">
                  Mostrando <span className="font-bold text-gray-800">{filteredData.length}</span> de {rawData.length} clientes
                </p>
              </div>
            </div>

            {/* Stats Rápidos en Header */}
            <div className="flex gap-3 text-xs overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
               <div className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 flex items-center gap-2 whitespace-nowrap">
                  <CheckCircle2 size={14}/> 
                  <span>Agendados: <b>{filteredData.filter(c => c._tsAgenda > 0).length}</b></span>
               </div>
               <div className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg border border-orange-100 flex items-center gap-2 whitespace-nowrap">
                  <Truck size={14}/> 
                  <span>Con Envíos: <b>{filteredData.filter(c => c._isEnvio).length}</b></span>
               </div>
            </div>
          </div>

          {/* Fila Inferior: Filtros */}
          <div className="flex flex-col lg:flex-row gap-3">
            
            {/* Buscador */}
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                placeholder="Buscar por nombre, teléfono, ciudad..." 
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
              />
              {searchText && (
                <button onClick={() => setSearchText('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
              {/* Filtro Sede */}
              <select 
                value={sedeFilter} onChange={e => setSedeFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 outline-none focus:border-indigo-500 cursor-pointer min-w-[140px]"
              >
                {metaOptions.sedes.map(s => <option key={s} value={s}>{s === 'ALL' ? 'Todas las Sedes' : s}</option>)}
              </select>

              {/* Filtro Etapa */}
              <select 
                value={etapaFilter} onChange={e => setEtapaFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 outline-none focus:border-indigo-500 cursor-pointer min-w-[160px]"
              >
                <option value="ALL">Todas las Etapas</option>
                {metaOptions.etapas.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>

              {/* Filtro Source */}
              <select 
                value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 outline-none focus:border-indigo-500 cursor-pointer min-w-[140px]"
              >
                <option value="ALL">Todos los Canales</option>
                {metaOptions.sources.map(s => <option key={s} value={s}>{s === SOURCE_EMPTY ? 'Directo' : s}</option>)}
              </select>
            </div>

            {/* Rango Fechas */}
            <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden shrink-0">
               <input type="date" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} className="px-3 py-2 text-sm outline-none text-gray-600 border-r border-gray-100" />
               <input type="date" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} className="px-3 py-2 text-sm outline-none text-gray-600" />
            </div>
            
            <button onClick={loadData} className="p-2 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors" title="Recargar">
              <RefreshCw size={18} className={isProcessing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL: TABLA */}
      <div className="px-4 md:px-8 py-6">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          {isProcessing && filteredData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-10">
               <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
               <span className="text-gray-400 font-medium">Sincronizando clientes...</span>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-20 text-center">
               <div className="p-4 bg-gray-50 rounded-full text-gray-300 mb-2"><Search size={32}/></div>
               <h3 className="text-lg font-bold text-gray-800">No se encontraron clientes</h3>
               <p className="text-gray-500 max-w-xs">Intenta ajustar los filtros o el término de búsqueda.</p>
               <button onClick={() => { setSearchText(''); setSedeFilter('ALL'); setSourceFilter('ALL'); setEtapaFilter('ALL'); setDateRange({from:'', to:''}); }} className="mt-4 text-indigo-600 font-medium hover:underline">Limpiar filtros</button>
            </div>
          ) : (
            <>
              {/* Tabla Responsive */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50/80 text-xs text-gray-500 uppercase font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4">Cliente / Modelo</th>
                      <th className="px-6 py-4">Contacto</th>
                      <th className="px-6 py-4">Ubicación / Sede</th>
                      <th className="px-6 py-4">Estado (Etapa)</th>
                      <th className="px-6 py-4">Fecha Agenda</th>
                      <th className="px-6 py-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedData.map((client) => {
                      const initials = getInitials(client.nombre || '?');
                      const avatarColor = getRandomColor(client.nombre || '?');
                      
                      return (
                        <tr 
                          key={client.row_number} 
                          onClick={() => setModalClient(client)}
                          className="group hover:bg-gray-50/50 transition-colors cursor-pointer"
                        >
                          {/* Cliente */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor}`}>
                                {initials}
                              </div>
                              <div>
                                <div className="font-bold text-gray-900 line-clamp-1">{client.nombre || 'Sin Nombre'}</div>
                                <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                                  <span className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 text-gray-600 font-mono">
                                    {client.modelo || 'N/A'}
                                  </span>
                                  {client._normSource && (
                                    <span className="text-indigo-600 font-medium truncate max-w-[80px]">{client._normSource}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Contacto */}
                          <td className="px-6 py-4">
                            <button 
                              onClick={(e) => handleWhatsApp(e, safeText(client.whatsapp))}
                              className="group/btn flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all text-gray-600 hover:text-green-700 w-fit"
                            >
                              <MessageCircle size={14} className="text-green-500 group-hover/btn:scale-110 transition-transform"/>
                              <span className="font-mono text-xs font-medium">{formatWhatsApp(client.whatsapp as any) || 'Sin número'}</span>
                            </button>
                          </td>

                          {/* Ubicación */}
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-0.5">
                               <div className="flex items-center gap-1.5 text-gray-800 font-medium">
                                 <MapPin size={12} className="text-gray-400"/>
                                 {client.ciudad || 'No registrada'}
                               </div>
                               <span className="text-xs text-gray-400 pl-4.5">{client.agenda_ciudad_sede || '-'}</span>
                            </div>
                          </td>

                          {/* Etapa */}
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getEtapaColor(client.estado_etapa as any)}`}>
                              {(client.estado_etapa || 'SIN_ETAPA').replace(/_/g, ' ')}
                            </span>
                            {client._isEnvio && (
                              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-orange-600 font-medium bg-orange-50 w-fit px-1.5 py-0.5 rounded border border-orange-100">
                                <Truck size={10} /> Envíos
                              </div>
                            )}
                          </td>

                          {/* Fecha */}
                          <td className="px-6 py-4">
                            {client._tsAgenda > 0 ? (
                              <div className="flex items-center gap-2 text-gray-700">
                                <Calendar size={14} className="text-indigo-400"/>
                                <span className="font-medium">{formatDate(client.fecha_agenda as string)}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Sin agenda</span>
                            )}
                            <div className="text-[10px] text-gray-400 mt-1">
                              Creado: {client.created ? new Date(client.created).toLocaleDateString() : '-'}
                            </div>
                          </td>

                          {/* Acciones */}
                          <td className="px-6 py-4 text-center">
                             <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                               <Edit3 size={16} />
                             </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer Paginación */}
              <div className="bg-white border-t border-gray-100 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                 <div className="text-xs text-gray-500 font-medium">
                    Página <span className="text-gray-900">{currentPage}</span> de <span className="text-gray-900">{totalPages}</span>
                 </div>
                 
                 <div className="flex items-center gap-2">
                    <select 
                      value={pageSize} 
                      onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                      className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value={20}>20 / pág</option>
                      <option value={50}>50 / pág</option>
                      <option value={100}>100 / pág</option>
                    </select>

                    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                       <button 
                         onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                         disabled={currentPage === 1}
                         className="px-3 py-1.5 bg-white hover:bg-gray-50 disabled:opacity-50 border-r border-gray-200 transition-colors"
                       >
                         <ChevronLeft size={16} className="text-gray-600" />
                       </button>
                       <button 
                         onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                         disabled={currentPage === totalPages}
                         className="px-3 py-1.5 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
                       >
                         <ChevronRight size={16} className="text-gray-600" />
                       </button>
                    </div>
                 </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Detalle / Edición */}
      <ClientModal 
        isOpen={!!modalClient} 
        onClose={() => setModalClient(null)} 
        client={modalClient} 
        onUpdate={handleUpdateClient} 
      />
    </div>
  );
};