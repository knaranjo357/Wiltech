// src/pages/EnviosPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { 
  Truck, RefreshCw, Phone, MapPin, Search, ArrowRight, 
  Package, ShieldCheck, AlertTriangle, CheckCircle2, X,
  ArrowUpDown, Clock, MessageCircle, Bot, AlertCircle,
  Send, ClipboardCheck, User
} from 'lucide-react';
import { Client } from '../types/client';
import { ClientService } from '../services/clientService';
import { formatWhatsApp, deriveEnvioUI, ENVIO_LABELS } from '../utils/clientHelpers';
import type { EnvioUIKey } from '../utils/clientHelpers';
import { ClientModal } from '../components/ClientModal';

/** ================== Helpers de Seguridad (Blindaje Anti-Crash) ================== */

// Transforma null/undefined en string vacío seguro y trimmeado
const safeText = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  // Detecta strings que dicen "null", "undefined", "no aplica" explícitamente
  const lower = s.toLowerCase();
  if (lower === 'null' || lower === 'undefined' || lower === 'no aplica' || lower === 'no') return '';
  return s;
};

// Normaliza para búsquedas (quita tildes y mayúsculas)
const normalize = (s: string) => safeText(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

// Formateo seguro de fechas
const formatTimeDate = (val: string | number | undefined) => {
  if (!val) return '—';
  const date = new Date(typeof val === 'number' && val < 10000000000 ? val * 1000 : val);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' });
};

// Lógica segura para el Bot
const isBotOn = (v: any) => {
  if (v === false) return false;
  if (String(v).toLowerCase() === 'false') return false;
  return true; 
};

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
    const s = new Set<string>();
    clients.forEach(c => { if(safeText(c.agenda_ciudad_sede)) s.add(safeText(c.agenda_ciudad_sede)); });
    return Array.from(s).sort();
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
      data = data.filter(c => safeText(c.agenda_ciudad_sede) === sedeFilter);
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
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-6 space-y-6 w-full font-sans">
      
      {/* Header */}
      <div className="sticky top-2 z-30 w-full">
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-sm border border-gray-200 p-4">
           <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-lg">
                    <Truck className="w-5 h-5" />
                 </div>
                 <div>
                    <h1 className="text-lg font-bold text-gray-900">Logística de Envíos</h1>
                    <p className="text-xs text-gray-500">{filtered.length} envíos visibles</p>
                 </div>
              </div>
              
              <div className="flex flex-col xl:flex-row gap-2 flex-1 md:justify-end">
                 
                 {/* TABS */}
                 <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1">
                    <button onClick={() => setCurrentTab('PENDIENTES')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${currentTab === 'PENDIENTES' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Pendientes</button>
                    <button onClick={() => setCurrentTab('GESTIONADOS')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${currentTab === 'GESTIONADOS' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Gestionados</button>
                    <button onClick={() => setCurrentTab('TODOS')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${currentTab === 'TODOS' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Todos</button>
                 </div>

                 <select value={sedeFilter} onChange={(e) => setSedeFilter(e.target.value)} className="px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none">
                    <option value="Todas">Todas las Sedes</option>
                    {sedesList.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>

                 <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><ArrowUpDown className="h-4 w-4 text-gray-400" /></div>
                    <select value={sortOption} onChange={(e) => setSortOption(e.target.value as SortOption)} className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm focus:bg-white bg-gray-50/50 outline-none">
                       <option value="priority">Prioridad (Datos)</option>
                       <option value="last_msg_desc">Última Actividad</option>
                       <option value="created_desc">Recientes</option>
                    </select>
                 </div>

                 <div className="relative w-48">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-4 w-4 text-gray-400" /></div>
                   <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="w-full pl-9 pr-8 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-purple-500" />
                 </div>

                 <button onClick={fetchClients} className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                 </button>
              </div>
           </div>
        </div>
      </div>

      {/* Lista */}
      <div className="max-w-7xl mx-auto space-y-4">
        {loading ? (
            <div className="space-y-4 animate-pulse">
               {[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-2xl h-40 border border-gray-100"/>)}
            </div>
        ) : filtered.length > 0 ? (
          filtered.map(client => {
            const ui = deriveEnvioUI(client);
            const { isComplete, missingFields } = checkGuiaDataComplete(client);
            const botActive = isBotOn(client.consentimiento_contacto);
            const isGestionado = client.estado_etapa === ETAPA_GESTIONADO;
            
            const canGenerateIda = isComplete && !safeText(client.guia_numero_ida);

            return (
              <div 
                key={client.row_number}
                onClick={() => setViewClient(client)}
                className={`bg-white rounded-2xl border transition-all cursor-pointer relative hover:shadow-lg
                  ${isGestionado ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200'}
                `}
              >
                <div className="flex flex-col lg:flex-row">
                  {/* Info Principal */}
                  <div className="flex-1 p-5 space-y-4">
                    <div className="flex items-center gap-3 text-sm">
                       <div className="flex items-center gap-2 font-bold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg">
                          <MapPin className="w-3.5 h-3.5" /> 
                          {safeText(client.agenda_ciudad_sede) || <span className="text-gray-400 italic">Sede Origen?</span>}
                       </div>
                       <ArrowRight className="w-4 h-4 text-gray-300" />
                       <div className="flex items-center gap-2 font-bold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg">
                          <MapPin className="w-3.5 h-3.5" /> 
                          {safeText(client.guia_ciudad) || <span className="text-red-400 italic">Destino?</span>}
                       </div>
                       
                       <div className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border ${isGestionado ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-purple-50 text-purple-700 border-purple-100'}`}>
                          {isGestionado ? 'Gestionado' : 'Pendiente'}
                       </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-gray-800">
                        {safeText(client.guia_nombre_completo) || safeText(client.nombre) || 'Sin nombre de guía'}
                      </h3>
                      <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                        <User className="w-3.5 h-3.5" /> 
                        CC/NIT: {safeText(client.guia_cedula_id) || '---'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {safeText(client.guia_direccion) || <span className="text-red-400 italic">Sin dirección</span>}
                      </p>
                    </div>

                    <div className="flex gap-4">
                      <div className={`px-3 py-2 rounded-lg border border-dashed ${safeText(client.guia_numero_ida) ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Guía Ida</p>
                        <p className="text-sm font-mono font-bold text-blue-700">{safeText(client.guia_numero_ida) || '---'}</p>
                      </div>
                      <div className={`px-3 py-2 rounded-lg border border-dashed ${safeText(client.guia_numero_retorno) ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Guía Retorno</p>
                        <p className="text-sm font-mono font-bold text-purple-700">{safeText(client.guia_numero_retorno) || '---'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Acciones Logísticas */}
                  <div className={`w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-100 p-5 flex flex-col justify-between gap-4 
                     ${isGestionado ? 'bg-emerald-50/20' : 'bg-gray-50/50'}
                  `}>
                    
                    {/* Tag de Estado (Datos) */}
                    <div className="flex justify-end">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold border flex items-center gap-1 ${ui.classes}`}>
                        <StatusIcon uiKey={ui.key} />
                        {ENVIO_LABELS[ui.key]}
                      </span>
                    </div>

                    {/* Bloque de Generación de Guías */}
                    <div className="space-y-2">
                      {canGenerateIda ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleGenerarGuia(client); }}
                          disabled={!!webhookLoading}
                          className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-transform active:scale-95 disabled:opacity-50"
                        >
                          {webhookLoading === client.whatsapp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          GENERAR GUÍA RECOGIDA
                        </button>
                      ) : !safeText(client.guia_numero_ida) ? (
                        <div className="p-3 bg-orange-50 border border-orange-100 rounded-xl">
                          <p className="text-[10px] font-bold text-orange-700 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> FALTAN DATOS OBLIGATORIOS:
                          </p>
                          <p className="text-[9px] text-orange-600 mt-1 leading-tight">
                            {missingFields.join(', ').replace(/guia_/g, '')}
                          </p>
                        </div>
                      ) : null}

                      {/* Botón Marcar Gestionado */}
                      <button
                         onClick={(e) => toggleGestionado(client, e)}
                         className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95
                           ${isGestionado 
                             ? 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50' 
                             : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-sm'}
                         `}
                      >
                         {isGestionado ? <X className="w-4 h-4" /> : <ClipboardCheck className="w-4 h-4" />}
                         {isGestionado ? 'REABRIR (A PENDIENTE)' : 'MARCAR GESTIONADO'}
                      </button>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-gray-200/50">
                      <button 
                        onClick={e => { e.stopPropagation(); handleWhatsAppClick(safeText(client.whatsapp), e); }}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-bold hover:bg-green-100"
                      >
                        <Phone className="w-3.5 h-3.5" /> WhatsApp
                      </button>
                      <button 
                        onClick={e => handleToggleBot(client, e)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${botActive ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-400'}`}
                      >
                        BOT: {botActive ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 text-center max-w-4xl mx-auto">
             <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 shadow-inner">
                <Truck className="w-10 h-10 text-gray-300" />
             </div>
             <h3 className="text-xl font-bold text-gray-900">
               {currentTab === 'PENDIENTES' ? 'No hay envíos pendientes' : 'Sin resultados'}
             </h3>
             <p className="text-gray-500 max-w-md mt-2 px-4 text-center">
               {search ? `No hay resultados para "${search}"` : 'Intenta cambiar los filtros o la pestaña.'}
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