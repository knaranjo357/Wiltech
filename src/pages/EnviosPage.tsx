// src/pages/EnviosPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { 
  Truck, RefreshCw, Phone, MapPin, Search, ArrowRight, 
  Package, ShieldCheck, AlertTriangle, CheckCircle2, X
} from 'lucide-react';
import { Client } from '../types/client';
import { ClientService } from '../services/clientService';
import { formatWhatsApp, deriveEnvioUI, ENVIO_LABELS } from '../utils/clientHelpers';
import type { EnvioUIKey } from '../utils/clientHelpers';
import { ClientModal } from '../components/ClientModal';

/** ================== Helpers ================== */
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();

const isInvalidNoAplica = (v: unknown) => {
  const c = String(v || '').toLowerCase().trim();
  return !c || c === 'no aplica' || c === 'no' || c === 'null' || c === 'undefined';
};

const safeText = (v: unknown) => {
  if (isInvalidNoAplica(v)) return '';
  return String(v).trim();
};

/**
 * FILTRO ESTRICTO:
 * Para estar en "Envíos", el cliente DEBE tener una intención logística:
 * 1. Sede definida (Origen)
 * 2. Ciudad de destino definida
 * 3. Dirección definida
 */
const hasLogisticsData = (c: Client): boolean => {
  return !!(safeText(c.agenda_ciudad_sede) && safeText(c.guia_ciudad) && safeText(c.guia_direccion));
};

/** ================== Componente Principal ================== */
export const EnviosPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [sedeFilter, setSedeFilter] = useState<string>('Todas');
  const [statusFilter, setStatusFilter] = useState<EnvioUIKey | 'Todas'>('Todas');

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
      // Filtramos SOLO los que tienen datos logísticos mínimos
      setClients(arr.filter(hasLogisticsData));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar envíos');
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
        // Actualizamos o removemos si ya no cumple los requisitos logísticos
        const updated = prev.map(c => c.row_number === detail.row_number ? ({ ...c, ...detail } as Client) : c);
        return updated.filter(hasLogisticsData); 
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

  /** --- Filtrado --- */
  const filtered = useMemo(() => {
    let data = [...clients];

    // 1. Sede
    if (sedeFilter !== 'Todas') {
      data = data.filter(c => safeText(c.agenda_ciudad_sede) === sedeFilter);
    }

    // 2. Estado Envío
    if (statusFilter !== 'Todas') {
      data = data.filter(c => deriveEnvioUI(c).key === statusFilter);
    }

    // 3. Búsqueda Global
    if (search.trim()) {
      const q = normalize(search);
      data = data.filter(c => 
        normalize(safeText(c.nombre)).includes(q) ||
        normalize(safeText(c.guia_numero_ida)).includes(q) ||
        normalize(safeText(c.guia_numero_retorno)).includes(q) ||
        normalize(safeText(c.guia_direccion)).includes(q) ||
        normalize(safeText(c.guia_ciudad)).includes(q) ||
        normalize(safeText(c.modelo)).includes(q)
      );
    }

    // Ordenar: Primero los incompletos, luego pendientes de envío, luego en tránsito
    const score = (c: Client) => {
        const key = deriveEnvioUI(c).key;
        if (key === 'faltan_datos') return 0;
        if (key === 'datos_completos') return 1;
        if (key === 'ida') return 2;
        return 3;
    };
    return data.sort((a,b) => score(a) - score(b));

  }, [clients, sedeFilter, statusFilter, search]);


  /** --- Helpers Visuales --- */
  const handleWhatsAppClick = (whatsapp: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://wa.me/${safeText(whatsapp).replace('@s.whatsapp.net', '')}`, '_blank');
  };

  // Icono de estado
  const StatusIcon = ({ statusKey }: { statusKey: EnvioUIKey }) => {
    switch(statusKey) {
      case 'faltan_datos': return <AlertTriangle className="w-4 h-4" />;
      case 'datos_completos': return <CheckCircle2 className="w-4 h-4" />;
      case 'ida':
      case 'retorno':
      case 'ida_y_retorno': return <Truck className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-6 space-y-6 w-full">
      
      {/* === Header & Filtros === */}
      <div className="sticky top-2 z-30 w-full">
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-sm border border-gray-200/80 p-3 md:p-4">
           <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 justify-between">
              
              {/* Título e Icono */}
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 shadow-sm">
                    <Truck className="w-5 h-5" />
                 </div>
                 <div>
                    <h1 className="text-lg font-bold text-gray-900 leading-none">Logística</h1>
                    <p className="text-xs text-gray-500 mt-1">{filtered.length} envíos activos</p>
                 </div>
              </div>

              {/* Barra Filtros */}
              <div className="flex flex-col sm:flex-row gap-2 flex-1 md:justify-end">
                 
                 {/* Selector Sede */}
                 <select 
                   value={sedeFilter} 
                   onChange={(e) => setSedeFilter(e.target.value)}
                   className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-purple-100 outline-none cursor-pointer"
                 >
                    <option value="Todas">Todas las Sedes</option>
                    {sedesList.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>

                 {/* Selector Estado */}
                 <select 
                   value={statusFilter} 
                   onChange={(e) => setStatusFilter(e.target.value as any)}
                   className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-purple-100 outline-none cursor-pointer"
                 >
                    <option value="Todas">Todos los Estados</option>
                    <option value="faltan_datos">⚠️ Faltan Datos</option>
                    <option value="datos_completos">✅ Listos para enviar</option>
                    <option value="ida">🚚 En tránsito (Ida)</option>
                    <option value="ida_y_retorno">🔄 Ida y Retorno</option>
                 </select>

                 {/* Buscador */}
                 <div className="relative w-full sm:w-64">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                   </div>
                   <input
                     value={search}
                     onChange={(e) => setSearch(e.target.value)}
                     placeholder="Buscar guía, ciudad, cliente..."
                     className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm focus:bg-white bg-gray-50/50 focus:ring-2 focus:ring-purple-100 transition-all"
                   />
                   {search && (
                      <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X className="w-3 h-3" />
                      </button>
                   )}
                 </div>

                 <button onClick={fetchClients} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500">
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                 </button>
              </div>
           </div>
        </div>
      </div>

      {/* === Content List (Cards Split View) === */}
      <div className="w-full space-y-4 pb-10">
         {loading ? (
           <div className="space-y-4 animate-pulse max-w-6xl mx-auto">
             {[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-2xl h-40 border border-gray-100"/>)}
           </div>
         ) : filtered.length > 0 ? (
           filtered.map((client) => {
             const ui = deriveEnvioUI(client);
             const isWarning = ui.key === 'faltan_datos';
             
             return (
               <div 
                 key={client.row_number}
                 onClick={() => setViewClient(client)}
                 className={`group w-full bg-white rounded-2xl border transition-all duration-200 hover:shadow-lg overflow-hidden cursor-pointer relative
                   ${isWarning ? 'border-orange-200 hover:border-orange-300' : 'border-gray-200 hover:border-purple-300'}
                 `}
               >
                 <div className="flex flex-col lg:flex-row items-stretch h-full">
                    
                    {/* === IZQUIERDA: RUTA & DIRECCIÓN (70%) === */}
                    <div className="flex-1 p-5 flex flex-col justify-between gap-4">
                       
                       {/* Route Header */}
                       <div className="flex flex-wrap items-center gap-3 text-sm">
                          <div className="flex items-center gap-2 font-bold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-lg">
                             <MapPin className="w-4 h-4 text-gray-500" />
                             {safeText(client.agenda_ciudad_sede) || 'Sede Origen'}
                          </div>
                          <ArrowRight className="w-4 h-4 text-gray-300" />
                          <div className="flex items-center gap-2 font-bold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-lg">
                             <MapPin className="w-4 h-4 text-gray-500" />
                             {safeText(client.guia_ciudad) || 'Ciudad Destino'}
                          </div>
                          
                          {safeText(client.guia_departamento_estado) && (
                             <span className="text-xs text-gray-400">({client.guia_departamento_estado})</span>
                          )}
                       </div>

                       {/* Main Address */}
                       <div className="pl-1">
                          <h3 className="text-lg sm:text-xl font-bold text-gray-800 leading-tight">
                             {safeText(client.guia_direccion)}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1 font-medium">
                             {safeText(client.guia_nombre_completo) || safeText(client.nombre)} • {safeText(client.guia_telefono) || formatWhatsApp(client.whatsapp)}
                          </p>
                       </div>

                       {/* Tracking Numbers Grid */}
                       <div className="flex flex-wrap gap-4 mt-2">
                          {/* IDA */}
                          <div className={`flex items-center gap-3 px-3 py-2 rounded-xl border border-dashed ${client.guia_numero_ida ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200 opacity-70'}`}>
                             <div className="text-xs uppercase text-gray-500 font-bold">Guía Ida</div>
                             <div className={`text-sm font-mono font-bold ${client.guia_numero_ida ? 'text-blue-700' : 'text-gray-400'}`}>
                                {safeText(client.guia_numero_ida) || 'Pendiente'}
                             </div>
                          </div>

                          {/* RETORNO */}
                          <div className={`flex items-center gap-3 px-3 py-2 rounded-xl border border-dashed ${client.guia_numero_retorno ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200 opacity-70'}`}>
                             <div className="text-xs uppercase text-gray-500 font-bold">Guía Retorno</div>
                             <div className={`text-sm font-mono font-bold ${client.guia_numero_retorno ? 'text-purple-700' : 'text-gray-400'}`}>
                                {safeText(client.guia_numero_retorno) || 'Pendiente'}
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* === DERECHA: ESTADO & ACCIONES (30%) === */}
                    <div className={`w-full lg:w-[30%] border-t lg:border-t-0 lg:border-l border-gray-100 p-5 flex flex-col justify-between gap-4
                       ${isWarning ? 'bg-orange-50/30' : 'bg-gray-50/50'}
                    `}>
                       
                       {/* Status Badge */}
                       <div className="flex justify-end">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border uppercase tracking-wide ${ui.classes}`}>
                             <StatusIcon statusKey={ui.key} />
                             {ENVIO_LABELS[ui.key]}
                          </span>
                       </div>

                       {/* Insurance Info */}
                       <div className="flex flex-col items-end text-right space-y-1">
                          {client.asegurado ? (
                             <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Asegurado: {safeText(client.valor_seguro) || 'Si'}
                             </div>
                          ) : (
                             <div className="text-xs text-gray-400 font-medium">No asegurado</div>
                          )}
                          
                          {/* Diagnostic Price or Notes */}
                          {client.precio_diagnostico_informado && (
                             <span className="text-xs text-gray-500">
                               Diag: {client.precio_diagnostico_informado}
                             </span>
                          )}
                       </div>

                       {/* Actions Footer */}
                       <div className="mt-auto pt-3 border-t border-gray-200/50 flex justify-end gap-2">
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
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 shadow-inner">
                 <Truck className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">No hay envíos logísticos</h3>
              <p className="text-gray-500 max-w-md mt-2 px-4">
                {search 
                  ? `No se encontraron resultados para "${search}".`
                  : `No hay clientes configurados con Sede, Ciudad y Dirección válidos.`}
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