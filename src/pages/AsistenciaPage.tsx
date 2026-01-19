import React, { useEffect, useMemo, useState } from 'react';
import { 
  LifeBuoy, RefreshCw, Phone, MapPin, Search, 
  AlertCircle, CheckCircle2, X, ArrowUpDown, 
  Clock, MessageCircle, Bot, MessageSquare, 
  Smartphone, Check, Edit3, Globe, User, ClipboardCheck, 
  Filter, ChevronDown
} from 'lucide-react';
import { Client } from '../types/client';
import { ClientService } from '../services/clientService';
import { formatWhatsApp } from '../utils/clientHelpers';
import { ClientModal } from '../components/ClientModal';

/** ================== Helpers ================== */
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();

const isInvalid = (v: unknown) => {
  const c = String(v || '').toLowerCase().trim();
  return !c || c === 'no aplica' || c === 'no' || c === 'null' || c === 'undefined';
};

const safeText = (v: unknown) => {
  if (isInvalid(v)) return '';
  return String(v).trim();
};

const formatTimeDate = (val: string | number | undefined) => {
  if (!val) return '—';
  const date = new Date(typeof val === 'number' && val < 10000000000 ? val * 1000 : val);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' });
};

const isBotOn = (v: any) => {
  if (v === false) return false;
  if (String(v).toLowerCase() === 'false') return false;
  return true; 
};

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
      const data = await ClientService.getClients();
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
    const s = new Set<string>();
    clients.forEach(c => { if(safeText(c.agenda_ciudad_sede)) s.add(safeText(c.agenda_ciudad_sede)); });
    return Array.from(s).sort();
  }, [clients]);

  const filtered = useMemo(() => {
    let data = [...clients];

    if (statusFilter === 'PENDIENTES') {
       data = data.filter(c => String(c.categoria_contacto).trim().toUpperCase() === CAT_PENDIENTE);
    } else if (statusFilter === 'GESTIONADOS') {
       data = data.filter(c => String(c.categoria_contacto).trim().toUpperCase() === CAT_GESTIONADA);
    }

    if (sedeFilter !== 'Todas') {
      data = data.filter(c => safeText(c.agenda_ciudad_sede) === sedeFilter);
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

  const handleWhatsAppClick = (whatsapp: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://wa.me/${safeText(whatsapp).replace('@s.whatsapp.net', '')}`, '_blank');
  };

  const handleToggleBot = async (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentlyOn = isBotOn(client.consentimiento_contacto);
    await onUpdate({ row_number: client.row_number, consentimiento_contacto: !currentlyOn });
  };

  const FilterPill = ({ id, label, current }: { id: StatusFilter, label: string, current: StatusFilter }) => (
    <button 
      onClick={() => setStatusFilter(id)} 
      className={`px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200 border
        ${current === id 
          ? id === 'PENDIENTES' ? 'bg-rose-500 text-white border-rose-600 shadow-md shadow-rose-200'
          : id === 'GESTIONADOS' ? 'bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-200'
          : 'bg-slate-800 text-white border-slate-900 shadow-md'
          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
        }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50/80 p-3 sm:p-6 space-y-6 w-full font-sans text-slate-800">
      
      {/* === Header & Filtros Flotantes === */}
      <div className="sticky top-4 z-40 w-full max-w-7xl mx-auto">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 p-4 ring-1 ring-slate-900/5">
           <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
              
              {/* Title Section */}
              <div className="flex items-center gap-4 min-w-[200px]">
                 <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-200">
                    <LifeBuoy className="w-6 h-6" />
                 </div>
                 <div>
                    <h1 className="text-xl font-extrabold text-slate-900 leading-none tracking-tight">Solicitudes</h1>
                    <p className="text-xs text-rose-500 font-bold uppercase tracking-wider mt-1.5 flex items-center gap-1">
                      {filtered.length} tickets visibles
                    </p>
                 </div>
              </div>

              {/* Controls Section */}
              <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto items-stretch md:items-center flex-wrap">
                 
                 {/* Status Pills */}
                 <div className="flex p-1 bg-slate-100 rounded-2xl gap-1">
                    <FilterPill id="PENDIENTES" label="Pendientes" current={statusFilter} />
                    <FilterPill id="GESTIONADOS" label="Resueltos" current={statusFilter} />
                    <FilterPill id="TODOS" label="Todos" current={statusFilter} />
                 </div>

                 <div className="h-8 w-px bg-slate-200 hidden md:block mx-1"></div>

                 {/* Filters Row */}
                 <div className="flex gap-2 flex-1 md:flex-initial">
                    {/* Sede Select */}
                    <div className="relative group">
                        <select 
                            value={sedeFilter} 
                            onChange={(e) => setSedeFilter(e.target.value)} 
                            className="appearance-none pl-3 pr-8 py-2.5 rounded-xl border-none bg-slate-100 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer min-w-[140px]"
                        >
                            <option value="Todas">Todas Sedes</option>
                            {sedesList.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-slate-600" />
                    </div>

                    {/* Sort Select */}
                    <div className="relative group">
                         <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                         </div>
                        <select 
                            value={sortOption} 
                            onChange={(e) => setSortOption(e.target.value as SortOption)} 
                            className="appearance-none pl-8 pr-8 py-2.5 rounded-xl border-none bg-slate-100 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                        >
                           <option value="last_msg_desc">Recientes</option>
                           <option value="priority">Prioridad</option>
                           <option value="created_desc">Nuevos</option>
                           <option value="created_asc">Antiguos</option>
                        </select>
                    </div>
                 </div>

                 {/* Search */}
                 <div className="relative flex-1 md:min-w-[220px]">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <Search className="h-4 w-4 text-slate-400" />
                   </div>
                   <input 
                       value={search} 
                       onChange={(e) => setSearch(e.target.value)} 
                       placeholder="Buscar cliente, id, mensaje..." 
                       className="w-full pl-9 pr-8 py-2.5 border-none rounded-xl text-sm bg-slate-100 text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:shadow-md transition-all" 
                   />
                   {search && (
                       <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
                           <X className="w-3 h-3" />
                       </button>
                   )}
                 </div>
                 
                 <button 
                    onClick={fetchClients} 
                    className="p-2.5 rounded-xl bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors border border-slate-200"
                    title="Actualizar lista"
                 >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                 </button>
              </div>
           </div>
        </div>
      </div>

      {/* === Lista de Cards === */}
      <div className="w-full max-w-7xl mx-auto space-y-4 pb-12">
         {loading ? (
           <div className="space-y-4 animate-pulse max-w-5xl mx-auto">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white rounded-[20px] h-48 w-full border border-slate-100 shadow-sm"/>
                ))}
           </div>
         ) : filtered.length > 0 ? (
           filtered.map((client) => {
             const botActive = isBotOn(client.consentimiento_contacto);
             const isGestionado = String(client.categoria_contacto).trim().toUpperCase() === CAT_GESTIONADA;
             
             return (
               <div 
                 key={client.row_number}
                 onClick={() => setViewClient(client)}
                 className={`group relative w-full bg-white rounded-[20px] border transition-all duration-300 hover:shadow-[0_10px_40px_rgb(0,0,0,0.06)] hover:-translate-y-0.5 overflow-hidden cursor-pointer
                    ${isGestionado 
                        ? 'border-emerald-100 shadow-sm' 
                        : 'border-rose-100 shadow-sm hover:border-rose-200'}
                 `}
               >
                 {/* Status Strip Lateral */}
                 <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isGestionado ? 'bg-emerald-500' : 'bg-rose-500'} transition-colors duration-300`} />

                 <div className="flex flex-col lg:flex-row items-stretch h-full pl-1.5">
                    
                    {/* IZQUIERDA: Info Cliente */}
                    <div className="flex-1 p-5 flex flex-col justify-between gap-4">
                       <div className="flex items-start justify-between">
                           <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className={`text-xl font-bold tracking-tight ${isGestionado ? 'text-emerald-950' : 'text-slate-900'}`}>
                                        {safeText(client.nombre) || 'Usuario Desconocido'}
                                    </h3>
                                    {safeText((client as any).source) && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-500 uppercase tracking-wide border border-slate-200">
                                            {safeText((client as any).source)}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-slate-500 font-medium flex items-center gap-2">
                                    <Smartphone className="w-3.5 h-3.5" />
                                    {formatWhatsApp(client.whatsapp as any)} 
                                    {client.subscriber_id && <span className="text-slate-300">|</span>}
                                    {client.subscriber_id && <span className="font-mono text-xs text-slate-400">ID: {client.subscriber_id}</span>}
                                </p>
                           </div>

                           <div className={`px-3 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider shadow-sm
                                ${isGestionado 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                    : 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse'}
                           `}>
                              {isGestionado ? 'Solucionado' : 'Pendiente'}
                           </div>
                       </div>

                       {/* Metadata Chips */}
                       <div className="flex flex-wrap items-center gap-2 text-xs">
                          {client.agenda_ciudad_sede && (
                            <div className="flex items-center gap-1.5 font-semibold text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                               <MapPin className="w-3.5 h-3.5 text-slate-400" /> {safeText(client.agenda_ciudad_sede)}
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1.5 bg-slate-50 text-slate-500 px-2.5 py-1.5 rounded-lg border border-slate-100">
                            <Clock className="w-3.5 h-3.5 text-slate-400" /> 
                            <span>Creado: {formatTimeDate(client.created)}</span>
                          </div>

                          {client.last_msg && (
                             <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-medium ${isGestionado ? 'bg-emerald-50/50 border-emerald-100 text-emerald-700' : 'bg-rose-50/50 border-rose-100 text-rose-700'}`}>
                                <MessageCircle className={`w-3.5 h-3.5 ${isGestionado ? 'text-emerald-500' : 'text-rose-500'}`} />
                                <span>Actividad: {formatTimeDate(client.last_msg)}</span>
                             </div>
                           )}
                       </div>
                    </div>

                    {/* DERECHA: Contexto y Acciones */}
                    <div className={`w-full lg:w-[40%] border-t lg:border-t-0 lg:border-l border-slate-100 p-5 flex flex-col justify-between gap-4 ${isGestionado ? 'bg-emerald-50/10' : 'bg-rose-50/10'}`}>
                       
                       <div className="space-y-3">
                            {/* Bloque Contexto Original (Problema) */}
                            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm relative group-hover:border-rose-100 transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <MessageSquare className="w-3 h-3" /> Contexto / Problema
                                    </span>
                                </div>
                                <p className="text-sm text-slate-700 line-clamp-2 leading-relaxed italic">
                                    "{safeText(client.last_input_text) || safeText(client.intencion) || safeText(client.notas) || 'Sin mensaje previo...'}"
                                </p>
                            </div>

                            {/* === BLOQUE DE NOTAS DE SOLUCIÓN === */}
                            {isGestionado && safeText(client.notas) && (
                                <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-100/60 relative animate-in fade-in zoom-in-95 duration-300">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                                            <ClipboardCheck className="w-3 h-3" /> Resolución Aplicada
                                        </span>
                                    </div>
                                    <p className="text-sm text-emerald-900 line-clamp-3 leading-relaxed whitespace-pre-wrap font-medium">
                                        {safeText(client.notas)}
                                    </p>
                                </div>
                            )}
                       </div>
                       
                       {/* Toolbar Acciones */}
                       <div className="mt-auto pt-4 border-t border-slate-200/50 flex flex-wrap justify-end gap-2">
                          
                          {/* BOTON GESTIONAR */}
                          <button
                             onClick={(e) => handleMainActionClick(client, e)}
                             className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border active:scale-95 shadow-sm
                               ${isGestionado 
                                 ? 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700' 
                                 : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-200 hover:shadow-md'}
                             `}
                          >
                             {isGestionado ? <X className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                             {isGestionado ? 'Reabrir Caso' : 'Solucionar'}
                          </button>

                          <button 
                            onClick={(e) => handleToggleBot(client, e)} 
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border active:scale-95 
                                ${botActive 
                                    ? 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100' 
                                    : 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100'}
                            `}
                          >
                             {botActive ? <Bot className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />} 
                             {botActive ? 'Bot Activo' : 'Bot Apagado'}
                          </button>

                          <button 
                            onClick={(e) => handleWhatsAppClick(client.whatsapp as any, e)} 
                            className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-xl text-xs font-bold transition-colors"
                          >
                             <Phone className="w-3.5 h-3.5" /> WhatsApp
                          </button>
                       </div>
                    </div>
                 </div>
               </div>
             );
           })
         ) : (
           <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[32px] border border-dashed border-slate-200 text-center max-w-3xl mx-auto shadow-sm">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-inner ${statusFilter === 'PENDIENTES' ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                 <LifeBuoy className={`w-10 h-10 ${statusFilter === 'PENDIENTES' ? 'text-rose-300' : 'text-emerald-300'}`} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">
                  {statusFilter === 'PENDIENTES' ? 'Todo al día' : 'Sin registros'}
              </h3>
              <p className="text-slate-500 max-w-sm mx-auto">
                 {statusFilter === 'PENDIENTES' 
                    ? 'No hay solicitudes de ayuda pendientes en este momento. ¡Buen trabajo!' 
                    : 'No se encontraron tickets con los filtros actuales.'}
              </p>
           </div>
         )}
      </div>

      {/* ================= MODAL DE RESOLUCIÓN REFINADO ================= */}
      {resolveModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden transform transition-all scale-100 ring-1 ring-white/20">
              
              {/* Header Modal */}
              <div className="bg-emerald-600 px-6 py-5 flex items-center justify-between relative overflow-hidden">
                 <div className="absolute inset-0 bg-emerald-500/20 pattern-dots opacity-30"></div>
                 <h3 className="text-white font-bold text-lg flex items-center gap-2.5 relative z-10">
                    <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                        <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    Solucionar Solicitud
                 </h3>
                 <button onClick={() => setResolveModal(null)} className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-full transition-all relative z-10">
                    <X className="w-5 h-5" />
                 </button>
              </div>
              
              <div className="p-6 sm:p-8">
                 <div className="flex items-start gap-4 mb-6">
                     <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                         <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                     </div>
                     <div>
                         <h4 className="text-slate-900 font-bold mb-1">Finalizar gestión</h4>
                         <p className="text-slate-500 text-sm leading-relaxed">
                            Estás por marcar el caso de <span className="font-semibold text-slate-700">{safeText(resolveModal.client.nombre)}</span> como <span className="text-emerald-600 font-bold">Gestionado</span>.
                            ¿Deseas agregar una nota interna?
                         </p>
                     </div>
                 </div>
                 
                 <div className="relative group">
                    <div className="absolute left-3.5 top-3.5 text-slate-400">
                        <Edit3 className="w-4 h-4" />
                    </div>
                    <textarea 
                       className="w-full pl-10 p-3.5 bg-slate-50 border-0 rounded-2xl text-slate-700 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 shadow-inner resize-none text-sm transition-all"
                       placeholder="Escribe aquí los detalles de la solución (opcional)..."
                       rows={4}
                       value={resolutionNote}
                       onChange={(e) => setResolutionNote(e.target.value)}
                       autoFocus
                    />
                 </div>

                 <div className="flex items-center justify-end gap-3 mt-8">
                    <button 
                       onClick={() => setResolveModal(null)}
                       className="px-5 py-2.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl text-sm font-bold transition-all"
                    >
                       Cancelar
                    </button>
                    <button 
                       onClick={confirmResolution}
                       className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-200 hover:shadow-xl hover:-translate-y-0.5 transition-all"
                    >
                       <Check className="w-4 h-4" /> 
                       {resolutionNote.trim() ? 'Guardar Resolución' : 'Confirmar sin Nota'}
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