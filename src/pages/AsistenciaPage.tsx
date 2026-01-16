import React, { useEffect, useMemo, useState } from 'react';
import { 
  LifeBuoy, RefreshCw, Phone, MapPin, Search, 
  AlertCircle, CheckCircle2, X, ArrowUpDown, 
  Clock, MessageCircle, Bot, MessageSquare, 
  Smartphone, Check, Edit3, Globe, User, ClipboardCheck // <--- Importado ClipboardCheck
} from 'lucide-react';
import { Client } from '../types/client';
import { ClientService } from '../services/clientService';
import { formatWhatsApp, getEtapaColor } from '../utils/clientHelpers';
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
       // Añadir salto de línea si ya existían notas
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

  return (
    <div className="min-h-screen bg-rose-50/30 p-4 sm:p-6 space-y-6 w-full">
      
      {/* === Header & Filtros === */}
      <div className="sticky top-2 z-30 w-full">
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-sm border border-rose-100 p-3 md:p-4">
           <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 justify-between">
              
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center border border-rose-200 shadow-sm animate-pulse">
                    <LifeBuoy className="w-5 h-5" />
                 </div>
                 <div>
                    <h1 className="text-lg font-bold text-gray-900 leading-none">Solicitudes de Ayuda</h1>
                    <p className="text-xs text-rose-600 font-medium mt-1">{filtered.length} visibles</p>
                 </div>
              </div>

              <div className="flex flex-col xl:flex-row gap-2 flex-1 md:justify-end">
                 <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1">
                    <button onClick={() => setStatusFilter('PENDIENTES')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${statusFilter === 'PENDIENTES' ? 'bg-rose-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Pendientes</button>
                    <button onClick={() => setStatusFilter('GESTIONADOS')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${statusFilter === 'GESTIONADOS' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Gestionados</button>
                    <button onClick={() => setStatusFilter('TODOS')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${statusFilter === 'TODOS' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Todos</button>
                 </div>

                 <select value={sedeFilter} onChange={(e) => setSedeFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm outline-none">
                    <option value="Todas">Todas las Sedes</option>
                    {sedesList.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>

                 <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><ArrowUpDown className="h-4 w-4 text-gray-400" /></div>
                    <select value={sortOption} onChange={(e) => setSortOption(e.target.value as SortOption)} className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50/50 outline-none">
                       <option value="last_msg_desc">Última Actividad</option>
                       <option value="priority">Prioridad</option>
                       <option value="created_desc">Más Recientes</option>
                       <option value="created_asc">Más Antiguos</option>
                    </select>
                 </div>

                 <div className="relative w-full sm:w-64">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-4 w-4 text-gray-400" /></div>
                   <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50/50 focus:ring-2 focus:ring-rose-200" />
                   {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-3 h-3" /></button>}
                 </div>
                 
                 <button onClick={fetchClients} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-rose-500"><RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
              </div>
           </div>
        </div>
      </div>

      {/* === Lista === */}
      <div className="w-full space-y-4 pb-10">
         {loading ? (
           <div className="space-y-4 animate-pulse max-w-5xl mx-auto">{[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-2xl h-40 border border-gray-100"/>)}</div>
         ) : filtered.length > 0 ? (
           filtered.map((client) => {
             const botActive = isBotOn(client.consentimiento_contacto);
             const isGestionado = String(client.categoria_contacto).trim().toUpperCase() === CAT_GESTIONADA;
             
             return (
               <div 
                 key={client.row_number}
                 onClick={() => setViewClient(client)}
                 className={`group w-full bg-white rounded-2xl border transition-all duration-200 hover:shadow-lg overflow-hidden cursor-pointer relative ${isGestionado ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 hover:border-rose-200'}`}
               >
                 <div className="flex flex-col lg:flex-row items-stretch h-full">
                    
                    {/* IZQUIERDA */}
                    <div className="flex-1 p-5 flex flex-col justify-between gap-4">
                       <div className="flex flex-wrap items-center gap-3 text-sm">
                          {client.agenda_ciudad_sede && (
                            <div className="flex items-center gap-2 font-bold text-gray-600 bg-gray-50 px-3 py-1 rounded-lg border border-gray-100">
                               <MapPin className="w-3.5 h-3.5 text-gray-400" /> {safeText(client.agenda_ciudad_sede)}
                            </div>
                          )}
                          <div className={`flex items-center gap-2 font-bold px-3 py-1 rounded-lg border text-xs uppercase tracking-wide ${isGestionado ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                              {isGestionado ? 'Solucionado' : 'Pendiente'}
                          </div>
                       </div>

                       <div className="pl-1">
                          <h3 className={`text-xl font-bold leading-tight ${isGestionado ? 'text-emerald-900' : 'text-gray-800'}`}>
                             {safeText(client.nombre) || 'Usuario Desconocido'}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1 font-mono">
                             {formatWhatsApp(client.whatsapp as any)} {client.subscriber_id ? `• ID: ${client.subscriber_id}` : ''}
                          </p>

                          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-400">
                             <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                <Clock className="w-3 h-3 text-gray-400" /> <span>{formatTimeDate(client.created)}</span>
                             </div>
                             {client.last_msg && (
                               <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${isGestionado ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
                                  <MessageCircle className={`w-3 h-3 ${isGestionado ? 'text-emerald-400' : 'text-rose-400'}`} />
                                  <span>Act: <span className="font-bold">{formatTimeDate(client.last_msg)}</span></span>
                               </div>
                             )}
                          </div>
                       </div>
                    </div>

                    {/* DERECHA */}
                    <div className={`w-full lg:w-[35%] border-t lg:border-t-0 lg:border-l border-gray-100 p-5 flex flex-col justify-between gap-4 ${isGestionado ? 'bg-emerald-50/20' : 'bg-gray-50/30'}`}>
                       
                       {/* Header con Source y Asignado */}
                       <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-gray-200/50">
                          {safeText((client as any).source) && (
                             <span className="inline-flex items-center gap-1 text-[10px] bg-white/60 text-gray-600 px-2 py-0.5 rounded border border-gray-200 uppercase font-bold shadow-sm">
                                <Globe className="w-3 h-3" /> {safeText((client as any).source)}
                             </span>
                          )}
                          {safeText((client as any).asignado_a) && (
                             <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 uppercase font-bold shadow-sm">
                                <User className="w-3 h-3" /> {safeText((client as any).asignado_a)}
                             </span>
                          )}
                       </div>

                       {/* === NUEVO BLOQUE DE NOTAS DE SOLUCIÓN === */}
                       {isGestionado && safeText(client.notas) && (
                          <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-100 shadow-sm relative">
                             <div className="flex items-center justify-between mb-1.5">
                                 <span className="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-1">
                                   <ClipboardCheck className="w-3 h-3" /> Resolución / Notas
                                 </span>
                             </div>
                             <p className="text-sm text-emerald-900 line-clamp-4 leading-relaxed whitespace-pre-wrap font-medium">
                                {safeText(client.notas)}
                             </p>
                          </div>
                       )}

                       {/* Bloque Contexto Original */}
                       <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm relative group-hover:border-rose-100 transition-colors">
                          <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" /> Contexto (Problema)
                              </span>
                          </div>
                          <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed italic">
                             "{safeText(client.last_input_text) || safeText(client.intencion) || safeText(client.notas) || 'Sin mensaje previo...'}"
                          </p>
                       </div>
                       
                       <div className="mt-auto pt-3 border-t border-gray-200/50 flex flex-wrap justify-end gap-2">
                          
                          {/* BOTON GESTIONAR */}
                          <button
                             onClick={(e) => handleMainActionClick(client, e)}
                             className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors border active:scale-95 shadow-sm
                               ${isGestionado 
                                 ? 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50' 
                                 : 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200'}
                             `}
                          >
                             {isGestionado ? <X className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                             {isGestionado ? 'Reabrir' : 'Solucionar'}
                          </button>

                          <button onClick={(e) => handleToggleBot(client, e)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors border active:scale-95 ${botActive ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200'}`}>
                             {botActive ? <Bot className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />} {botActive ? 'BOT ON' : 'MANUAL'}
                          </button>

                          <button onClick={(e) => handleWhatsAppClick(client.whatsapp as any, e)} className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-lg text-xs font-bold transition-colors">
                             <Phone className="w-3.5 h-3.5" /> WhatsApp
                          </button>
                       </div>
                    </div>
                 </div>
               </div>
             );
           })
         ) : (
           <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 text-center max-w-4xl mx-auto">
              <LifeBuoy className="w-10 h-10 text-rose-300 mb-4" />
              <h3 className="text-xl font-bold text-gray-900">{statusFilter === 'PENDIENTES' ? 'No hay pendientes' : 'Sin resultados'}</h3>
              <p className="text-gray-500 mt-2">No se encontraron registros.</p>
           </div>
         )}
      </div>

      {/* ================= MODAL DE RESOLUCIÓN ================= */}
      {resolveModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100">
              <div className="bg-emerald-600 p-4 flex items-center justify-between">
                 <h3 className="text-white font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-100" /> Solucionar Solicitud
                 </h3>
                 <button onClick={() => setResolveModal(null)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              
              <div className="p-6">
                 <p className="text-gray-600 text-sm mb-4">
                    Estás a punto de marcar esta solicitud como <strong>Gestionada</strong>.<br/>
                    ¿Deseas agregar una nota interna sobre la solución?
                 </p>
                 
                 <div className="relative">
                    <Edit3 className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <textarea 
                       className="w-full pl-9 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm min-h-[100px]"
                       placeholder="Ej: Se contactó al cliente y se agendó cita..."
                       value={resolutionNote}
                       onChange={(e) => setResolutionNote(e.target.value)}
                       autoFocus
                    />
                 </div>

                 <div className="flex items-center justify-end gap-3 mt-6">
                    <button 
                       onClick={() => setResolveModal(null)}
                       className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm font-medium"
                    >
                       Cancelar
                    </button>
                    <button 
                       onClick={confirmResolution}
                       className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-200"
                    >
                       <Check className="w-4 h-4" /> 
                       {resolutionNote.trim() ? 'Guardar y Solucionar' : 'Solucionar sin Nota'}
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