import { RepairLoader } from '../components/RepairLoader';
import { Pagination } from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
// Mexico records existing guides manually, independently of Colombia's carrier integration.
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Truck, RefreshCw, Phone, MapPin, Search, ArrowRight,
  Package, CheckCircle2,
  ArrowUpDown, Clock,
  ChevronDown, BarChart3
} from 'lucide-react';
import { Client } from '../types/client';
import { ApiService } from '../services/apiService';
import { ClientService } from '../services/clientService';
import { EnvioMexicoDetailModal } from '../components/EnvioMexicoDetailModal';
import type { MexicoGuiaChanges } from '../components/EnvioMexicoGuiaForm';
import { EnviosMexicoReportModal } from '../components/EnviosMexicoReportModal';
import { normalize, formatTimeDate } from '../utils/textUtils';
import { useCountryConfig } from '../hooks/useCountryConfig';
import { cityKey } from '../utils/countryConfig';
import {
  checkMexicoGuiaData as checkGuiaDataComplete, hasMexicoLogisticsData as hasLogisticsData,
  isMexicoEnvioGestionado as isEnvioGestionado, mexicoText as safeText, mexicoDisplay,
  mexicoShipmentStatus, COSTO_ENTRADA_MXN, formatMXN,
} from '../utils/enviosMexico';
import { useAuth } from '../hooks/useAuth';

type SortOption = 'priority' | 'created_desc' | 'last_msg_desc';
type TabOption = 'PENDIENTES' | 'GESTIONADOS' | 'TODOS';

/** ================== Componente Principal ================== */
export const EnviosMexicoPage: React.FC = () => {
  const { user } = useAuth();
  const { country } = useCountryConfig();
  const isAdmin = useMemo(
    () => user?.role?.split(',').some((role) => ['admin', 'root'].includes(role.trim().toLowerCase())) ?? false,
    [user?.role],
  );
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [sedeFilter, setSedeFilter] = useState<string>('Todas');
  const [currentTab, setCurrentTab] = useState<TabOption>('PENDIENTES');
  const [sortOption, setSortOption] = useState<SortOption>('last_msg_desc');

  // Estado UI
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [savingRow, setSavingRow] = useState<number | null>(null);
  const [focusGuias, setFocusGuias] = useState(false);
  const saving = useRef(false);

  const saveShipment = async (client: Client, changes: MexicoGuiaChanges | Partial<Pick<Client, 'estado_etapa' | 'categoria_contacto'>>) => {
    if (saving.current) throw new Error('Espera a que termine el guardado actual.');
    saving.current = true;
    setSavingRow(client.row_number);
    try {
      const payload = { row_number: client.row_number, ...changes };
      await ClientService.updateClient(payload);
      setClients(previous => previous.map(item => item.row_number === client.row_number ? { ...item, ...changes } : item));
      setViewClient(previous => previous?.row_number === client.row_number ? { ...previous, ...changes } : previous);
      window.dispatchEvent(new CustomEvent('client:updated', { detail: { ...payload, pais_sede: country } }));
    } finally { saving.current = false; setSavingRow(null); }
  };

  const markManaged = async (client: Client) => {
    setError(null);
    try {
      await saveShipment(client, {
        estado_etapa: 'ENVIO_GESTIONADO',
        ...(normalize(client.categoria_contacto) === 'solicitud_ayuda' ? { categoria_contacto: 'SOLICITUD_AYUDA_GESTIONADA' as const } : {}),
      });
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo marcar el envío como gestionado.'); }
  };

  const closeDetail = useCallback(() => { setViewClient(null); setFocusGuias(false); }, []);
  const fetchClients = useCallback(async (force = true) => {
    try {
      setLoading(true);
      setError(null);
      const data = await ClientService.getEnviosClients({ force });
      const arr = Array.isArray(data) ? (data as Client[]) : [];
      // Filtramos usando la lógica permisiva
      setClients(arr.filter(client => (!client.pais_sede || cityKey(client.pais_sede) === cityKey(country)) && hasLogisticsData(client)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar envíos');
    } finally {
      setLoading(false);
    }
  }, [country]);

  useEffect(() => { void fetchClients(false); }, [fetchClients]);

  // Escuchar actualizaciones externas
  useEffect(() => {
    const onExternalUpdate = (ev: Event) => {
      const detail = (ev as CustomEvent<Partial<Client>>).detail;
      if (!detail?.row_number || (detail.pais_sede && cityKey(detail.pais_sede) !== cityKey(country))) return;
      ApiService.invalidateCache();
      setClients(prev => {
        const updated = prev.map(c => c.row_number === detail.row_number ? ({ ...c, ...detail } as Client) : c);
        // Volvemos a filtrar para asegurar que siga cumpliendo condiciones
        return updated.filter(hasLogisticsData);
      });
      setViewClient(v => (v?.row_number === detail.row_number ? ({ ...v, ...detail } as Client) : v));
    };
    window.addEventListener('client:updated', onExternalUpdate);
    return () => window.removeEventListener('client:updated', onExternalUpdate);
  }, [country]);

  const sedesList = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach(c => {
      const raw = safeText(c.agenda_ciudad_sede);
      if (!raw) return;
      const key = normalize(raw);
      if (key && !map.has(key)) {
        map.set(key, raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase());
      }
    });
    return Array.from(map.values()).sort();
  }, [clients]);

  const filtered = useMemo(() => {
    let data = [...clients];

    // 1. Filtro Tabs (Etapa)
    if (currentTab === 'PENDIENTES') {
      data = data.filter(c => !isEnvioGestionado(c));
    } else if (currentTab === 'GESTIONADOS') {
      data = data.filter(c => isEnvioGestionado(c));
    }

    // 2. Filtro Sede
    if (sedeFilter !== 'Todas') {
      const normSedeFilter = normalize(sedeFilter);
      data = data.filter(c => normalize(safeText(c.agenda_ciudad_sede)) === normSedeFilter);
    }

    // 3. Búsqueda Segura
    if (deferredSearch.trim()) {
      const q = normalize(deferredSearch);
      data = data.filter(c =>
        normalize(c.guia_nombre_completo).includes(q) ||
        normalize(c.guia_numero_ida).includes(q) ||
        normalize(c.whatsapp).includes(q) ||
        normalize(c.guia_numero_retorno).includes(q) ||
        normalize(c.guia_telefono).includes(q) ||
        normalize(c.guia_email).includes(q) ||
        normalize(c.guia_direccion).includes(q)
      );
    }

    return data.sort((a,b) => {
      const getTs = (v: Client['created'] | number) => (!v ? 0 : (typeof v === 'number' && v < 10000000000 ? v * 1000 : new Date(v).getTime()));
      if (sortOption === 'created_desc') return getTs(b.created) - getTs(a.created);
      if (sortOption === 'last_msg_desc') return getTs(b.last_msg) - getTs(a.last_msg);

      const score = (c: Client) => {
         const { isComplete } = checkGuiaDataComplete(c);
         if (!isComplete) return 0; // Alta prioridad
         if (!safeText(c.guia_numero_ida)) return 1;
         return 2;
      };
      return (score(a) - score(b)) || (getTs(b.created) - getTs(a.created));
    });
  }, [clients, sedeFilter, currentTab, deferredSearch, sortOption]);

  const pagination = usePagination(filtered, JSON.stringify([deferredSearch, sedeFilter, currentTab, sortOption]));

  return (
    <div className="page-container wt-shipping-page relative flex min-w-0 flex-col space-y-4 sm:space-y-6 min-h-[calc(100vh-100px)]">
      {error && <div role="alert" className="relative z-10 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {/* Background Decorations */}

      {/* === Header Dashboard === */}
      <div className="relative z-10 flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="wt-page-heading flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-slate-950 text-white flex items-center justify-center shadow-lg shadow-black/15 relative z-10 border border-white/10">
                <Truck className="w-6 h-6" />
              </div>
            </div>
            <div>
              <h1 className="wt-page-title">Envíos México</h1>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex -space-x-1">
                   <div className="w-2 h-2 rounded-full bg-slate-800 border-2 border-white" />
                   <div className="w-2 h-2 rounded-full bg-slate-300 border-2 border-white animate-ping" />
                </div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.15em]">DHL · Gestión y registro manual de guías</p>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
             <div className="wt-shipping-tabs grid w-full grid-cols-3 bg-slate-100/80 p-1 rounded-xl border border-slate-200/70 sm:w-auto">
                <button
                  onClick={() => setCurrentTab('PENDIENTES')}
                  className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-200 flex items-center gap-2
                    ${currentTab === 'PENDIENTES'
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}
                  `}
                >
                  <Clock size={12} /> Pendientes
                </button>
                <button
                  onClick={() => setCurrentTab('GESTIONADOS')}
                  className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-200 flex items-center gap-2
                    ${currentTab === 'GESTIONADOS'
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}
                  `}
                >
                  <CheckCircle2 size={12} /> Gestionados
                </button>
                <button
                  onClick={() => setCurrentTab('TODOS')}
                  className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-200
                    ${currentTab === 'TODOS'
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}
                  `}
                >
                  Todos
                </button>
             </div>

      {isAdmin && (
            <button
               onClick={() => setShowReportModal(true)}
               className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-4 text-xs font-bold text-white shadow-md shadow-slate-900/15 transition hover:bg-slate-800 active:scale-95 sm:flex-none"
               type="button"
             >
                <BarChart3 className="w-4 h-4" />
                <span>Reportes</span>
             </button>
            )}
             <button
               onClick={() => void fetchClients()}
               aria-label="Actualizar envíos"
               disabled={loading}
               className="h-11 w-11 shrink-0 flex items-center justify-center bg-white shadow-sm border border-slate-200 rounded-xl text-slate-500 hover:text-slate-900 hover:border-slate-300 active:scale-95 transition group disabled:opacity-50"
             >
                {loading ? <RepairLoader variant="icon" /> : <RefreshCw className={`w-5 h-5 ${loading ? '' : 'group-hover:rotate-180 transition-transform duration-500'}`} />}
             </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-2.5 flex flex-col md:flex-row gap-3 shadow-sm">
          <div className="relative group flex-1">
             <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-700 transition-colors">
                <Search size={16} />
             </div>
             <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, guía, teléfono, correo o dirección..."
                className="w-full pl-12 pr-6 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 focus:bg-white transition-all"
             />
          </div>

          <div className="wt-shipping-filters grid min-w-0 gap-2.5 sm:grid-cols-2">
             <div className="relative min-w-0 group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-colors">
                  <MapPin size={14} />
                </div>
                <select
                   value={sedeFilter}
                   onChange={(e) => setSedeFilter(e.target.value)}
                   className="appearance-none pl-9 pr-10 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-600 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 focus:bg-white cursor-pointer transition-all min-w-[160px]"
                >
                  <option value="Todas">Todas las Sedes</option>
                  {sedesList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
             </div>

             <div className="relative min-w-0 group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-slate-700 transition-colors">
                  <ArrowUpDown size={14} />
                </div>
                <select
                   value={sortOption}
                   onChange={(e) => setSortOption(e.target.value as SortOption)}
                   className="appearance-none pl-9 pr-10 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-600 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 focus:bg-white cursor-pointer transition-all"
                >
                  <option value="priority">Prioridad (Datos)</option>
                  <option value="last_msg_desc">Última Actividad</option>
                  <option value="created_desc">Recientes Primero</option>
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
             </div>
          </div>
        </div>
      </div>

      {!loading && <Pagination {...pagination} />}

      {/* === Logistics List === */}
      <div className="w-full mx-auto space-y-3 pb-20 relative z-10">
         {loading && clients.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-50">
              <RepairLoader variant="icon" className="repair-loader--large" />
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Sincronizando Logística...</p>
           </div>
         ) : filtered.length > 0 ? (
           <div className="grid grid-cols-1 gap-3">
             {pagination.items.map((client) => {
               const status = mexicoShipmentStatus(client);
               const { isComplete } = checkGuiaDataComplete(client);
               const isGestionado = isEnvioGestionado(client);
               const shippingOrigin = mexicoDisplay(client.guia_ciudad);
               const shippingDestination = mexicoDisplay(client.agenda_ciudad_sede);

               return (
                 <div
                   key={client.row_number}
                   onClick={() => setViewClient(client)}
                   className="group wt-ops-card cursor-pointer animate-in fade-in slide-in-from-bottom-4"
                 >
                   {/* Status Strip */}
                   <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-500 ${isGestionado ? 'bg-emerald-500' : 'bg-slate-800'} ${!isGestionado && !isComplete ? 'bg-amber-400' : ''}`} />

                   <div className="wt-ops-card-layout">

                     {/* LEFT: Origin-Destination Path */}
                     <div className="wt-ops-card-rail">
                        <div className="flex flex-col items-center gap-2">
                           <div className="w-9 h-9 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-700">
                             <MapPin size={16} />
                           </div>
                           <span className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">Origen</span>
                           <span className="max-w-[108px] truncate text-center text-[9px] font-black uppercase tracking-tight text-slate-700" title={shippingOrigin}>{shippingOrigin}</span>
                        </div>

                        <div className="h-[20px] w-[2px] bg-gradient-to-b from-slate-300 to-slate-100 hidden lg:block relative">
                           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white border border-slate-400" />
                        </div>
                        <ArrowRight size={14} className="text-slate-300 lg:hidden" />

                        <div className="flex flex-col items-center gap-2">
                           <div className="w-9 h-9 rounded-xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-800">
                             <MapPin size={16} />
                           </div>
                           <span className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">Sede registrada</span>
                           <span className="max-w-[108px] truncate text-center text-[9px] font-black uppercase tracking-tight text-slate-900">{shippingDestination}</span>
                        </div>
                     </div>

                     {/* CENTER: Main info & Shipment Numbers */}
                     <div className="wt-ops-card-main">
                        <div className="flex flex-col items-start justify-between gap-3 mb-4 sm:flex-row sm:gap-4">
                           <div className="wt-shipping-client-summary min-w-0 flex-1">
                               <div className="flex items-center gap-3 mb-1 flex-wrap">
                                  <h3 className="break-words text-base sm:text-lg font-black text-slate-900 leading-tight tracking-tight group-hover:text-slate-800 transition-colors">
                                     {mexicoDisplay(client.guia_nombre_completo)}
                                  </h3>
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shadow-sm border flex items-center gap-1.5
                                     ${isGestionado
                                       ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                       : 'bg-slate-50 text-slate-800 border-slate-200'}
                                  `}>
                                     {isGestionado ? 'Gestionado' : 'Pendiente'}
                                  </span>
                               </div>

                               <div className="flex flex-wrap items-center gap-3 text-xs">
                                  <div className="flex items-center gap-1.5 text-slate-400 font-bold group/val">
                                     <Phone className="w-3 h-3 text-emerald-400 group-hover/val:scale-110 transition-transform" />
                                     <span className="font-mono tracking-tight group-hover/val:text-emerald-600 transition-colors uppercase leading-none">{mexicoDisplay(client.guia_telefono)}</span>
                                  </div>
                                  <div className="h-3 w-[1px] bg-slate-200" />
                                  <div className="wt-ops-chip">
                                     <Clock className="w-3 h-3 text-slate-400" />
                                     <span className="truncate">{(formatTimeDate(client.last_msg || client.created) === '—' ? 'No registrado' : formatTimeDate(client.last_msg || client.created))}</span>
                                  </div>
                                  <div className="wt-ops-chip">
                                     <Truck className="w-3 h-3 text-slate-400" />
                                     <span className="truncate">{mexicoDisplay(client.guia_departamento_estado)}</span>
                                  </div>
                               </div>
                           </div>

                           <div className={`max-w-full px-2 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1.5 ${isComplete ? 'bg-slate-50 text-slate-700 border-slate-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                              <Truck className="h-4 w-4" />
                              {status}
                           </div>
                        </div>

                        {/* Shipping Numbers Boxes */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                           <div className={`p-3 rounded-xl border transition-all relative group/box
                              ${safeText(client.guia_numero_ida)
                                ? 'bg-slate-50 border-slate-200/50'
                                : 'bg-slate-50/50 border-slate-200/50 opacity-60'}
                           `}>
                              <span className="absolute -top-2 left-4 px-1.5 py-0.5 bg-white text-slate-700 text-[8px] font-black uppercase tracking-widest rounded-lg border border-slate-200 shadow-sm">
                                 Guía de Ida
                              </span>
                              <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-3">
                                    <Package className="w-4 h-4 text-slate-400" />
                                    <p className="font-mono text-sm font-black text-slate-800 tracking-wider">
                                       {mexicoDisplay(client.guia_numero_ida)}
                                    </p>
                                 </div>
                                 {safeText(client.guia_numero_ida) && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                              </div>
                           </div>

                           <div className={`p-3 rounded-xl border transition-all relative group/box
                              ${safeText(client.guia_numero_retorno)
                                ? 'bg-slate-50 border-slate-200/50'
                                : 'bg-slate-50/50 border-slate-200/50 opacity-60'}
                           `}>
                              <span className="absolute -top-2 left-4 px-1.5 py-0.5 bg-white text-slate-600 text-[8px] font-black uppercase tracking-widest rounded-lg border border-slate-200 shadow-sm">
                                 Guía de Retorno
                              </span>
                              <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-3">
                                    <Package className="w-4 h-4 text-slate-400" />
                                    <p className="font-mono text-sm font-black text-slate-800 tracking-wider">
                                       {mexicoDisplay(client.guia_numero_retorno)}
                                    </p>
                                 </div>
                                 {safeText(client.guia_numero_retorno) && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* RIGHT: Meta info & Actions */}
                     <div className={`wt-ops-card-aside ${isGestionado ? 'bg-emerald-50/20' : ''}`}>
                        <div className="flex h-full flex-col justify-center gap-2">
                           <p className="text-xs font-bold text-slate-900">DHL</p>
                           <p className="text-xs text-slate-500">Costo informado de entrada</p>
                           <p className="text-lg font-black text-slate-900">{formatMXN(COSTO_ENTRADA_MXN)}</p>
                           <button type="button" onClick={event => { event.stopPropagation(); setViewClient(client); }} className="rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white hover:bg-slate-800">Ver detalle</button>
                           <button type="button" onClick={event => { event.stopPropagation(); setFocusGuias(true); setViewClient(client); }} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50">Registrar guías</button>
                           <button type="button" disabled={savingRow !== null || isGestionado} onClick={event => { event.stopPropagation(); void markManaged(client); }} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                             <CheckCircle2 className="h-4 w-4" />{savingRow === client.row_number ? 'Guardando...' : isGestionado ? 'Gestionado' : 'Marcar como gestionado'}
                           </button>

                        </div>
                     </div>
                   </div>
                 </div>
               );
             })}
           </div>
         ) : (
           <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in zoom-in duration-700 relative">
              <div className="w-24 h-24 rounded-[40px] bg-white shadow-2xl shadow-slate-200/50 flex items-center justify-center mb-8 border border-white relative group">
                 <div className="absolute inset-0 bg-slate-800 blur-3xl opacity-10 group-hover:opacity-20 transition-opacity" />
                 <Truck className={`w-10 h-10 ${currentTab === 'PENDIENTES' ? 'text-slate-500' : 'text-slate-300'} relative z-10`} />
              </div>
              <h3 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">
                  {currentTab === 'PENDIENTES' ? 'Logística al Día' : 'Sin Resultados'}
              </h3>
              <p className="text-slate-500 max-w-xs font-semibold leading-relaxed">
                 {currentTab === 'PENDIENTES'
                   ? 'No hay envíos pendientes por gestionar. Todo el flujo logístico está en proceso o finalizado.'
                   : 'No se encontraron registros que coincidan con los filtros aplicados en esta categoría.'}
              </p>
              <button
                onClick={() => { setCurrentTab('PENDIENTES'); setSearch(''); setSedeFilter('Todas'); }}
                className="mt-10 px-10 py-4 bg-slate-900 text-white rounded-[24px] font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl shadow-slate-200 hover:bg-black hover:shadow-black/20 hover:-translate-y-1 transition-all active:scale-95"
              >
                Ver Pendientes
              </button>
           </div>
         )}
      </div>

      {isAdmin && (
      <EnviosMexicoReportModal
        clients={clients}
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onOpenClient={setViewClient}
        isClientOpen={!!viewClient}
      />
      )}
      <EnvioMexicoDetailModal client={viewClient} onClose={closeDetail} onSaveGuias={saveShipment} focusGuias={focusGuias} />
    </div>
  );
};
