import React, { useEffect, useMemo, useState } from 'react';
import { 
  LifeBuoy, RefreshCw, Phone, MapPin, Search, 
  AlertCircle, CheckCircle2, X, ArrowUpDown, 
  Clock, MessageCircle, Bot, MessageSquare, 
  Smartphone, Check, Edit3, Globe, User, ClipboardCheck, 
  Filter, ChevronDown, Fingerprint
} from 'lucide-react';
import { Client } from '../types/client';
import { ClientService } from '../services/clientService';
import { formatWhatsApp } from '../utils/clientHelpers';
import { ClientModal } from '../components/ClientModal';
import { normalize, safeText, formatTimeDate, isBotOn } from '../utils/textUtils';

// Constantes de Categoría
const CAT_PENDIENTE = 'SOLICITUD_AYUDA';
const CAT_GESTIONADA = 'SOLICITUD_AYUDA_GESTIONADA';

// Filtro Maestro
const isAssistanceTarget = (c: Client): boolean => {
  if (!c.categoria_contacto) return false;
  const cat = String(c.categoria_contacto).trim().toUpperCase();
  return cat === CAT_PENDIENTE || cat === CAT_GESTIONADA;
};

type SortOption = 'last_msg_desc' | 'created_desc' | 'created_asc' | 'priority';
type StatusFilter = 'TODOS' | 'PENDIENTES' | 'GESTIONADOS';

/** ================== Componente Principal ================== */
export const AsistenciaPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros UI
  const [search, setSearch] = useState('');
  const [sedeFilter, setSedeFilter] = useState<string>('Todas');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDIENTES');
  const [sortOption, setSortOption] = useState<SortOption>('last_msg_desc');

  // Estado UI General
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [savingRow, setSavingRow] = useState<number | null>(null);

  // Modal de Resolución
  const [resolveModal, setResolveModal] = useState<{client: Client} | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  /** --- Carga de datos --- */
  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ClientService.getAsistenciaClients();
      const arr = Array.isArray(data) ? (data as Client[]) : [];
      setClients(arr.filter(isAssistanceTarget));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar solicitudes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  /** --- Realtime Update --- */
  useEffect(() => {
    const onExternalUpdate = (ev: Event) => {
      const detail = (ev as CustomEvent<Partial<Client>>).detail;
      if (!detail?.row_number) return;
      
      setClients(prev => {
        const updatedList = prev.map(c => c.row_number === detail.row_number ? ({ ...c, ...detail } as Client) : c);
        return updatedList.filter(isAssistanceTarget); 
      });
      
      setViewClient(v => (v?.row_number === detail.row_number ? ({ ...v, ...detail } as Client) : v));
    };
    window.addEventListener('client:updated', onExternalUpdate as any);
    return () => window.removeEventListener('client:updated', onExternalUpdate as any);
  }, []);

  /** --- Update Logic --- */
  const onUpdate = async (payload: Partial<Client>): Promise<boolean> => {
    if (!payload.row_number) return false;
    setSavingRow(payload.row_number);
    const prevClients = clients;

    setClients(prev => prev.map(c => c.row_number === payload.row_number ? ({ ...c, ...payload } as Client) : c));
    if (viewClient && viewClient.row_number === payload.row_number) {
      setViewClient(prev => ({ ...prev!, ...payload } as Client));
    }

    try {
      if (typeof (ClientService as any).updateClient === 'function') {
        await (ClientService as any).updateClient(payload);
      } else {
        await fetch('/api/clients/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      return true;
    } catch (e) {
      setClients(prevClients); 
      alert("Error al guardar");
      return false;
    } finally {
      setSavingRow(null);
    }
  };

  /** --- LOGICA DE BOTONES --- */
  const handleMainActionClick = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentCat = String(client.categoria_contacto).trim().toUpperCase();
    
    if (currentCat === CAT_GESTIONADA) {
      if (window.confirm("¿Reabrir esta solicitud como Pendiente?")) {
        onUpdate({
           row_number: client.row_number,
           categoria_contacto: CAT_PENDIENTE
        });
      }
    } else {
      setResolutionNote('');
      setResolveModal({ client });
    }
  };

  const confirmResolution = async () => {
    if (!resolveModal) return;
    const { client } = resolveModal;
    
    let updatePayload: Partial<Client> = {
       row_number: client.row_number,
       categoria_contacto: CAT_GESTIONADA
    };

    if (resolutionNote.trim()) {
       const timestamp = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
       const prevNotes = safeText(client.notas);
       const separator = prevNotes ? '\n\n' : ''; 
       const newNoteEntry = `${separator}[Solución ${timestamp}]: ${resolutionNote.trim()}`;
       
       updatePayload.notas = (prevNotes + newNoteEntry).trim();
    }

    await onUpdate(updatePayload);
    setResolveModal(null);
  };

  /** --- Listas y Filtros --- */
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

  const stats = useMemo(() => {
    return {
      pendientes: clients.filter(c => String(c.categoria_contacto).trim().toUpperCase() === CAT_PENDIENTE).length,
      gestionados: clients.filter(c => String(c.categoria_contacto).trim().toUpperCase() === CAT_GESTIONADA).length,
      total: clients.length,
    };
  }, [clients]);

  const filtered = useMemo(() => {
    let data = [...clients];

    if (statusFilter === 'PENDIENTES') {
       data = data.filter(c => String(c.categoria_contacto).trim().toUpperCase() === CAT_PENDIENTE);
    } else if (statusFilter === 'GESTIONADOS') {
       data = data.filter(c => String(c.categoria_contacto).trim().toUpperCase() === CAT_GESTIONADA);
    }

    if (sedeFilter !== 'Todas') {
      const normSedeFilter = normalize(sedeFilter);
      data = data.filter(c => normalize(safeText(c.agenda_ciudad_sede)) === normSedeFilter);
    }

    if (search.trim()) {
      const q = normalize(search);
      data = data.filter(c => 
        normalize(safeText(c.nombre)).includes(q) ||
        normalize(safeText(c.whatsapp)).includes(q) ||
        normalize(safeText(c.modelo)).includes(q) ||
        safeText((c as any).subscriber_id).includes(q) ||
        normalize(safeText(c.last_msg)).includes(q)
      );
    }

    return data.sort((a,b) => {
      const getTs = (v: any) => typeof v === 'number' && v < 10000000000 ? v * 1000 : new Date(v || 0).getTime();
      
      if (sortOption === 'created_desc') return getTs(b.created) - getTs(a.created);
      if (sortOption === 'created_asc') return getTs(a.created) - getTs(b.created);
      if (sortOption === 'last_msg_desc') return getTs(b.last_msg) - getTs(a.last_msg);

      const hasName = safeText(a.nombre) ? 1 : 0;
      const hasNameB = safeText(b.nombre) ? 1 : 0;
      return (hasName - hasNameB) || (getTs(b.last_msg) - getTs(a.last_msg));
    });

  }, [clients, sedeFilter, search, sortOption, statusFilter]);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, sedeFilter, statusFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const handleWhatsAppClick = (whatsapp: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://wa.me/${safeText(whatsapp).replace('@s.whatsapp.net', '')}`, '_blank');
  };

  const handleToggleBot = async (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentlyOn = isBotOn(client.consentimiento_contacto);
    await onUpdate({ row_number: client.row_number, consentimiento_contacto: !currentlyOn });
  };

  const FilterPill = ({ id, label, count, current }: { id: StatusFilter, label: string, count?: number, current: StatusFilter }) => (
    <button 
      onClick={() => setStatusFilter(id)} 
      className={`px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 border flex items-center gap-2
        ${current === id 
          ? id === 'PENDIENTES' ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-200'
          : id === 'GESTIONADOS' ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-200'
          : 'bg-slate-900 text-white border-slate-800 shadow-lg shadow-slate-200'
          : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50 hover:text-slate-600'
        }`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${current === id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="page-container relative flex flex-col space-y-8 min-h-[calc(100vh-100px)] overflow-hidden">
      
      {/* Background Decorations */}
      <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-rose-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />

      {/* === Header Dashboard === */}
      <div className="relative z-10 flex flex-col gap-8 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="absolute inset-0 bg-rose-400 blur-xl opacity-20 animate-pulse" />
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 via-rose-600 to-rose-700 text-white flex items-center justify-center shadow-xl shadow-rose-200/40 relative z-10 border border-white/20">
                <LifeBuoy className="w-7 h-7" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 leading-none tracking-tight">Centro de Ayuda</h1>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex -space-x-1">
                   <div className="w-2 h-2 rounded-full bg-rose-500 border-2 border-white" />
                   <div className="w-2 h-2 rounded-full bg-rose-300 border-2 border-white animate-ping" />
                </div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.15em]">Soporte en Tiempo Real</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="wt-input-wrap w-full md:w-[280px] lg:w-[350px]">
               <Search className="wt-input-icon text-slate-400" />
               <input
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 placeholder="Buscar..."
                 className="bg-white/60 backdrop-blur-sm border-white/40 shadow-sm focus:bg-white text-sm"
                 type="search"
               />
             </div>
             <button 
               onClick={fetchClients} 
               disabled={loading} 
               className="flex items-center justify-center w-11 h-11 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/40 text-slate-400 hover:text-rose-500 hover:bg-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
             >
               <RefreshCw className={`w-4.5 h-4.5 ${loading ? 'animate-spin' : ''}`} />
             </button>
          </div>
        </div>

        {/* Filters & Stats */}
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/50 backdrop-blur-sm rounded-2xl border border-slate-200/30">
            <FilterPill id="PENDIENTES" label="Pendientes" count={stats.pendientes} current={statusFilter} />
            <FilterPill id="GESTIONADOS" label="Gestionados" count={stats.gestionados} current={statusFilter} />
            <FilterPill id="TODOS" label="Todos" count={stats.total} current={statusFilter} />
          </div>

          <div className="flex items-center gap-4">
             <div className="h-10 w-[1px] bg-slate-200 hidden md:block" />
             
             {/* Sede Select */}
             <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-slate-700 transition-colors">
                  <MapPin size={14} />
                </div>
                <select 
                   value={sedeFilter} 
                   onChange={(e) => setSedeFilter(e.target.value)} 
                   className="appearance-none pl-9 pr-10 py-2.5 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-600 outline-none focus:ring-4 focus:ring-slate-700/5 focus:bg-white cursor-pointer transition-all"
                >
                   <option value="Todas">Todas las Sedes</option>
                   {sedesList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
             </div>

             {/* Sort Select */}
             <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-slate-700 transition-colors">
                  <ArrowUpDown size={14} />
                </div>
                <select 
                   value={sortOption} 
                   onChange={(e) => setSortOption(e.target.value as SortOption)} 
                   className="appearance-none pl-9 pr-10 py-2.5 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-600 outline-none focus:ring-4 focus:ring-slate-700/5 focus:bg-white cursor-pointer transition-all"
                >
                  <option value="last_msg_desc">Más Recientes</option>
                  <option value="priority">Prioridad</option>
                  <option value="created_desc">Nuevos Primero</option>
                  <option value="created_asc">Antiguos Primero</option>
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
             </div>
          </div>
        </div>
      </div>

      {/* === Ticket List === */}
      <div className="w-full max-w-7xl mx-auto space-y-4 pb-20 relative z-10">
         {loading && clients.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-50">
              <RefreshCw className="w-10 h-10 animate-spin text-rose-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Sincronizando Ayuda...</p>
           </div>
         ) : filtered.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-5">
                {paginatedClients.map((client) => {
                  const botActive = isBotOn(client.consentimiento_contacto);
                  const isGestionado = String(client.categoria_contacto).trim().toUpperCase() === CAT_GESTIONADA;
                  const isSaving = savingRow === client.row_number;

                  const lastMsg = client.last_msg;
                  const lastMsgDate = client.created; 
                  
                  return (
                    <div
                      key={client.row_number}
                      onClick={() => setViewClient(client)}
                      className="group relative rounded-[28px] bg-white/70 backdrop-blur-xl border border-white/40 shadow-xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 active:scale-[0.99] cursor-pointer animate-in fade-in slide-in-from-bottom-4 duration-500"
                    >
                      {/* Left border strip */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-300
                         ${isGestionado 
                            ? 'bg-emerald-500' 
                            : 'bg-rose-500 animate-pulse-soft'}`} 
                      />

                      <div className="flex flex-col lg:flex-row items-stretch">
                         {/* LEFT COLUMN: Avatar / Basic Status */}
                         <div className="flex flex-row lg:flex-col items-center justify-between lg:justify-center gap-4 p-6 lg:w-[150px] lg:bg-slate-50/40 lg:border-r border-white/20">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm border border-white
                               ${isGestionado 
                                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-100' 
                                  : 'bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-rose-100'}`}
                            >
                               {client.nombre ? client.nombre.charAt(0).toUpperCase() : '?'}
                            </div>
                            
                            <div className="flex lg:flex-col items-center gap-1.5">
                               <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-sm border
                                  ${isGestionado 
                                     ? 'bg-emerald-500 text-white border-emerald-400' 
                                     : 'bg-rose-500 text-white border-rose-400 animate-pulse'}`}
                               >
                                  {isGestionado ? 'Gestionado' : 'Pendiente'}
                               </span>
                               
                               {isSaving && (
                                  <span className="text-[9px] font-bold text-slate-400 animate-pulse mt-1">
                                     Guardando...
                                  </span>
                               )}
                            </div>
                         </div>

                         {/* CENTER COLUMN: Core Ticket info */}
                         <div className="flex-1 p-6 flex flex-col justify-center gap-3.5">
                            <div>
                               <h3 className="text-lg md:text-xl font-black text-slate-900 group-hover:text-rose-500 transition-colors duration-300">
                                  {client.nombre || 'Sin Nombre'}
                               </h3>
                               
                               <div className="flex flex-wrap items-center gap-2 mt-2">
                                  <span className="text-xs font-bold text-slate-400">
                                     {formatWhatsApp(client.whatsapp as any)}
                                  </span>
                                  
                                  {((client as any).subscriber_id) && (
                                     <>
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-slate-400 uppercase">
                                           <Fingerprint size={10} /> ID: {String((client as any).subscriber_id).substring(0, 12)}...
                                        </span>
                                     </>
                                  )}
                               </div>
                            </div>

                            {/* Solicitud Description box */}
                            {client.last_msg && (
                               <div className="p-4 rounded-2xl bg-rose-50/30 border border-rose-100/50 text-xs leading-relaxed text-slate-700">
                                  <div className="flex items-center gap-1.5 mb-1.5 text-rose-800 font-bold uppercase text-[9px] tracking-wider">
                                     <MessageSquare size={12} /> Solicitud / Problema
                                  </div>
                                  <p className="font-semibold italic">"{client.last_msg}"</p>
                               </div>
                            )}

                            {/* Resolution Notes box if it exists */}
                            {client.notas && (
                               <div className="p-4 rounded-2xl bg-emerald-50/20 border border-emerald-100/50 text-xs leading-relaxed text-slate-600">
                                  <div className="flex items-center gap-1.5 mb-1.5 text-emerald-800 font-bold uppercase text-[9px] tracking-wider">
                                     <ClipboardCheck size={12} /> Notas de Resolución
                                  </div>
                                  <p className="font-medium whitespace-pre-wrap max-h-[100px] overflow-y-auto">{client.notas}</p>
                                </div>
                            )}
                         </div>

                         {/* RIGHT COLUMN: Metadata & Actions */}
                         <div className="p-6 lg:w-[260px] lg:bg-slate-50/20 lg:border-l border-white/20 flex flex-col justify-between gap-4">
                            <div className="space-y-3">
                               {/* Sede indicator */}
                               <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 rounded-xl text-[10px] font-bold text-slate-600 w-fit">
                                  <MapPin size={12} className="text-slate-400" />
                                  <span>{safeText(client.agenda_ciudad_sede) || 'Sede sin definir'}</span>
                               </div>

                               {/* Activity timestamp */}
                               <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400">
                                  <Clock size={12} />
                                  <span>Activo {lastMsgDate ? formatTimeDate(lastMsgDate) : 'hace tiempo'}</span>
                               </div>
                            </div>

                            <div className="space-y-2">
                               <button 
                                  onClick={(e) => handleMainActionClick(client, e)}
                                  disabled={isSaving}
                                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-[18px] text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 shadow-sm
                                     ${isGestionado 
                                       ? 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-800' 
                                       : 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-200/40 hover:bg-emerald-700 hover:-translate-y-0.5'}
                                  `}
                               >
                                  {isGestionado ? <RefreshCw className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                  {isGestionado ? 'Reabrir Ticket' : 'Resolver'}
                               </button>

                               <div className="grid grid-cols-2 gap-2">
                                  <button 
                                     onClick={(e) => handleToggleBot(client, e)} 
                                     className={`flex items-center justify-center gap-2 py-2.5 rounded-[18px] text-[9px] font-black uppercase tracking-widest border transition-all active:scale-95
                                        ${botActive 
                                           ? 'bg-white text-slate-800 border-slate-200 hover:shadow-sm' 
                                           : 'bg-white text-rose-700 border-rose-100 hover:shadow-sm'}
                                     `}
                                  >
                                     <Bot size={12} className={botActive ? 'text-slate-700' : 'text-rose-400'} /> 
                                     {botActive ? 'Bot ON' : 'Bot OFF'}
                                  </button>
                                  
                                  <button 
                                     onClick={(e) => handleWhatsAppClick(client.whatsapp as any, e)} 
                                     className="flex items-center justify-center gap-2 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-white border border-emerald-100 rounded-[18px] text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm"
                                  >
                                     <Phone size={12} /> WhatsApp
                                  </button>
                               </div>
                            </div>
                         </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* PAGINACIÓN */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 px-5 py-4 bg-white/60 backdrop-blur-md border border-white/40 rounded-[24px] shadow-lg">
                  <div className="text-xs font-black uppercase text-slate-500 tracking-wider">
                    Mostrando <span className="text-slate-800 font-bold">{Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filtered.length)}</span> a{' '}
                    <span className="text-slate-800 font-bold">{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</span> de{' '}
                    <span className="text-slate-800 font-bold">{filtered.length}</span> registros
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all font-bold shadow-sm"
                    >
                      &larr;
                    </button>
                    
                    {(() => {
                      const pages = [];
                      const maxVisible = 5;
                      let start = Math.max(1, currentPage - 2);
                      let end = Math.min(totalPages, start + maxVisible - 1);
                      
                      if (end - start + 1 < maxVisible) {
                        start = Math.max(1, end - maxVisible + 1);
                      }
                      
                      if (start > 1) {
                        pages.push(
                          <button
                            key={1}
                            onClick={() => setCurrentPage(1)}
                            className={`w-10 h-10 rounded-xl text-xs font-black transition-all active:scale-95 ${
                              currentPage === 1
                                ? 'bg-slate-900 text-white shadow-md'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            1
                          </button>
                        );
                        if (start > 2) {
                          pages.push(<span key="dots-prev" className="px-2 text-slate-400 font-black text-xs">...</span>);
                        }
                      }
                      
                      for (let p = start; p <= end; p++) {
                        pages.push(
                          <button
                            key={p}
                            onClick={() => setCurrentPage(p)}
                            className={`w-10 h-10 rounded-xl text-xs font-black transition-all active:scale-95 ${
                              currentPage === p
                                ? 'bg-slate-900 text-white shadow-md'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {p}
                          </button>
                        );
                      }
                      
                      if (end < totalPages) {
                        if (end < totalPages - 1) {
                          pages.push(<span key="dots-next" className="px-2 text-slate-400 font-black text-xs">...</span>);
                        }
                        pages.push(
                          <button
                            key={totalPages}
                            onClick={() => setCurrentPage(totalPages)}
                            className={`w-10 h-10 rounded-xl text-xs font-black transition-all active:scale-95 ${
                              currentPage === totalPages
                                ? 'bg-slate-900 text-white shadow-md'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {totalPages}
                          </button>
                        );
                      }
                      
                      return pages;
                    })()}
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all font-bold shadow-sm"
                    >
                      &rarr;
                    </button>
                  </div>
                </div>
              )}
            </>
         ) : (
           <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in zoom-in duration-700 relative">
              <div className="w-24 h-24 rounded-[40px] bg-white shadow-2xl shadow-slate-200/50 flex items-center justify-center mb-8 border border-white relative group">
                 <div className="absolute inset-0 bg-rose-500 blur-3xl opacity-10 group-hover:opacity-20 transition-opacity" />
                 <LifeBuoy className={`w-10 h-10 ${statusFilter === 'PENDIENTES' ? 'text-emerald-400' : 'text-slate-300'} relative z-10`} />
              </div>
              <h3 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">
                  {statusFilter === 'PENDIENTES' ? '¡Todo Resuelto!' : 'Sin Registros'}
              </h3>
              <p className="text-slate-500 max-w-xs font-semibold leading-relaxed">
                 {statusFilter === 'PENDIENTES' 
                   ? 'No hay solicitudes de ayuda pendientes en este momento. Los canales están fluyendo perfectamente.' 
                   : 'No se encontraron tickets en esta categoría con los filtros aplicados.'}
              </p>
              <button 
                onClick={() => { setStatusFilter('PENDIENTES'); setSearch(''); setSedeFilter('Todas'); }}
                className="mt-10 px-10 py-4 bg-slate-900 text-white rounded-[24px] font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl shadow-slate-200 hover:bg-black hover:shadow-black/20 hover:-translate-y-1 transition-all active:scale-95"
              >
                Volver al Dashboard
              </button>
           </div>
         )}
      </div>

      {/* ================= MODERN RESOLUTION MODAL ================= */}
      {resolveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setResolveModal(null)} />
           
           <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden relative z-10 animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 border border-white/20">
              {/* Header Modal */}
              <div className="bg-emerald-600 px-10 py-8 relative overflow-hidden">
                 <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-white/10 blur-[60px] rounded-full pointer-events-none" />
                 <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-2">
                       <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/20">
                          <CheckCircle2 className="w-6 h-6 text-white" />
                       </div>
                       <h3 className="text-white font-black text-2xl tracking-tight">Cerrar Ticket</h3>
                    </div>
                    <p className="text-emerald-100 font-bold text-xs uppercase tracking-widest pl-1">Registrar resolución final</p>
                 </div>
                 <button 
                  onClick={() => setResolveModal(null)} 
                  className="absolute top-6 right-6 text-white/50 hover:text-white hover:bg-white/10 p-2.5 rounded-full transition-all"
                 >
                    <X className="w-6 h-6" />
                 </button>
              </div>
              
              <div className="p-10 space-y-8">
                 <div className="flex items-start gap-5">
                     <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                         <ClipboardCheck className="w-6 h-6 text-emerald-600" />
                     </div>
                     <div>
                         <h4 className="text-slate-900 font-black text-lg mb-1 leading-none tracking-tight">Finalizar gestión</h4>
                         <p className="text-slate-500 text-sm leading-relaxed font-medium">
                            Marcarás la solicitud de <span className="font-bold text-slate-800">{safeText(resolveModal.client.nombre)}</span> como gestionada.
                         </p>
                     </div>
                 </div>
                 
                 <div className="relative group/field">
                    <div className="absolute left-5 top-5 text-slate-400 group-focus-within/field:text-emerald-500 transition-colors">
                        <Edit3 size={18} />
                    </div>
                    <textarea 
                       className="w-full pl-12 p-6 bg-slate-50 border-transparent rounded-[24px] text-slate-700 placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-200 outline-none shadow-inner resize-none text-sm transition-all"
                       placeholder="Describe brevemente cómo se resolvió el caso..."
                       rows={4}
                       value={resolutionNote}
                       onChange={(e) => setResolutionNote(e.target.value)}
                       autoFocus
                    />
                 </div>

                 <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-4">
                    <button 
                       onClick={() => setResolveModal(null)}
                       className="w-full sm:w-auto px-8 py-4 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-[20px] text-[11px] font-black uppercase tracking-widest transition-all"
                    >
                       Cancelar
                    </button>
                    <button 
                       onClick={confirmResolution}
                       className="w-full sm:w-auto px-10 py-4 bg-emerald-600 hover:bg-black text-white rounded-[20px] text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-200 hover:shadow-black/20 transition-all active:scale-95"
                    >
                       {resolutionNote.trim() ? 'Guardar Solución' : 'Finalizar sin Nota'}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Modal Detalle Cliente */}
      <ClientModal
        isOpen={!!viewClient}
        onClose={() => setViewClient(null)}
        client={viewClient}
        onUpdate={onUpdate}
      />
    </div>
  );
};