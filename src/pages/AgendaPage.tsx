import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Calendar, RefreshCw, Phone, X, CheckCircle2, MapPin, 
  ChevronRight, Search, CalendarDays, History, ArrowRightCircle,
  Smartphone, MessageSquare, FileText, Globe, AlertCircle, Check, User
} from 'lucide-react';
import { ClientService } from '../services/clientService';
import { Client } from '../types/client';
import { getEtapaColor, formatWhatsApp } from '../utils/clientHelpers';
import { ClientModal } from '../components/ClientModal';

/** ================== Configuración y Utils ================== */
const SOURCE_TO_SEDE: Record<string, string> = {
  Wiltech: 'Bogotá',
  WiltechBga: 'Bucaramanga',
};

// --- PREVENCIÓN DE CRASHES (Null Safety) ---
const safeText = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  return (s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') ? '' : s;
};

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const parseAgendaDate = (raw?: string | null): Date | null => {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return new Date(iso);
  // Intentar parsear formato manual YYYY-MM-DD HH:mm:ss
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const [, y, mo, d, hh, mm, ss] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), ss ? Number(ss) : 0);
  }
  return null;
};

// Comparadores de fecha local
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const today = startOfDay(new Date());

const isTodayLocal = (d: Date | null) => d ? startOfDay(d).getTime() === today.getTime() : false;
const isTomorrowLocal = (d: Date | null) => {
  if (!d) return false;
  const tmrw = new Date(today); tmrw.setDate(tmrw.getDate() + 1);
  return startOfDay(d).getTime() === tmrw.getTime();
};
const isPastLocal = (d: Date | null) => d ? startOfDay(d).getTime() < today.getTime() : false;
const isFutureLocal = (d: Date | null) => {
  if (!d) return false;
  const dayAfterTmrw = new Date(today); dayAfterTmrw.setDate(dayAfterTmrw.getDate() + 2);
  return startOfDay(d).getTime() >= dayAfterTmrw.getTime();
};

const getDisplayTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const getDisplayFullDate = (d: Date) => d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });

const formatMsgTime = (val?: string | number) => {
  if (!val) return '';
  const d = new Date(typeof val === 'number' && val < 10000000000 ? val * 1000 : val);
  if (Number.isNaN(d.getTime())) return '';
  
  const now = new Date();
  const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  
  if (isToday) return `Hoy ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Normalizar texto: quita tildes, minúsculas y espacios extra
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();

type DateFilter = 'today' | 'tomorrow' | 'history' | 'custom' | 'future';

const getClientSede = (c: Client): string => {
  const byAgenda = safeText((c as any).agenda_ciudad_sede);
  if (byAgenda) return byAgenda;
  const src = safeText((c as any).source);
  if (src && SOURCE_TO_SEDE[src]) return SOURCE_TO_SEDE[src];
  return safeText(c.ciudad);
};

/** ================== Modal Selección Sede ================== */
const SedeModal: React.FC<{
  isOpen: boolean;
  options: string[];
  defaultSede?: string;
  onSelect: (sede: string | 'Todas') => void;
}> = ({ isOpen, options, defaultSede, onSelect }) => {
  const [sel, setSel] = useState<string>('Todas');

  useEffect(() => {
    // Verificar si la sede guardada sigue existiendo en las opciones (normalizando para comparar)
    if (defaultSede && defaultSede !== 'Todas') {
      const normDefault = normalize(defaultSede);
      const exists = options.some(opt => normalize(opt) === normDefault);
      setSel(exists ? defaultSede : 'Todas');
    } else {
      setSel('Todas');
    }
  }, [options, defaultSede, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[140] bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden transform transition-all">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5">
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-200"/> Filtrar Sede
          </h3>
          <p className="text-blue-100 text-xs mt-1">Selecciona la ubicación para ver la agenda.</p>
        </div>
        <div className="p-2 max-h-[60vh] overflow-y-auto space-y-1">
          <button
            onClick={() => setSel('Todas')}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between ${sel === 'Todas' ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold' : 'border-transparent hover:bg-gray-50 text-gray-600'}`}
          >
            Todas las sedes {sel === 'Todas' && <Check className="w-4 h-4"/>}
          </button>
          {options.map(s => (
            <button
              key={s}
              onClick={() => setSel(s)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between ${sel === s ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold' : 'border-transparent hover:bg-gray-50 text-gray-600'}`}
            >
              {s} {sel === s && <Check className="w-4 h-4"/>}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button 
            onClick={() => { localStorage.setItem('agenda:selectedSede', sel); onSelect(sel); }} 
            className="px-6 py-2 bg-gray-900 text-white rounded-xl font-medium hover:bg-black transition-colors shadow-lg"
          >
            Ver Agenda
          </button>
        </div>
      </div>
    </div>
  );
};

/** ================== Componente Principal ================== */
export const AgendaPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtros
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customDate, setCustomDate] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); 
  const [selectedSede, setSelectedSede] = useState<string | 'Todas' | ''>('');
  
  // Estado UI
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [savingRow, setSavingRow] = useState<number | null>(null);
  const [showSedeModal, setShowSedeModal] = useState<boolean>(false);
  const initRef = useRef(false);

  /** --- Carga de Datos --- */
  const fetchClients = async () => {
    try {
      setLoading(true);
      const data = await ClientService.getClients();
      // Solo clientes con fecha de agenda válida
      const withValidDate = (Array.isArray(data) ? data : []).filter((c) => Boolean(parseAgendaDate((c as any).fecha_agenda)));
      setClients(withValidDate);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la agenda');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  // --- 1. UNIFICACIÓN DE SEDES (SOLUCIÓN PEDIDA) ---
  const sedes = useMemo(() => {
    const map = new Map<string, string>();
    
    for (const c of clients) {
      const rawSede = getClientSede(c);
      const normalizedKey = normalize(safeText(rawSede));
      
      // Ignorar valores vacíos o inválidos
      if (!normalizedKey || ['n/a', '-', '—'].includes(normalizedKey)) continue;

      // Si no existe, agregamos la primera versión que encontremos (formateada bonita)
      if (!map.has(normalizedKey)) {
        // Capitalizar: bogota -> Bogota
        const display = rawSede.charAt(0).toUpperCase() + rawSede.slice(1).toLowerCase();
        map.set(normalizedKey, display);
      }
    }
    
    return Array.from(map.values()).sort();
  }, [clients]);

  // Inicialización de Sede
  useEffect(() => {
    if (initRef.current || loading) return;
    if (clients.length === 0) {
      initRef.current = true;
      setSelectedSede('Todas');
      return;
    }
    const saved = localStorage.getItem('agenda:selectedSede') || '';
    
    // Validamos si la sede guardada existe (usando normalización para comparar)
    const savedNorm = normalize(saved);
    const isValid = saved === 'Todas' || sedes.some(s => normalize(s) === savedNorm);

    if (saved && isValid) {
      // Si existe, usamos el nombre visual actual de la lista de sedes
      const visualName = sedes.find(s => normalize(s) === savedNorm) || saved;
      setSelectedSede(visualName);
    } else {
      setSelectedSede(sedes.length <= 1 ? (sedes[0] ?? 'Todas') : 'Todas');
      if (sedes.length > 1) setShowSedeModal(true);
    }
    initRef.current = true;
  }, [sedes, clients, loading]);

  /** --- Actualización --- */
  const onUpdate = async (payload: Partial<Client>): Promise<boolean> => {
    if (!payload.row_number) return false;
    setSavingRow(payload.row_number);
    const prevClients = clients;
    const prevView = viewClient;

    setClients(prev => prev.map(c => c.row_number === payload.row_number ? ({ ...c, ...payload } as Client) : c));
    if (viewClient && viewClient.row_number === payload.row_number) {
      setViewClient(v => ({ ...v, ...payload } as Client));
    }

    try {
      if (typeof (ClientService as any).updateClient === 'function') {
        await (ClientService as any).updateClient(payload);
      } else {
        await fetch('/api/clients/update', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(payload) 
        });
      }
      window.dispatchEvent(new CustomEvent('client:updated', { detail: payload }));
      return true;
    } catch (e) {
      setClients(prevClients);
      setViewClient(prevView);
      alert('Error al guardar cambios.');
      fetchClients();
      return false;
    } finally {
      setSavingRow(null);
    }
  };

  const handleToggleAsistencia = async (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    const current = (client as any).asistio_agenda === true;
    await onUpdate({ row_number: client.row_number, asistio_agenda: !current });
  };

  /** --- Filtrado por Pasos (Para contadores dinámicos) --- */

  // PASO 1: Filtrar solo por SEDE y BUSQUEDA (Contexto base)
  const filteredClientsBase = useMemo(() => {
    let filtered = [...clients];

    // Filtro Sede Unificado
    if (selectedSede && selectedSede !== 'Todas') {
      const targetNorm = normalize(String(selectedSede));
      filtered = filtered.filter((c) => normalize(getClientSede(c)) === targetNorm);
    }

    // Filtro Búsqueda
    const q = normalize(searchTerm);
    if (q) {
      filtered = filtered.filter(c => 
        normalize(safeText(c.nombre)).includes(q) || 
        normalize(safeText(c.whatsapp)).includes(q) || 
        normalize(safeText((c as any).asignado_a)).includes(q) || 
        normalize(safeText(c.modelo)).includes(q)
      );
    }
    
    return filtered;
  }, [clients, selectedSede, searchTerm]);

  // PASO 2: Calcular estadísticas basadas en el filtro base (SOLUCIÓN PEDIDA)
  // Ahora los números cambiarán si cambias de sede o buscas algo
  const stats = useMemo(() => ({
    today: filteredClientsBase.filter((c) => isTodayLocal(parseAgendaDate((c as any).fecha_agenda))).length,
    tomorrow: filteredClientsBase.filter((c) => isTomorrowLocal(parseAgendaDate((c as any).fecha_agenda))).length,
    history: filteredClientsBase.filter((c) => isPastLocal(parseAgendaDate((c as any).fecha_agenda))).length,
    future: filteredClientsBase.filter((c) => isFutureLocal(parseAgendaDate((c as any).fecha_agenda))).length,
  }), [filteredClientsBase]);

  // PASO 3: Aplicar filtro de FECHA para mostrar en pantalla
  const finalDisplayClients = useMemo(() => {
    let filtered = [...filteredClientsBase];

    switch (dateFilter) {
      case 'today': filtered = filtered.filter(c => isTodayLocal(parseAgendaDate((c as any).fecha_agenda))); break;
      case 'tomorrow': filtered = filtered.filter(c => isTomorrowLocal(parseAgendaDate((c as any).fecha_agenda))); break;
      case 'history': filtered = filtered.filter(c => isPastLocal(parseAgendaDate((c as any).fecha_agenda))); break;
      case 'future': filtered = filtered.filter(c => isFutureLocal(parseAgendaDate((c as any).fecha_agenda))); break;
      case 'custom':
        if (customDate) {
          const [y, m, d] = customDate.split('-').map(Number);
          const sel = new Date(y, (m ?? 1) - 1, d ?? 1);
          filtered = filtered.filter(c => {
            const cd = parseAgendaDate((c as any).fecha_agenda);
            return cd && cd.getDate() === sel.getDate() && cd.getMonth() === sel.getMonth() && cd.getFullYear() === sel.getFullYear();
          });
        } else { filtered = []; }
        break;
    }

    // Ordenamiento
    filtered.sort((a, b) => (parseAgendaDate((a as any).fecha_agenda)?.getTime() ?? 0) - (parseAgendaDate((b as any).fecha_agenda)?.getTime() ?? 0));
    
    if (dateFilter === 'history') filtered.reverse();

    return filtered;
  }, [filteredClientsBase, dateFilter, customDate]);

  // --- Manejo de Apertura de Cliente ---
  const handleOpenClient = (client: Client) => {
    const isWeb1 = safeText((client as any).source).toLowerCase() === 'web1';
    
    if (isWeb1) {
      const webId = safeText((client as any).asignado_a) || safeText(client.whatsapp) || `row_${client.row_number}`;
      setViewClient({
        ...client,
        whatsapp: webId 
      });
    } else {
      setViewClient(client);
    }
  };

  const handleWhatsAppClick = (val: string, e: React.MouseEvent, isWeb1: boolean) => {
    e.stopPropagation();
    if (isWeb1) {
        alert("Este es un cliente Web 1 (Chat interno). Usa la tarjeta para ver la conversación.");
        return;
    }
    window.open(`https://wa.me/${safeText(val).replace('@s.whatsapp.net', '')}`, '_blank');
  };

  const FilterTab = ({ id, label, count, icon: Icon }: any) => (
    <button
      onClick={() => setDateFilter(id)}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border whitespace-nowrap
        ${dateFilter === id 
          ? 'bg-white border-blue-200 text-blue-700 shadow-sm ring-1 ring-blue-100' 
          : 'border-transparent text-gray-500 hover:bg-white hover:text-gray-700'}`}
    >
      <Icon className={`w-4 h-4 ${dateFilter === id ? 'text-blue-600' : 'opacity-60'}`} />
      {label}
      <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${dateFilter === id ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
        {count}
      </span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-6 space-y-6 w-full">
      <SedeModal
        isOpen={showSedeModal}
        options={sedes}
        defaultSede={(selectedSede as string) || undefined}
        onSelect={(s) => { setSelectedSede(s); setShowSedeModal(false); }}
      />

      {/* HEADER */}
      <div className="sticky top-2 z-30 w-full">
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-sm border border-gray-200/80 p-3 md:p-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSedeModal(true)}
                className="flex items-center gap-2.5 px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-all shadow-sm group min-w-[160px]"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                   <MapPin className="w-4 h-4" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-none mb-0.5">Sede</p>
                  <p className="text-sm font-bold text-gray-800 leading-none truncate">{selectedSede || 'Todas'}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>
            </div>

            <div className="flex-1 max-w-2xl mx-auto w-full">
              <div className="relative group w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nombre, celular o modelo..."
                  className="block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all placeholder-gray-400"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={fetchClients}
              disabled={loading}
              className="hidden md:flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-blue-600 transition-colors"
              title="Recargar datos"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100 pt-3">
            <div className="flex overflow-x-auto pb-1 w-full sm:w-auto gap-2 no-scrollbar">
              <div className="flex bg-gray-100/60 p-1 rounded-xl gap-1">
                <FilterTab id="today" label="Hoy" count={stats.today} icon={CalendarDays} />
                <FilterTab id="tomorrow" label="Mañana" count={stats.tomorrow} icon={ArrowRightCircle} />
                <FilterTab id="future" label="Futuras" count={stats.future} icon={Calendar} />
                <FilterTab id="history" label="Anteriores" count={stats.history} icon={History} />
              </div>
            </div>
            
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all w-full sm:w-auto ${dateFilter === 'custom' ? 'bg-purple-50 border-purple-200 ring-1 ring-purple-100' : 'bg-gray-50 border-transparent'}`}>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Fecha:</span>
              <input
                type="date"
                value={customDate}
                onChange={(e) => { setCustomDate(e.target.value); setDateFilter('custom'); }}
                className="bg-transparent border-none text-sm text-gray-700 focus:ring-0 p-0 font-medium"
              />
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="w-full space-y-4 pb-10">
        {loading ? (
          <div className="space-y-4 animate-pulse max-w-6xl mx-auto">
             {[...Array(3)].map((_, i) => (
               <div key={i} className="bg-white rounded-2xl h-40 w-full border border-gray-100" />
             ))}
          </div>
        ) : finalDisplayClients.length > 0 ? (
          finalDisplayClients.map((client) => {
            const dateObj = parseAgendaDate((client as any).fecha_agenda);
            const attended = (client as any).asistio_agenda === true;
            const isSaving = savingRow === client.row_number;
            const lastMsg = (client as any).last_msg;
            const lastMsgDate = (client as any).created; 

            const isWeb1 = safeText((client as any).source).toLowerCase() === 'web1';
            const web1Id = isWeb1 ? (safeText((client as any).asignado_a) || 'Visitante') : '';

            const contactDisplay = isWeb1 ? web1Id : formatWhatsApp(safeText(client.whatsapp));
            const contactValue = isWeb1 ? web1Id : safeText(client.whatsapp);

            return (
              <div
                key={client.row_number}
                onClick={() => handleOpenClient(client)}
                className={`group w-full bg-white rounded-2xl border transition-all duration-200 hover:shadow-lg overflow-hidden cursor-pointer relative
                  ${attended 
                    ? 'border-emerald-200/80 ring-1 ring-emerald-100' 
                    : 'border-gray-200 hover:border-blue-300'
                  }
                `}
              >
                <div className="flex flex-col lg:flex-row items-stretch h-full">
                  
                  {/* LEFT */}
                  <div className="flex-1 p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                    
                    {/* Time Column */}
                    <div className="flex flex-row sm:flex-col items-center sm:items-start gap-4 sm:gap-1 min-w-[100px]">
                      <div className={`text-center sm:text-left p-3 sm:p-0 rounded-xl sm:rounded-none sm:bg-transparent ${attended ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                        <span className={`block text-3xl sm:text-4xl font-bold tracking-tight leading-none ${attended ? 'text-emerald-600' : 'text-gray-900'}`}>
                          {dateObj ? getDisplayTime(dateObj) : '--:--'}
                        </span>
                        <span className="text-xs font-bold uppercase text-gray-400 tracking-wide mt-1 block">
                          {dateObj ? getDisplayFullDate(dateObj) : ''}
                        </span>
                      </div>
                      
                      <div className="sm:mt-3">
                         <button
                           onClick={(e) => handleToggleAsistencia(client, e)}
                           disabled={isSaving}
                           className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border transition-all active:scale-95
                             ${attended 
                               ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200' 
                               : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600 shadow-sm'
                             } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                         >
                           {isSaving ? <RefreshCw className="w-3 h-3 animate-spin"/> : <CheckCircle2 className="w-3.5 h-3.5" />}
                           {attended ? 'Asistió' : 'Marcar'}
                         </button>
                      </div>
                    </div>

                    {/* Client Info */}
                    <div className="flex-1 min-w-0 border-l border-gray-100 pl-0 sm:pl-5 w-full">
                      <div className="flex items-start justify-between">
                        <div>
                           <h3 className={`text-xl font-bold truncate ${attended ? 'text-emerald-900' : 'text-gray-900'}`}>
                             {safeText(client.nombre) || 'Sin Nombre'}
                           </h3>
                           <div className="flex flex-wrap items-center gap-3 mt-1.5">
                             <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                               <Smartphone className="w-3.5 h-3.5 text-gray-400" />
                               {safeText(client.modelo) || 'Sin modelo'}
                             </span>
                             <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                               <MapPin className="w-3.5 h-3.5 text-gray-400" />
                               {getClientSede(client)}
                             </span>
                             {isWeb1 && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                                  <Globe className="w-3 h-3" /> WEB 1
                                </span>
                             )}
                           </div>
                        </div>
                        <div className="hidden sm:block">
                           <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold border uppercase tracking-wide shadow-sm ${getEtapaColor(client.estado_etapa as any)}`}>
                              {safeText(client.estado_etapa).replace(/_/g, ' ')}
                           </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT (Messages) */}
                  <div className={`w-full lg:w-[35%] border-t lg:border-t-0 lg:border-l border-gray-100 p-4 flex flex-col justify-between text-sm transition-colors ${attended ? 'bg-emerald-50/30' : 'bg-gray-50/50'}`}>
                    
                    <div className="space-y-3">
                      {lastMsg && (
                        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm relative">
                           <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" /> Último mensaje
                              </span>
                              <span className="text-[10px] text-gray-400">{formatMsgTime(lastMsgDate)}</span>
                           </div>
                           <p className="text-gray-700 line-clamp-2 leading-relaxed" title={lastMsg}>
                             "{lastMsg}"
                           </p>
                        </div>
                      )}

                      {(safeText(client.intencion) || safeText(client.notas)) && (
                        <div className="flex items-start gap-2 text-gray-500 px-1">
                           <FileText className="w-4 h-4 shrink-0 mt-0.5 text-gray-400" />
                           <p className="line-clamp-2 italic">
                             {safeText(client.intencion || client.notas)}
                           </p>
                        </div>
                      )}
                      
                      {!lastMsg && !safeText(client.intencion) && !safeText(client.notas) && (
                        <div className="h-full flex items-center justify-center text-gray-400 text-xs italic py-4">
                          Sin mensajes recientes ni notas
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex justify-end pt-3 border-t border-gray-200/50">
                      <button
                        onClick={(e) => handleWhatsAppClick(contactValue, e, isWeb1)}
                        className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg transition-colors border ${
                            isWeb1 
                            ? 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100 cursor-default'
                            : 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100 hover:text-green-700'
                        }`}
                      >
                        {isWeb1 ? <Globe className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                        {contactDisplay}
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 text-center max-w-4xl mx-auto mt-8">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 shadow-inner">
              <Calendar className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">No hay citas encontradas</h3>
            <p className="text-gray-500 max-w-md mt-2 px-4">
              {searchTerm 
                ? `No se encontraron resultados para "${searchTerm}" en la sede ${selectedSede || 'seleccionada'}.`
                : `No hay registros en ${selectedSede || 'todas las sedes'} para el filtro de fecha seleccionado.`}
            </p>
            {(searchTerm || dateFilter !== 'today') && (
              <button 
                onClick={() => { setSearchTerm(''); setDateFilter('today'); }}
                className="mt-6 text-blue-600 font-medium hover:underline"
              >
                Limpiar filtros y ver Hoy
              </button>
            )}
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