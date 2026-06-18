// src/pages/EnviosPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { 
  Truck, RefreshCw, Phone, MapPin, Search, ArrowRight, 
  Package, ShieldCheck, AlertTriangle, CheckCircle2, X,
  ArrowUpDown, Clock, MessageCircle, Bot, AlertCircle,
  Send, ClipboardCheck, User, ChevronDown
} from 'lucide-react';
import { Client } from '../types/client';
import { ClientService } from '../services/clientService';
import { formatWhatsApp, deriveEnvioUI, ENVIO_LABELS } from '../utils/clientHelpers';
import type { EnvioUIKey } from '../utils/clientHelpers';
import { ClientModal } from '../components/ClientModal';
import { safeText, normalize, formatTimeDate, isBotOn } from '../utils/textUtils';

// --- VALIDACIÓN DE CAMPOS OBLIGATORIOS PARA RECOGIDA ---
const checkGuiaDataComplete = (c: Client) => {
  const required = [
    'guia_nombre_completo', 'guia_cedula_id', 'guia_telefono', 
    'guia_direccion', 'guia_ciudad', 'guia_departamento_estado', 'guia_email'
  ];
  // Filtramos los que falten usando safeText
  const missing = required.filter(field => !safeText((c as any)[field]));
  return {
    isComplete: missing.length === 0,
    missingFields: missing
  };
};

/**
 * FILTRO DE APARICIÓN (PERMISIVO):
 * El cliente aparece si tiene AL MENOS UN dato de logística relevante.
 * Esto permite ver usuarios incompletos para terminar de llenarlos.
 */
const hasLogisticsData = (c: Client): boolean => {
  return !!(
    safeText(c.guia_direccion) || 
    safeText(c.guia_ciudad) || 
    safeText(c.guia_numero_ida) || 
    safeText(c.guia_nombre_completo) ||
    safeText(c.guia_cedula_id) ||
    safeText(c.guia_numero_retorno)
  );
};

// Constantes
const ETAPA_GESTIONADO = 'ENVIO_GESTIONADO';
const CAT_PENDIENTE = 'SOLICITUD_AYUDA';
const CAT_GESTIONADA = 'SOLICITUD_AYUDA_GESTIONADA';

type SortOption = 'priority' | 'created_desc' | 'created_asc' | 'last_msg_desc';
type TabOption = 'PENDIENTES' | 'GESTIONADOS' | 'TODOS';

/** ================== Componente Principal ================== */
export const EnviosPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [sedeFilter, setSedeFilter] = useState<string>('Todas');
  const [currentTab, setCurrentTab] = useState<TabOption>('PENDIENTES'); 
  const [sortOption, setSortOption] = useState<SortOption>('last_msg_desc');

  // Estado UI
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [savingRow, setSavingRow] = useState<number | null>(null);
  const [webhookLoading, setWebhookLoading] = useState<string | null>(null);

  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ClientService.getClients();
      const arr = Array.isArray(data) ? (data as Client[]) : [];
      // Filtramos usando la lógica permisiva
      setClients(arr.filter(hasLogisticsData));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar envíos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  // Escuchar actualizaciones externas
  useEffect(() => {
    const onExternalUpdate = (ev: Event) => {
      const detail = (ev as CustomEvent<Partial<Client>>).detail;
      if (!detail?.row_number) return;
      setClients(prev => {
        const updated = prev.map(c => c.row_number === detail.row_number ? ({ ...c, ...detail } as Client) : c);
        // Volvemos a filtrar para asegurar que siga cumpliendo condiciones
        return updated.filter(hasLogisticsData);
      });
      setViewClient(v => (v?.row_number === detail.row_number ? ({ ...v, ...detail } as Client) : v));
    };
    window.addEventListener('client:updated', onExternalUpdate as any);
    return () => window.removeEventListener('client:updated', onExternalUpdate as any);
  }, []);

  const onUpdate = async (payload: Partial<Client>): Promise<boolean> => {
    if (!payload.row_number) return false;
    setSavingRow(payload.row_number);
    try {
      if (typeof (ClientService as any).updateClient === 'function') {
        await (ClientService as any).updateClient(payload);
      } else {
        await fetch('/api/clients/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      setClients(prev => prev.map(c => c.row_number === payload.row_number ? ({ ...c, ...payload } as Client) : c));
      return true;
    } catch (e) {
      alert("Error al guardar");
      return false;
    } finally {
      setSavingRow(null);
    }
  };

  /** Generar Guía Recogida */
  const handleGenerarGuia = async (client: Client) => {
    const url = 'https://n8n.alliasoft.com/webhook/wiltech/guia-recogida';
    setWebhookLoading(client.whatsapp);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           whatsapp: safeText(client.whatsapp),
           guia_nombre_completo: safeText(client.guia_nombre_completo),
           guia_cedula_id: safeText(client.guia_cedula_id),
           guia_telefono: safeText(client.guia_telefono),
           guia_direccion: safeText(client.guia_direccion),
           guia_ciudad: safeText(client.guia_ciudad),
           guia_departamento_estado: safeText(client.guia_departamento_estado),
           guia_email: safeText(client.guia_email)
        })
      });
      
      if (response.ok) {
        const resData = await response.json();
        const updated = Array.isArray(resData) ? resData[0] : resData;
        if (updated && updated.row_number) {
          setClients(prev => prev.map(c => c.row_number === updated.row_number ? { ...c, ...updated } : c));
          alert(`¡Guía generada exitosamente!`);
        }
      } else {
        throw new Error("Error servidor");
      }
    } catch (err) {
      alert("Error al generar la guía.");
    } finally {
      setWebhookLoading(null);
    }
  };

  /** 
   * TOGGLE GESTIONADO + SINCRONIZACIÓN CON ASISTENCIA
   */
  const toggleGestionado = async (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    const isGestionado = client.estado_etapa === ETAPA_GESTIONADO;
    
    if (isGestionado) {
       // REABRIR (DEVOLVER A PENDIENTE)
       if(!window.confirm("¿Deseas devolver este envío a PENDIENTE?")) return;
       
       await onUpdate({
         row_number: client.row_number,
         estado_etapa: 'EN_REVISION' // Estado por defecto al reabrir
       });

    } else {
       // MARCAR COMO GESTIONADO
       const payload: Partial<Client> = {
         row_number: client.row_number,
         estado_etapa: ETAPA_GESTIONADO
       };

       // LÓGICA SOLICITADA: Sincronizar categoría de ayuda
       if (normalize(String(client.categoria_contacto)) === normalize(CAT_PENDIENTE)) {
          payload.categoria_contacto = CAT_GESTIONADA;
       }

       await onUpdate(payload);
    }
  };

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
      data = data.filter(c => c.estado_etapa !== ETAPA_GESTIONADO);
    } else if (currentTab === 'GESTIONADOS') {
      data = data.filter(c => c.estado_etapa === ETAPA_GESTIONADO);
    }

    // 2. Filtro Sede
    if (sedeFilter !== 'Todas') {
      const normSedeFilter = normalize(sedeFilter);
      data = data.filter(c => normalize(safeText(c.agenda_ciudad_sede)) === normSedeFilter);
    }

    // 3. Búsqueda Segura
    if (search.trim()) {
      const q = normalize(search);
      data = data.filter(c => 
        normalize(c.nombre).includes(q) ||
        normalize(c.guia_nombre_completo).includes(q) ||
        normalize(c.guia_numero_ida).includes(q) ||
        normalize(c.whatsapp).includes(q) ||
        safeText(c.guia_cedula_id).includes(q)
      );
    }

    return data.sort((a,b) => {
      const getTs = (v: any) => (!v ? 0 : (typeof v === 'number' && v < 10000000000 ? v * 1000 : new Date(v).getTime()));
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
  }, [clients, sedeFilter, currentTab, search, sortOption]);

  const handleToggleBot = async (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentlyOn = isBotOn(client.consentimiento_contacto);
    await onUpdate({ row_number: client.row_number, consentimiento_contacto: !currentlyOn });
  };

  const handleWhatsAppClick = (whatsapp: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Usamos formatWhatsApp importado que ya debe estar corregido en clientHelpers
    // Agregamos fallback por seguridad
    const safeNum = whatsapp ? String(whatsapp).replace('@s.whatsapp.net', '') : '';
    if(safeNum) window.open(`https://wa.me/${safeNum}`, '_blank');
  };

  const StatusIcon = ({ uiKey }: { uiKey: EnvioUIKey }) => {
    switch(uiKey) {
      case 'faltan_datos': return <AlertTriangle className="w-4 h-4" />;
      case 'datos_completos': return <CheckCircle2 className="w-4 h-4" />;
      default: return <Truck className="w-4 h-4" />;
    }
  };

  return (
    <div className="page-container relative flex flex-col space-y-8 min-h-[calc(100vh-100px)] overflow-hidden">
      
      {/* Background Decorations */}
      <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-slate-800/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] bg-slate-600/5 blur-[100px] rounded-full pointer-events-none" />

      {/* === Header Dashboard === */}
      <div className="relative z-10 flex flex-col gap-8 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="absolute inset-0 bg-slate-700 blur-xl opacity-20 animate-pulse" />
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-slate-800 to-purple-700 text-white flex items-center justify-center shadow-xl shadow-slate-900/20 relative z-10 border border-white/20">
                <Truck className="w-7 h-7" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 leading-none tracking-tight">Logística de Envíos</h1>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex -space-x-1">
                   <div className="w-2 h-2 rounded-full bg-slate-800 border-2 border-white" />
                   <div className="w-2 h-2 rounded-full bg-indigo-300 border-2 border-white animate-ping" />
                </div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.15em]">Gestión de Guías y Recogidas</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="flex bg-white/50 backdrop-blur-xl p-1.5 rounded-[22px] border border-white/60 shadow-xl shadow-slate-100 hover:shadow-slate-900/20/20 transition-all duration-500">
                <button 
                  onClick={() => setCurrentTab('PENDIENTES')}
                  className={`px-6 py-2.5 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2
                    ${currentTab === 'PENDIENTES' 
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
                      : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}
                  `}
                >
                  <Clock size={12} /> Pendientes
                </button>
                <button 
                  onClick={() => setCurrentTab('GESTIONADOS')}
                  className={`px-6 py-2.5 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2
                    ${currentTab === 'GESTIONADOS' 
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
                      : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}
                  `}
                >
                  <CheckCircle2 size={12} /> Gestionados
                </button>
                <button 
                  onClick={() => setCurrentTab('TODOS')}
                  className={`px-6 py-2.5 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all duration-300
                    ${currentTab === 'TODOS' 
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
                      : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}
                  `}
                >
                  Todos
                </button>
             </div>

             <button 
               onClick={fetchClients}
               className="p-3.5 bg-white shadow-lg border border-white rounded-[20px] text-slate-700 hover:text-slate-800 hover:scale-110 active:scale-95 transition-all duration-300 group"
             >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
             </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="bg-white/40 backdrop-blur-md border border-white/40 rounded-[28px] p-2.5 flex flex-col md:flex-row gap-3 shadow-xl shadow-slate-200/20">
          <div className="relative group flex-1">
             <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-700 transition-colors">
                <Search size={16} />
             </div>
             <input 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, guía, whatsapp o cédula..."
                className="w-full pl-12 pr-6 py-3.5 bg-white/60 border border-white/50 rounded-[22px] text-xs font-bold text-slate-700 placeholder-slate-400 outline-none focus:ring-4 focus:ring-slate-700/5 focus:bg-white transition-all"
             />
          </div>

          <div className="flex flex-wrap gap-2.5">
             <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-colors">
                  <MapPin size={14} />
                </div>
                <select 
                   value={sedeFilter} 
                   onChange={(e) => setSedeFilter(e.target.value)} 
                   className="appearance-none pl-9 pr-10 py-3.5 bg-white/60 border border-white/50 rounded-[22px] text-[11px] font-black uppercase tracking-widest text-slate-600 outline-none focus:ring-4 focus:ring-slate-700/5 focus:bg-white cursor-pointer transition-all min-w-[160px]"
                >
                  <option value="Todas">Todas las Sedes</option>
                  {sedesList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
             </div>

             <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-slate-700 transition-colors">
                  <ArrowUpDown size={14} />
                </div>
                <select 
                   value={sortOption} 
                   onChange={(e) => setSortOption(e.target.value as SortOption)} 
                   className="appearance-none pl-9 pr-10 py-3.5 bg-white/60 border border-white/50 rounded-[22px] text-[11px] font-black uppercase tracking-widest text-slate-600 outline-none focus:ring-4 focus:ring-slate-700/5 focus:bg-white cursor-pointer transition-all"
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

      {/* === Logistics List === */}
      <div className="w-full max-w-7xl mx-auto space-y-4 pb-20 relative z-10">
         {loading && clients.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-50">
              <RefreshCw className="w-10 h-10 animate-spin text-slate-700" />
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Sincronizando Logística...</p>
           </div>
         ) : filtered.length > 0 ? (
           <div className="grid grid-cols-1 gap-5">
             {filtered.map((client) => {
               const ui = deriveEnvioUI(client);
               const { isComplete, missingFields } = checkGuiaDataComplete(client);
               const botActive = isBotOn(client.consentimiento_contacto);
               const isGestionado = client.estado_etapa === ETAPA_GESTIONADO;
               const isSaving = savingRow === client.row_number;
               const canGenerateIda = isComplete && !safeText(client.guia_numero_ida);
               
               return (
                 <div 
                   key={client.row_number}
                   onClick={() => setViewClient(client)}
                   className={`group relative bg-white/70 backdrop-blur-xl border border-white/40 shadow-xl rounded-[28px] overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 active:scale-[0.995] cursor-pointer animate-in fade-in slide-in-from-bottom-4 duration-500`}
                 >
                   {/* Status Strip */}
                   <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-500 ${isGestionado ? 'bg-emerald-500' : 'bg-slate-800'} ${!isGestionado && !isComplete ? 'bg-amber-400' : ''}`} />

                   <div className="flex flex-col lg:flex-row items-stretch">
                     
                     {/* LEFT: Origin-Destination Path */}
                     <div className="flex flex-row lg:flex-col items-center justify-between lg:justify-center gap-4 p-5 lg:w-[180px] lg:bg-slate-50/40 lg:border-r border-white/20">
                        <div className="flex flex-col items-center gap-2">
                           <div className="w-9 h-9 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-700">
                             <MapPin size={16} />
                           </div>
                           <span className="text-[9px] font-black uppercase tracking-tight text-slate-500 text-center truncate max-w-[120px]">
                              {safeText(client.agenda_ciudad_sede) || 'Origen?'}
                           </span>
                        </div>
                        
                        <div className="h-[20px] w-[2px] bg-gradient-to-b from-indigo-200 to-purple-200 hidden lg:block relative">
                           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white border border-indigo-400" />
                        </div>
                        <ArrowRight size={14} className="text-slate-300 lg:hidden" />

                        <div className="flex flex-col items-center gap-2">
                           <div className={`w-9 h-9 rounded-xl bg-white shadow-sm border flex items-center justify-center ${safeText(client.guia_ciudad) ? 'text-slate-800 border-slate-200' : 'text-rose-400 border-rose-100'}`}>
                             <MapPin size={16} />
                           </div>
                           <span className={`text-[9px] font-black uppercase tracking-tight text-center truncate max-w-[120px] ${safeText(client.guia_ciudad) ? 'text-slate-700' : 'text-rose-500 italic'}`}>
                              {safeText(client.guia_ciudad) || 'Destino?'}
                           </span>
                        </div>
                     </div>

                     {/* CENTER: Main info & Shipment Numbers */}
                     <div className="flex-1 p-6 flex flex-col justify-center min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-4">
                           <div className="min-w-0 flex-1">
                               <div className="flex items-center gap-3 mb-1 flex-wrap">
                                  <h3 className="text-lg font-black text-slate-900 leading-tight tracking-tight group-hover:text-slate-800 transition-colors truncate">
                                     {safeText(client.guia_nombre_completo) || safeText(client.nombre) || 'Sin nombre'}
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
                                  <div className="flex items-center gap-1.5 text-slate-400 font-bold group/val" onClick={(e) => handleWhatsAppClick(client.whatsapp as any, e)}>
                                     <Phone className="w-3 h-3 text-emerald-400 group-hover/val:scale-110 transition-transform" />
                                     <span className="font-mono tracking-tight group-hover/val:text-emerald-600 transition-colors uppercase leading-none">{formatWhatsApp(client.whatsapp as any)}</span>
                                  </div>
                                  <div className="h-3 w-[1px] bg-slate-200" />
                                  <div className="flex items-center gap-1.5 text-slate-400 font-bold">
                                     <User className="w-3 h-3 text-slate-300" />
                                     <span className="font-mono text-[9px]">ID: {safeText(client.guia_cedula_id) || '---'}</span>
                                  </div>
                               </div>
                           </div>

                           <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border flex items-center gap-1.5 whitespace-nowrap ${ui.classes}`}>
                              <StatusIcon uiKey={ui.key} />
                              {ENVIO_LABELS[ui.key]}
                           </div>
                        </div>

                        {/* Shipping Numbers Boxes */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className={`p-4 rounded-2xl border transition-all relative group/box
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
                                    <p className="font-mono text-sm font-black text-indigo-900 tracking-wider">
                                       {safeText(client.guia_numero_ida) || 'POR ASIGNAR'}
                                    </p>
                                 </div>
                                 {safeText(client.guia_numero_ida) && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                              </div>
                           </div>

                           <div className={`p-4 rounded-2xl border transition-all relative group/box
                              ${safeText(client.guia_numero_retorno) 
                                ? 'bg-slate-50/30 border-purple-100/50' 
                                : 'bg-slate-50/50 border-slate-200/50 opacity-60'}
                           `}>
                              <span className="absolute -top-2 left-4 px-1.5 py-0.5 bg-white text-slate-600 text-[8px] font-black uppercase tracking-widest rounded-lg border border-purple-100 shadow-sm">
                                 Guía de Retorno
                              </span>
                              <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-3">
                                    <Package className="w-4 h-4 text-purple-300" />
                                    <p className="font-mono text-sm font-black text-purple-900 tracking-wider">
                                       {safeText(client.guia_numero_retorno) || 'SIN REGISTRO'}
                                    </p>
                                 </div>
                                 {safeText(client.guia_numero_retorno) && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* RIGHT: Meta info & Actions */}
                     <div className={`w-full lg:w-[280px] p-6 lg:border-l border-white/20 flex flex-col justify-between gap-6 ${isGestionado ? 'bg-emerald-50/10' : 'bg-slate-50/10'}`}>
                        <div className="space-y-3">
                           <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2.5 px-3 py-1.5 bg-white/60 backdrop-blur-sm rounded-xl border border-white/50 text-slate-600">
                                 <Clock size={12} className="text-indigo-400" />
                                 <div className="flex flex-col overflow-hidden">
                                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-0.5">Última Actividad</span>
                                    <span className="text-[9px] font-black uppercase tracking-wider truncate">{formatTimeDate(client.last_msg || client.created)}</span>
                                 </div>
                              </div>
                              
                              <div className="flex items-center gap-2.5 px-3 py-1.5 bg-white/60 backdrop-blur-sm rounded-xl border border-white/50 text-slate-600">
                                 <Truck size={12} className="text-indigo-400" />
                                 <span className="text-[9px] font-black uppercase tracking-wider truncate">
                                    {safeText(client.guia_departamento_estado) || 'Sin Dpto'}
                                 </span>
                              </div>
                           </div>
                        </div>

                        <div className="flex flex-col gap-2">
                           {canGenerateIda ? (
                             <button
                               onClick={(e) => { e.stopPropagation(); handleGenerarGuia(client); }}
                               disabled={!!webhookLoading}
                               className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white rounded-[18px] text-[10px] font-black uppercase tracking-[0.12em] transition-all hover:bg-slate-800 hover:-translate-y-0.5 border border-indigo-500 shadow-lg shadow-slate-900/20 active:scale-95 disabled:opacity-50"
                             >
                               {webhookLoading === client.whatsapp ? <RefreshCw className="w-4 h-4 animate-spin text-white/50" /> : <Send className="w-4 h-4" />}
                               GENERAR GUÍA RECOGIDA
                             </button>
                           ) : !safeText(client.guia_numero_ida) && !isGestionado ? (
                             <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-100 flex flex-col gap-1.5 shadow-sm">
                               <div className="flex items-center gap-2 text-amber-600">
                                  <AlertCircle size={14} />
                                  <span className="text-[9px] font-black uppercase tracking-widest">Datos Faltantes</span>
                               </div>
                               <p className="text-[9px] text-amber-700 font-semibold leading-tight px-1 uppercase tracking-tight opacity-70">
                                 {missingFields.join(', ').replace(/guia_/g, '').replace(/_/g, ' ')}
                               </p>
                             </div>
                           ) : null}

                           <button
                              onClick={(e) => toggleGestionado(client, e)}
                              disabled={isSaving}
                              className={`flex items-center justify-center gap-2 w-full py-3 rounded-[18px] text-[10px] font-black uppercase tracking-[0.12em] transition-all border shadow-md active:scale-95
                                 ${isGestionado 
                                   ? 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-800' 
                                   : 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-200/40 hover:bg-emerald-700 hover:-translate-y-0.5'}
                              `}
                           >
                              {isGestionado ? <RefreshCw className="w-3.5 h-3.5" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                              {isGestionado ? 'Reabrir Envío' : 'Marcar Gestionado'}
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
                                 <Phone size={12} /> Chat
                              </button>
                           </div>
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
                 <Truck className={`w-10 h-10 ${currentTab === 'PENDIENTES' ? 'text-indigo-400' : 'text-slate-300'} relative z-10`} />
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

      <ClientModal
        isOpen={!!viewClient}
        onClose={() => setViewClient(null)}
        client={viewClient}
        onUpdate={onUpdate}
      />
    </div>
  );
};