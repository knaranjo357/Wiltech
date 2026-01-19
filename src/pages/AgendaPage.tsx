import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Calendar, RefreshCw, Phone, X, CheckCircle2, MapPin, 
  ChevronRight, Search, CalendarDays, History, ArrowRightCircle,
  Smartphone, MessageSquare, FileText, Globe, AlertCircle, Check, User, Clock, ChevronDown
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
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const [, y, mo, d, hh, mm, ss] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), ss ? Number(ss) : 0);
  }
  return null;
};

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
    <div className="fixed inset-0 z-[140] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden ring-1 ring-black/5 transform transition-all scale-100">
        <div className="bg-slate-900 p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <MapPin className="w-24 h-24 text-white"/>
          </div>
          <h3 className="text-white font-bold text-xl flex items-center gap-2 relative z-10">
            Selecciona tu Sede
          </h3>
          <p className="text-slate-400 text-sm mt-1 relative z-10">Filtra la agenda por ubicación.</p>
        </div>
        <div className="p-3 max-h-[60vh] overflow-y-auto space-y-2">
          <button
            onClick={() => setSel('Todas')}
            className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all flex items-center justify-between group ${sel === 'Todas' ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' : 'border-transparent hover:bg-slate-50 text-slate-600'}`}
          >
            <span className="font-medium">Todas las sedes</span>
            {sel === 'Todas' && <CheckCircle2 className="w-5 h-5 text-blue-600"/>}
          </button>
          {options.map(s => (
            <button
              key={s}
              onClick={() => setSel(s)}
              className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all flex items-center justify-between group ${sel === s ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' : 'border-transparent hover:bg-slate-50 text-slate-600'}`}
            >
              <span className="font-medium">{s}</span>
              {sel === s && <CheckCircle2 className="w-5 h-5 text-blue-600"/>}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button 
            onClick={() => { localStorage.setItem('agenda:selectedSede', sel); onSelect(sel); }} 
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-black transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            Confirmar Sede
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

  const sedes = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clients) {
      const rawSede = getClientSede(c);
      const normalizedKey = normalize(safeText(rawSede));
      if (!normalizedKey || ['n/a', '-', '—'].includes(normalizedKey)) continue;
      if (!map.has(normalizedKey)) {
        const display = rawSede.charAt(0).toUpperCase() + rawSede.slice(1).toLowerCase();
        map.set(normalizedKey, display);
      }
    }
    return Array.from(map.values()).sort();
  }, [clients]);

  useEffect(() => {
    if (initRef.current || loading) return;
    if (clients.length === 0) {
      initRef.current = true;
      setSelectedSede('Todas');
      return;
    }
    const saved = localStorage.getItem('agenda:selectedSede') || '';
    const savedNorm = normalize(saved);
    const isValid = saved === 'Todas' || sedes.some(s => normalize(s) === savedNorm);

    if (saved && isValid) {
      const visualName = sedes.find(s => normalize(s) === savedNorm) || saved;
      setSelectedSede(visualName);
    } else {
      setSelectedSede(sedes.length <= 1 ? (sedes[0] ?? 'Todas') : 'Todas');
      if (sedes.length > 1) setShowSedeModal(true);
    }
    initRef.current = true;
  }, [sedes, clients, loading]);

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

  const filteredClientsBase = useMemo(() => {
    let filtered = [...clients];
    if (selectedSede && selectedSede !== 'Todas') {
      const targetNorm = normalize(String(selectedSede));
      filtered = filtered.filter((c) => normalize(getClientSede(c)) === targetNorm);
    }
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

  const stats = useMemo(() => ({
    today: filteredClientsBase.filter((c) => isTodayLocal(parseAgendaDate((c as any).fecha_agenda))).length,
    tomorrow: filteredClientsBase.filter((c) => isTomorrowLocal(parseAgendaDate((c as any).fecha_agenda))).length,
    history: filteredClientsBase.filter((c) => isPastLocal(parseAgendaDate((c as any).fecha_agenda))).length,
    future: filteredClientsBase.filter((c) => isFutureLocal(parseAgendaDate((c as any).fecha_agenda))).length,
  }), [filteredClientsBase]);

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
    filtered.sort((a, b) => (parseAgendaDate((a as any).fecha_agenda)?.getTime() ?? 0) - (parseAgendaDate((b as any).fecha_agenda)?.getTime() ?? 0));
    if (dateFilter === 'history') filtered.reverse();
    return filtered;
  }, [filteredClientsBase, dateFilter, customDate]);

  const handleOpenClient = (client: Client) => {
    const isWeb1 = safeText((client as any).source).toLowerCase() === 'web1';
    if (isWeb1) {
      const webId = safeText((client as any).asignado_a) || safeText(client.whatsapp) || `row_${client.row_number}`;
      setViewClient({ ...client, whatsapp: webId });
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

  const FilterTab = ({ id, label, count, icon: Icon }: any) => {
    const isActive = dateFilter === id;
    return (
      <button
        onClick={() => setDateFilter(id)}
        className={`relative flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-300
          ${isActive 
            ? 'bg-slate-900 text-white shadow-md shadow-slate-200 transform scale-105 ring-2 ring-slate-100' 
            : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'}`}
      >
        <Icon className={`w-4 h-4 ${isActive ? 'text-blue-300' : 'opacity-60'}`} />
        <span>{label}</span>
        {count > 0 && (
          <span className={`ml-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full 
            ${isActive ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-600'}`}>
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/80 p-3 sm:p-6 space-y-8 w-full font-sans text-slate-800">
      <SedeModal
        isOpen={showSedeModal}
        options={sedes}
        defaultSede={(selectedSede as string) || undefined}
        onSelect={(s) => { setSelectedSede(s); setShowSedeModal(false); }}
      />

      {/* HEADER FLOTANTE ESTILO GLASSMORPHISM */}
      <div className="sticky top-4 z-40 w-full max-w-7xl mx-auto">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 p-3 md:p-4 ring-1 ring-slate-900/5">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            
            {/* Sede & Search Bloque */}
            <div className="flex flex-col sm:flex-row w-full lg:w-auto gap-3 items-stretch sm:items-center flex-1">
              
              {/* Sede Selector */}
              <button
                onClick={() => setShowSedeModal(true)}
                className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 hover:bg-white border border-slate-200/60 rounded-2xl transition-all group lg:min-w-[220px]"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                   <MapPin className="w-4 h-4" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ubicación</p>
                  <p className="text-sm font-bold text-slate-800 truncate">{selectedSede || 'Todas'}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
              </button>

              {/* Barra Búsqueda */}
              <div className="relative group w-full max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-4.5 w-4.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar cliente, celular, modelo..."
                  className="block w-full pl-10 pr-10 py-3 border-0 bg-slate-100/50 rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:shadow-md transition-all"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-slate-200 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-300 transition-all">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Acciones Derecha */}
            <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
               <button
                  onClick={fetchClients}
                  disabled={loading}
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-colors"
                  title="Refrescar"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
                
                {/* Custom Date Picker Compacto */}
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${dateFilter === 'custom' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-transparent border-transparent'}`}>
                  <span className="text-xs font-bold uppercase tracking-wide opacity-50">Ir a:</span>
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => { setCustomDate(e.target.value); setDateFilter('custom'); }}
                    className="bg-transparent border-none text-sm font-semibold p-0 focus:ring-0 cursor-pointer"
                  />
                </div>
            </div>
          </div>

          {/* Filtros Tabs Scrollable */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex overflow-x-auto pb-1 gap-2 no-scrollbar scroll-smooth">
             <FilterTab id="today" label="Hoy" count={stats.today} icon={CalendarDays} />
             <FilterTab id="tomorrow" label="Mañana" count={stats.tomorrow} icon={ArrowRightCircle} />
             <div className="w-px h-6 bg-slate-200 mx-1 self-center hidden sm:block"></div>
             <FilterTab id="future" label="Futuras" count={stats.future} icon={Calendar} />
             <FilterTab id="history" label="Pasadas" count={stats.history} icon={History} />
          </div>
        </div>
      </div>

      {/* LISTA DE CITAS */}
      <div className="w-full max-w-7xl mx-auto space-y-4 pb-12">
        {loading ? (
          <div className="space-y-4 max-w-5xl mx-auto">
             {[...Array(3)].map((_, i) => (
               <div key={i} className="bg-white rounded-3xl h-44 w-full border border-slate-100 animate-pulse shadow-sm" />
             ))}
          </div>
        ) : finalDisplayClients.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {finalDisplayClients.map((client) => {
              const dateObj = parseAgendaDate((client as any).fecha_agenda);
              const attended = (client as any).asistio_agenda === true;
              const isSaving = savingRow === client.row_number;
              const lastMsg = (client as any).last_msg;
              const lastMsgDate = (client as any).created; 
              const isWeb1 = safeText((client as any).source).toLowerCase() === 'web1';
              const contactDisplay = isWeb1 ? (safeText((client as any).asignado_a) || 'Visitante') : formatWhatsApp(safeText(client.whatsapp));
              
              return (
                <div
                  key={client.row_number}
                  onClick={() => handleOpenClient(client)}
                  className={`group relative bg-white rounded-[20px] border transition-all duration-300 hover:shadow-[0_10px_40px_rgb(0,0,0,0.06)] hover:-translate-y-0.5 cursor-pointer overflow-hidden
                    ${attended 
                      ? 'border-emerald-200/60 shadow-sm' 
                      : 'border-slate-200/60 shadow-sm hover:border-indigo-200'
                    }
                  `}
                >
                  {/* Status Strip Lateral */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${attended ? 'bg-emerald-500' : 'bg-slate-200 group-hover:bg-indigo-500'} transition-colors duration-300`} />

                  <div className="flex flex-col lg:flex-row items-stretch">
                    
                    {/* LEFT: Hora & Acciones */}
                    <div className="flex flex-row lg:flex-col items-center lg:items-center justify-between lg:justify-center gap-4 p-5 lg:w-[140px] lg:bg-slate-50/50 lg:border-r border-slate-100">
                      <div className="text-center">
                        <span className={`block text-3xl font-black tracking-tighter ${attended ? 'text-emerald-600' : 'text-slate-800'}`}>
                          {dateObj ? getDisplayTime(dateObj) : '--:--'}
                        </span>
                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mt-0.5 block">
                          {dateObj ? getDisplayFullDate(dateObj) : ''}
                        </span>
                      </div>
                      
                      <button
                         onClick={(e) => handleToggleAsistencia(client, e)}
                         disabled={isSaving}
                         className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all active:scale-95
                           ${attended 
                             ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200 shadow-sm' 
                             : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600 hover:shadow-sm'
                           } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                       >
                         {isSaving ? <RefreshCw className="w-3 h-3 animate-spin"/> : <CheckCircle2 className="w-3.5 h-3.5" />}
                         {attended ? 'Asistió' : 'Pendiente'}
                       </button>
                    </div>

                    {/* CENTER: Info Principal */}
                    <div className="flex-1 p-5 min-w-0 flex flex-col justify-center">
                      <div className="flex items-start justify-between gap-4">
                        <div className="w-full">
                           <div className="flex items-center gap-2 mb-1">
                             <h3 className={`text-lg sm:text-xl font-bold truncate ${attended ? 'text-emerald-950' : 'text-slate-900'}`}>
                               {safeText(client.nombre) || 'Sin Nombre'}
                             </h3>
                             {isWeb1 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-700 uppercase tracking-wide">
                                  WEB
                                </span>
                             )}
                           </div>
                           
                           {/* Badges Info */}
                           <div className="flex flex-wrap items-center gap-2 mt-2">
                             <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                               <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                               <span className="truncate max-w-[150px]">{safeText(client.modelo) || 'Modelo no esp.'}</span>
                             </div>
                             <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                               <MapPin className="w-3.5 h-3.5 text-slate-400" />
                               <span>{getClientSede(client)}</span>
                             </div>
                             <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wide ${getEtapaColor(client.estado_etapa as any)}`}>
                                {safeText(client.estado_etapa).replace(/_/g, ' ')}
                             </span>
                           </div>
                        </div>
                      </div>

                      {/* Info Extra (Notas) visible en mobile */}
                      {(safeText(client.intencion) || safeText(client.notas)) && (
                        <div className="mt-3 flex items-start gap-2 text-slate-500">
                           <FileText className="w-4 h-4 shrink-0 mt-0.5 text-slate-300" />
                           <p className="text-xs line-clamp-1 italic text-slate-500">
                             {safeText(client.intencion || client.notas)}
                           </p>
                        </div>
                      )}
                    </div>

                    {/* RIGHT: Último Mensaje & Acción */}
                    <div className="w-full lg:w-[32%] border-t lg:border-t-0 lg:border-l border-slate-100 p-4 bg-slate-50/30 flex flex-col justify-between">
                      <div className="space-y-2">
                         {lastMsg ? (
                            <div className="bg-white p-3 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100">
                               <div className="flex justify-between items-center mb-1">
                                  <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">Reciente</span>
                                  <span className="text-[9px] text-slate-400">{formatMsgTime(lastMsgDate)}</span>
                               </div>
                               <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">"{lastMsg}"</p>
                            </div>
                         ) : (
                            <div className="h-16 flex items-center justify-center border border-dashed border-slate-200 rounded-xl">
                               <span className="text-xs text-slate-400 italic">Sin mensajes recientes</span>
                            </div>
                         )}
                      </div>

                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={(e) => handleWhatsAppClick(isWeb1 ? contactDisplay : safeText(client.whatsapp), e, isWeb1)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border
                              ${isWeb1 
                              ? 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'
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
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[30px] border border-dashed border-slate-200 text-center max-w-3xl mx-auto mt-4 shadow-sm">
            <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6 shadow-inner animate-in zoom-in duration-300">
              <Calendar className="w-10 h-10 text-indigo-300" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">No hay citas en esta vista</h3>
            <p className="text-slate-500 max-w-md px-4">
              {searchTerm 
                ? `No encontramos resultados para "${searchTerm}" en ${selectedSede || 'la sede actual'}.`
                : `Todo limpio por aquí. No hay registros para la fecha seleccionada.`}
            </p>
            {(searchTerm || dateFilter !== 'today') && (
              <button 
                onClick={() => { setSearchTerm(''); setDateFilter('today'); }}
                className="mt-8 px-6 py-2 bg-slate-900 text-white rounded-full text-sm font-medium hover:bg-black transition-all shadow-lg hover:shadow-xl"
              >
                Limpiar filtros
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