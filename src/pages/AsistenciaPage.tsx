// src/pages/AsistenciaPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { 
  LifeBuoy, RefreshCw, Phone, MapPin, Search, 
  AlertCircle, CheckCircle2, X, ArrowUpDown, 
  Clock, MessageCircle, Bot, User, MessageSquare, Smartphone
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

// Lógica de Estado del Bot
const isBotOn = (v: any) => {
  if (v === false) return false;
  if (String(v).toLowerCase() === 'false') return false;
  return true; 
};

/**
 * FILTRO ESTRICTO:
 * Solo clientes donde categoria_contacto sea exactamente "SOLICITUD_AYUDA"
 */
const isAssistanceTarget = (c: Client): boolean => {
  if (!c.categoria_contacto) return false;
  // Convertimos a mayúsculas y limpiamos espacios para asegurar la igualdad estricta
  return String(c.categoria_contacto).trim().toUpperCase() === 'SOLICITUD_AYUDA';
};

// Tipos de ordenamiento
type SortOption = 'last_msg_desc' | 'created_desc' | 'created_asc' | 'priority';

/** ================== Componente Principal ================== */
export const AsistenciaPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros UI
  const [search, setSearch] = useState('');
  const [sedeFilter, setSedeFilter] = useState<string>('Todas');
  
  // Ordenamiento
  const [sortOption, setSortOption] = useState<SortOption>('last_msg_desc');

  // Estado UI
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [savingRow, setSavingRow] = useState<number | null>(null);

  /** --- Carga de datos --- */
  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ClientService.getClients();
      const arr = Array.isArray(data) ? (data as Client[]) : [];
      // Filtramos SOLO Solicitud de Ayuda estricto
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
        // Actualizamos el cliente si existe, o lo procesamos
        const updatedList = prev.map(c => c.row_number === detail.row_number ? ({ ...c, ...detail } as Client) : c);
        
        // Volvemos a filtrar para asegurar que cumpla la condición estricta
        // (Si se cambió la categoría a otra cosa, desaparecerá de la lista)
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

    // Optimista
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
      setClients(prevClients); // Rollback
      alert("Error al guardar");
      return false;
    } finally {
      setSavingRow(null);
    }
  };

  /** --- Listas para selectores --- */
  const sedesList = useMemo(() => {
    const s = new Set<string>();
    clients.forEach(c => { if(safeText(c.agenda_ciudad_sede)) s.add(safeText(c.agenda_ciudad_sede)); });
    return Array.from(s).sort();
  }, [clients]);

  /** --- Filtrado y Ordenamiento --- */
  const filtered = useMemo(() => {
    let data = [...clients];

    // 1. Sede
    if (sedeFilter !== 'Todas') {
      data = data.filter(c => safeText(c.agenda_ciudad_sede) === sedeFilter);
    }

    // 2. Búsqueda Global
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

    // 3. Ordenamiento
    return data.sort((a,b) => {
      const getTs = (v: any) => {
          if (!v) return 0;
          return typeof v === 'number' && v < 10000000000 ? v * 1000 : new Date(v).getTime();
      };

      if (sortOption === 'created_desc') return getTs(b.created) - getTs(a.created);
      if (sortOption === 'created_asc') return getTs(a.created) - getTs(b.created);
      if (sortOption === 'last_msg_desc') return getTs(b.last_msg) - getTs(a.last_msg);

      // Default: Priority (Sin nombre primero)
      const hasName = safeText(a.nombre) ? 1 : 0;
      const hasNameB = safeText(b.nombre) ? 1 : 0;
      return (hasName - hasNameB) || (getTs(b.last_msg) - getTs(a.last_msg));
    });

  }, [clients, sedeFilter, search, sortOption]);


  /** --- Actions --- */
  const handleWhatsAppClick = (whatsapp: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://wa.me/${safeText(whatsapp).replace('@s.whatsapp.net', '')}`, '_blank');
  };

  const handleToggleBot = async (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentlyOn = isBotOn(client.consentimiento_contacto);
    
    if (currentlyOn) {
      const confirm = window.confirm(`¿Pausar el Bot para ${client.nombre || 'este usuario'}?`);
      if (!confirm) return;
    }

    await onUpdate({ 
      row_number: client.row_number, 
      consentimiento_contacto: !currentlyOn 
    });
  };

  return (
    <div className="min-h-screen bg-rose-50/30 p-4 sm:p-6 space-y-6 w-full">
      
      {/* === Header & Filtros === */}
      <div className="sticky top-2 z-30 w-full">
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-sm border border-rose-100 p-3 md:p-4">
           <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 justify-between">
              
              {/* Título e Icono */}
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center border border-rose-200 shadow-sm animate-pulse">
                    <LifeBuoy className="w-5 h-5" />
                 </div>
                 <div>
                    <h1 className="text-lg font-bold text-gray-900 leading-none">Solicitudes de Ayuda</h1>
                    <p className="text-xs text-rose-600 font-medium mt-1">{filtered.length} pendientes</p>
                 </div>
              </div>

              {/* Barra Filtros */}
              <div className="flex flex-col xl:flex-row gap-2 flex-1 md:justify-end">
                 
                 {/* Selector Sede */}
                 <select 
                   value={sedeFilter} 
                   onChange={(e) => setSedeFilter(e.target.value)}
                   className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-rose-200 outline-none cursor-pointer"
                 >
                    <option value="Todas">Todas las Sedes</option>
                    {sedesList.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>

                 {/* Selector Ordenamiento */}
                 <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <ArrowUpDown className="h-4 w-4 text-gray-400" />
                    </div>
                    <select
                      value={sortOption}
                      onChange={(e) => setSortOption(e.target.value as SortOption)}
                      className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm focus:bg-white bg-gray-50/50 focus:ring-2 focus:ring-rose-200 outline-none cursor-pointer appearance-none"
                    >
                       <option value="last_msg_desc">Última Actividad (Msg)</option>
                       <option value="priority">Prioridad (Sin Nombre)</option>
                       <option value="created_desc">Más Recientes (Creación)</option>
                       <option value="created_asc">Más Antiguos (Creación)</option>
                    </select>
                 </div>

                 {/* Buscador */}
                 <div className="relative w-full sm:w-64">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                   </div>
                   <input
                     value={search}
                     onChange={(e) => setSearch(e.target.value)}
                     placeholder="Buscar nombre, ID, mensaje..."
                     className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm focus:bg-white bg-gray-50/50 focus:ring-2 focus:ring-rose-200 transition-all"
                   />
                   {search && (
                      <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X className="w-3 h-3" />
                      </button>
                   )}
                 </div>

                 <button onClick={fetchClients} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-rose-500">
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                 </button>
              </div>
           </div>
        </div>
      </div>

      {/* === Content List === */}
      <div className="w-full space-y-4 pb-10">
         {loading ? (
           <div className="space-y-4 animate-pulse max-w-5xl mx-auto">
             {[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-2xl h-40 border border-gray-100"/>)}
           </div>
         ) : filtered.length > 0 ? (
           filtered.map((client) => {
             const botActive = isBotOn(client.consentimiento_contacto);
             
             return (
               <div 
                 key={client.row_number}
                 onClick={() => setViewClient(client)}
                 className={`group w-full bg-white rounded-2xl border border-gray-200 transition-all duration-200 hover:shadow-lg hover:border-rose-200 overflow-hidden cursor-pointer relative`}
               >
                 <div className="flex flex-col lg:flex-row items-stretch h-full">
                    
                    {/* === IZQUIERDA: Info Principal === */}
                    <div className="flex-1 p-5 flex flex-col justify-between gap-4">
                       
                       {/* Header: Sede y Modelo */}
                       <div className="flex flex-wrap items-center gap-3 text-sm">
                          {client.agenda_ciudad_sede && (
                            <div className="flex items-center gap-2 font-bold text-gray-600 bg-gray-50 px-3 py-1 rounded-lg border border-gray-100">
                               <MapPin className="w-3.5 h-3.5 text-gray-400" />
                               {safeText(client.agenda_ciudad_sede)}
                            </div>
                          )}
                          {client.modelo && (
                            <div className="flex items-center gap-2 font-medium text-gray-600 bg-gray-50 px-3 py-1 rounded-lg border border-gray-100">
                               <Smartphone className="w-3.5 h-3.5 text-gray-400" />
                               {safeText(client.modelo)}
                            </div>
                          )}
                       </div>

                       {/* Main Name & Phone */}
                       <div className="pl-1">
                          <h3 className="text-xl font-bold text-gray-800 leading-tight">
                             {safeText(client.nombre) || 'Usuario Desconocido'}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1 font-mono">
                             {formatWhatsApp(client.whatsapp as any)} {client.subscriber_id ? `• ID: ${client.subscriber_id}` : ''}
                          </p>

                          {/* Fechas */}
                          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-400">
                             <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                <Clock className="w-3 h-3 text-gray-400" />
                                <span>Ingreso: <span className="font-medium text-gray-600">{formatTimeDate(client.created)}</span></span>
                             </div>
                             {client.last_msg && (
                               <div className="flex items-center gap-1.5 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                                  <MessageCircle className="w-3 h-3 text-rose-400" />
                                  <span className="text-rose-700">Actividad: <span className="font-bold">{formatTimeDate(client.last_msg)}</span></span>
                               </div>
                             )}
                          </div>
                       </div>
                    </div>

                    {/* === DERECHA: Contexto y Acciones === */}
                    <div className="w-full lg:w-[35%] border-t lg:border-t-0 lg:border-l border-gray-100 p-5 flex flex-col justify-between gap-4 bg-gray-50/30">
                       
                       {/* Contexto: Último Mensaje o Intención */}
                       <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm relative group-hover:border-rose-100 transition-colors">
                          <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" /> Contexto
                              </span>
                          </div>
                          <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed italic">
                             "{safeText(client.last_input_text) || safeText(client.intencion) || safeText(client.notas) || 'Sin mensaje previo...'}"
                          </p>
                       </div>
                       
                       {/* Estado Etapa (Badge) */}
                       {client.estado_etapa && (
                         <div className="flex justify-end">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getEtapaColor(client.estado_etapa as any)}`}>
                              {client.estado_etapa.replace(/_/g, ' ')}
                            </span>
                         </div>
                       )}

                       {/* Footer: WhatsApp y Bot */}
                       <div className="mt-auto pt-3 border-t border-gray-200/50 flex justify-end gap-2">
                          {/* BOTON BOT */}
                          <button
                             onClick={(e) => handleToggleBot(client, e)}
                             className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors border active:scale-95
                               ${botActive 
                                 ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' 
                                 : 'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200'}
                             `}
                             title={botActive ? "El Bot está respondiendo (Click para pausar)" : "El Bot está pausado (Click para activar)"}
                          >
                             {botActive ? <Bot className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                             {botActive ? 'BOT ON' : 'MANUAL'}
                          </button>

                          {/* BOTON WHATSAPP */}
                          <button 
                             onClick={(e) => handleWhatsAppClick(client.whatsapp as any, e)}
                             className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-lg text-xs font-bold transition-colors"
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
           /* EMPTY STATE */
           <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 text-center max-w-4xl mx-auto">
              <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-4 shadow-inner">
                 <LifeBuoy className="w-10 h-10 text-rose-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">No hay solicitudes pendientes</h3>
              <p className="text-gray-500 max-w-md mt-2 px-4 text-center">
                {search 
                  ? `No se encontraron resultados para "${search}" en la lista de asistencia.`
                  : `¡Todo limpio! No hay clientes con la categoría "SOLICITUD_AYUDA" en este momento.`}
              </p>
           </div>
         )}
      </div>

      <ClientModal
        isOpen={!!viewClient}
        onClose={() => setViewClient(null)}
        client={viewClient}
        onUpdate={onUpdate}
      />
    </div>
  );
};