import { RepairLoader } from '../components/RepairLoader';
import { countryFetch } from '../services/countryRequest';
import { Pagination } from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { 
  Calendar, RefreshCw, Phone, X, CheckCircle2, MapPin, Search, CalendarDays, History, ArrowRightCircle,
  Smartphone, FileText, Globe, AlertCircle, Check, Clock, ChevronDown,
  CalendarClock, Send, Edit3, Layers, PenBox, BarChart3} from 'lucide-react';
import { ClientService } from '../services/clientService';
import { ApiService } from '../services/apiService';
import { Client } from '../types/client';
import { getEtapaColor, formatWhatsApp } from '../utils/clientHelpers';
import { ClientModal } from '../components/ClientModal';
import { AgendaReportModal } from '../components/AgendaReportModal';
import { NuevoCliente } from '../components/NuevoCliente';
import { safeText, normalize } from '../utils/textUtils';
import { useAuth } from '../hooks/useAuth';
import { ModalPortal } from '../components/ModalPortal';

/** ================== Configuración y Utils ================== */
const SOURCE_TO_SEDE: Record<string, string> = {
  Wiltech: 'Bogotá',
  WiltechBga: 'Bucaramanga',
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

const formatMsgTime = (val?: string | number | null) => {
  if (!val) return '';
  const d = new Date(typeof val === 'number' && val < 10000000000 ? val * 1000 : val);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (isToday) return `Hoy ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};


type DateFilter = 'today' | 'tomorrow' | 'history' | 'custom' | 'future';

const getClientSede = (c: Client): string => {
  const byAgenda = safeText(c.agenda_ciudad_sede);
  if (byAgenda) return byAgenda;
  const src = safeText(c.source);
  if (src && SOURCE_TO_SEDE[src]) return SOURCE_TO_SEDE[src];
  return safeText(c.ciudad);
};

/** ================== Modal Selección Sede ================== */
const SedeModal: React.FC<{
  isOpen: boolean;
  options: string[];
  defaultSede?: string;
  onSelect: (sede: string | 'Todas') => void;
  onClose: () => void;
}> = ({ isOpen, options, defaultSede, onSelect, onClose }) => {
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

  return (
    <ModalPortal open={isOpen} onClose={onClose} className="max-w-sm" ariaLabel="Seleccionar sede">
        <div className="bg-slate-900 p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <MapPin className="w-24 h-24 text-white"/>
          </div>
          <h3 className="text-white font-bold text-xl flex items-center gap-2 relative z-10">
            Selecciona tu Sede
          </h3>
          <p className="text-slate-400 text-sm mt-1 relative z-10">Filtra la agenda por ubicación.</p>
        </div>
        <div className="p-4 max-h-[60vh] overflow-y-auto grid grid-cols-2 gap-3 custom-scrollbar">
          <button
            onClick={() => setSel('Todas')}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between group ${sel === 'Todas' ? 'bg-black border-black text-white shadow-lg shadow-black/15' : 'border-slate-200 hover:bg-slate-50 text-slate-600 bg-white shadow-sm'}`}
          >
            <span className="font-medium text-sm">Todas</span>
            {sel === 'Todas' && <CheckCircle2 className="w-4 h-4 text-white"/>}
          </button>
          {options.map(s => (
            <button
              key={s}
              onClick={() => setSel(s)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between group ${sel === s ? 'bg-black border-black text-white shadow-lg shadow-black/15' : 'border-slate-200 hover:bg-slate-50 text-slate-600 bg-white shadow-sm'}`}
            >
              <span className="font-medium text-sm truncate">{s}</span>
              {sel === s && <CheckCircle2 className="w-4 h-4 text-white"/>}
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
    </ModalPortal>
  );
};

/** ================== Modal Reagendar Mensaje ================== */
const ReagendarModal: React.FC<{
  isOpen: boolean;
  client: Client | null;
  loading: boolean;
  onClose: () => void;
  onSend: (msg: string) => void;
}> = ({ isOpen, client, loading, onClose, onSend }) => {
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (client) {
      const firstName = safeText(client.nombre).split(' ')[0] || 'Hola';
      setMsg(`${firstName}, por alguna razón notamos que no pudiste asistir a la cita que teníamos agendada. ¿Te gustaría reagendar?`);
    }
  }, [client]);

  if (!client) return null;

  return (
    <ModalPortal open={isOpen} onClose={() => { if (!loading) onClose(); }} className="max-w-md flex flex-col" ariaLabel="Reagendar cita" closeOnBackdrop={!loading}>
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
           <div className="flex items-center gap-2 text-slate-800">
              <CalendarClock className="w-5 h-5" />
              <h3 className="font-bold text-lg">Reagendar Cita</h3>
           </div>
           <button onClick={onClose} disabled={loading} className="p-1 hover:bg-slate-200 rounded-full transition text-slate-400 hover:text-slate-600">
             <X className="w-5 h-5" />
           </button>
        </div>
        <div className="p-5">
           <p className="text-sm text-slate-500 mb-2">
             Se enviará el siguiente mensaje a <span className="font-bold text-slate-800">{client.nombre}</span>:
           </p>
           <div className="relative">
             <textarea
               value={msg}
               onChange={(e) => setMsg(e.target.value)}
               disabled={loading}
               rows={4}
               className="w-full text-sm p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-600 outline-none resize-none leading-relaxed text-slate-700 shadow-sm"
               placeholder="Escribe el mensaje de reagendamiento..."
             />
             <Edit3 className="absolute right-3 bottom-3 w-4 h-4 text-slate-300 pointer-events-none" />
           </div>
           <div className="mt-4 flex gap-2 items-center text-xs text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>Al enviar, el estado del cliente cambiará automáticamente a <b>"Reagendar"</b>.</p>
           </div>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
           <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded-xl text-slate-600 font-medium hover:bg-slate-200 hover:text-slate-800 transition text-sm">Cancelar</button>
           <button onClick={() => onSend(msg)} disabled={loading || !msg.trim()} className="px-5 py-2 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition shadow-lg shadow-slate-900/20 active:scale-95 flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
             {loading ? <RepairLoader variant="icon" /> : <Send className="w-4 h-4" />}
             Enviar Mensaje
           </button>
        </div>
    </ModalPortal>
  );
};

/** ================== Componente Principal ================== */
export const AgendaPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = useMemo(
    () => user?.role?.split(',').some((role) => ['admin', 'root'].includes(role.trim().toLowerCase())) ?? false,
    [user?.role],
  );
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtros
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customDate, setCustomDate] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); 
  const deferredSearch = useDeferredValue(searchTerm);
  const [selectedSede, setSelectedSede] = useState<string | 'Todas' | ''>('');
  
  // Estado UI
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [savingRow, setSavingRow] = useState<number | null>(null);
  const [showSedeModal, setShowSedeModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Reagendar
  const [reagendarModalOpen, setReagendarModalOpen] = useState(false);
  const [clientToReagendar, setClientToReagendar] = useState<Client | null>(null);
  const [sendingReagendar, setSendingReagendar] = useState(false);
  
  const initRef = useRef(false);

  /** --- Carga de Datos --- */
  const fetchClients = async (force = true) => {
    try {
      setLoading(true);
      const data = await ClientService.getAgendaClients({ force });
      const withValidDate = (Array.isArray(data) ? data : []).filter((c) => Boolean(parseAgendaDate(c.fecha_agenda)));
      setClients(withValidDate);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la agenda');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(false); }, []);

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
      if (typeof ClientService.updateClient === 'function') {
        await ClientService.updateClient(payload);
      } else {
        await countryFetch('/api/clients/update', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(payload) 
        });
      }
      return true;
    } catch {
      setClients(prevClients);
      setViewClient(prevView);
      alert('Error al guardar cambios.');
      fetchClients();
      return false;
    } finally {
      setSavingRow(null);
    }
  };

  // --- LÓGICA DE REAGENDAMIENTO AUTOMÁTICO (Modal) ---
  const handleOpenReagendarModal = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    if (safeText(client.estado_etapa).toLowerCase() === 'reagendar') return;
    setClientToReagendar(client);
    setReagendarModalOpen(true);
  };

  const handleConfirmReagendar = async (messageText: string) => {
    if (!clientToReagendar) return;
    setSendingReagendar(true);
    try {
        const payload = {
            row_number: clientToReagendar.row_number,
            nombre: clientToReagendar.nombre,
            whatsapp: clientToReagendar.whatsapp,
            source: clientToReagendar.source || 'Agenda',
            mensaje: messageText
        };
        await ApiService.post('/enviarmensaje-reagendar', payload);
        await onUpdate({ 
            row_number: clientToReagendar.row_number, 
            estado_etapa: 'Reagendar' 
        });
        setReagendarModalOpen(false);
        setClientToReagendar(null);
    } catch (error) {
        console.error('Error reagendando:', error);
        alert('Error enviando el mensaje: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
        setSendingReagendar(false);
    }
  };

  // --- NUEVA LÓGICA: CAMBIO MANUAL A REAGENDAR (Fallback) ---
  const handleManualSetReagendar = async (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("¿Deseas cambiar manualmente la etapa a 'Reagendar' sin enviar mensaje?")) {
        await onUpdate({ 
            row_number: client.row_number, 
            estado_etapa: 'Reagendar' 
        });
    }
  };

  const handleToggleAsistencia = async (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    const current = client.asistio_agenda === true;
    await onUpdate({ row_number: client.row_number, asistio_agenda: !current });
  };

  // --- LÓGICA BOTÓN WHATSAPP ---
  const handleWhatsAppClick = (val: string, e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    const source = safeText(client.source).toLowerCase();
    
    // Regla: Permitir si empieza por "wil", es "directo", o está vacío/null
    const allowRedirect = source.startsWith('wil') || source === 'directo' || source === '';

    if (allowRedirect) {
        window.open(`https://wa.me/${safeText(val).replace('@s.whatsapp.net', '')}`, '_blank');
    } else {
        alert(`La redirección directa a WhatsApp solo está habilitada para fuentes Wiltech, Directo o sin asignar.\nFuente actual: "${client.source}"`);
    }
  };

  const handleOpenClient = (client: Client) => {
    const isWeb1 = safeText(client.source).toLowerCase() === 'web1';
    if (isWeb1) {
      const webId = safeText(client.asignado_a) || safeText(client.whatsapp) || `row_${client.row_number}`;
      setViewClient({ ...client, whatsapp: webId });
    } else {
      setViewClient(client);
    }
  };

  // ... (useMemos de filtros: filteredClientsBase, stats, finalDisplayClients) ...
  const filteredClientsBase = useMemo(() => {
    let filtered = [...clients];
    if (selectedSede && selectedSede !== 'Todas') {
      const targetNorm = normalize(String(selectedSede));
      filtered = filtered.filter((c) => normalize(getClientSede(c)) === targetNorm);
    }
    const q = normalize(deferredSearch);
    if (q) {
      filtered = filtered.filter(c => 
        normalize(safeText(c.nombre)).includes(q) || 
        normalize(safeText(c.whatsapp)).includes(q) || 
        normalize(safeText(c.asignado_a)).includes(q) ||
        normalize(safeText(c.modelo)).includes(q)
      );
    }
    return filtered;
  }, [clients, selectedSede, deferredSearch]);

  const stats = useMemo(() => ({
    today: filteredClientsBase.filter((c) => isTodayLocal(parseAgendaDate(c.fecha_agenda))).length,
    tomorrow: filteredClientsBase.filter((c) => isTomorrowLocal(parseAgendaDate(c.fecha_agenda))).length,
    history: filteredClientsBase.filter((c) => isPastLocal(parseAgendaDate(c.fecha_agenda))).length,
    future: filteredClientsBase.filter((c) => isFutureLocal(parseAgendaDate(c.fecha_agenda))).length,
  }), [filteredClientsBase]);


  const finalDisplayClients = useMemo(() => {
    let filtered = [...filteredClientsBase];
    switch (dateFilter) {
      case 'today': filtered = filtered.filter(c => isTodayLocal(parseAgendaDate(c.fecha_agenda))); break;
      case 'tomorrow': filtered = filtered.filter(c => isTomorrowLocal(parseAgendaDate(c.fecha_agenda))); break;
      case 'history': filtered = filtered.filter(c => isPastLocal(parseAgendaDate(c.fecha_agenda))); break;
      case 'future': filtered = filtered.filter(c => isFutureLocal(parseAgendaDate(c.fecha_agenda))); break;
      case 'custom':
        if (customDate) {
          const [y, m, d] = customDate.split('-').map(Number);
          const sel = new Date(y, (m ?? 1) - 1, d ?? 1);
          filtered = filtered.filter(c => {
            const cd = parseAgendaDate(c.fecha_agenda);
            return cd && cd.getDate() === sel.getDate() && cd.getMonth() === sel.getMonth() && cd.getFullYear() === sel.getFullYear();
          });
        } else { filtered = []; }
        break;
    }
    filtered.sort((a, b) => (parseAgendaDate(a.fecha_agenda)?.getTime() ?? 0) - (parseAgendaDate(b.fecha_agenda)?.getTime() ?? 0));
    if (dateFilter === 'history') filtered.reverse();
    return filtered;
  }, [filteredClientsBase, dateFilter, customDate]);

  const pagination = usePagination(finalDisplayClients, JSON.stringify([deferredSearch, selectedSede, dateFilter, customDate]));

  const FilterTab = ({ id, label, count, icon: Icon }: { id: DateFilter; label: string; count: number; icon: typeof Calendar }) => {
    const isActive = dateFilter === id;
    return (
      <button
        onClick={() => setDateFilter(id)}
        className={`wt-filter-pill ${isActive ? 'wt-filter-pill-active' : ''} flex items-center gap-1.5`}
      >
        <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'opacity-60'}`} />
        <span>{label}</span>
        {count > 0 && (
          <span className={`ml-1 px-1.5 py-0.5 text-[9px] rounded-full font-bold
            ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200/50 text-slate-500'}`}>
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      <SedeModal
        isOpen={showSedeModal}
        options={sedes}
        defaultSede={(selectedSede as string) || undefined}
        onClose={() => setShowSedeModal(false)}
        onSelect={(s) => { setSelectedSede(s); setShowSedeModal(false); }}
      />
      <ReagendarModal
        isOpen={reagendarModalOpen}
        client={clientToReagendar}
        loading={sendingReagendar}
        onClose={() => { setReagendarModalOpen(false); setClientToReagendar(null); }}
        onSend={handleConfirmReagendar}
      />

      <div className="page-container relative overflow-hidden flex flex-col space-y-6 min-h-[calc(100vh-100px)]">
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        
        {/* Background Decorations */}

      {/* HEADER DASHBOARD */}
      <div className="relative z-10 flex flex-col gap-6">
        <div className="wt-page-heading flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
               <div className="w-12 h-12 rounded-xl bg-slate-950 text-white flex items-center justify-center shadow-lg shadow-slate-900/15 relative z-10 border border-white/10">
                 <Calendar className="w-6 h-6" />
               </div>
            </div>
            <div>
              <h1 className="wt-page-title">Agenda de Citas</h1>
              <div className="flex items-center gap-2 mt-1.5 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setShowSedeModal(true)}>
                <MapPin className="w-3.5 h-3.5 text-slate-700" />
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">{selectedSede || 'Todas las Sedes'}</p>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="wt-input-wrap w-full md:w-[300px] lg:w-[400px]">
              <Search className="wt-input-icon" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, celular o modelo..."
                className="bg-white/60 backdrop-blur-sm border-white/40 shadow-sm"
                type="search"
              />
            </div>
            {isAdmin && (
            <button
              onClick={() => setShowReportModal(true)}
              className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-0.5 hover:bg-slate-800 active:scale-95"
              type="button"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Reportes</span>
            </button>
            )}
            <button 
               onClick={() => void fetchClients()} 
              disabled={loading} 
              className="flex items-center justify-center w-11 h-11 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/40 text-slate-500 hover:text-slate-800 hover:bg-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? <RepairLoader variant="icon" /> : <RefreshCw className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* QUICK STATS & FILTERS */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/30 backdrop-blur-sm">
            <FilterTab id="today" label="Hoy" count={stats.today} icon={CalendarDays} />
            <FilterTab id="tomorrow" label="Mañana" count={stats.tomorrow} icon={ArrowRightCircle} />
            <FilterTab id="future" label="Próximas" count={stats.future} icon={Calendar} />
            <FilterTab id="history" label="Pasadas" count={stats.history} icon={History} />
          </div>

          <div className="h-10 w-[1px] bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-3 px-4 py-2 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-sm group hover:border-slate-300 transition-all">
            <Clock className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
            <input 
              type="date" 
              value={customDate} 
              onChange={(e) => { setCustomDate(e.target.value); setDateFilter('custom'); }} 
              className="bg-transparent border-none text-xs font-black uppercase tracking-wider p-0 focus:ring-0 cursor-pointer text-slate-600" 
            />
          </div>
        </div>
      </div>

      <div className="w-full mx-auto space-y-4 pb-12">
        {loading ? (
          <RepairLoader variant="panel" label="Cargando agenda" />
        ) : finalDisplayClients.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-3">
              {pagination.items.map((client) => {
                const dateObj = parseAgendaDate(client.fecha_agenda);
                const attended = client.asistio_agenda === true;
                const isSaving = savingRow === client.row_number;
                const isEtapaReagendar = safeText(client.estado_etapa).toLowerCase() === 'reagendar';

                const lastMsg = client.last_msg;
                const lastMsgDate = client.created;
                
                const isWeb1 = safeText(client.source).toLowerCase() === 'web1';
                const contactDisplay = isWeb1 ? (safeText(client.asignado_a) || 'Visitante') : formatWhatsApp(safeText(client.whatsapp));
                
                return (
                  <div
                    key={client.row_number}
                    onClick={() => handleOpenClient(client)}
                    className="group wt-ops-card cursor-pointer animate-in fade-in slide-in-from-bottom-4"
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors duration-300 ${attended ? 'bg-emerald-500' : 'bg-slate-300 group-hover:bg-slate-950'}`} />
                    
                    <div className="wt-ops-card-layout">
                      
                      {/* TIME & ACTIONS */}
                      <div className="wt-ops-card-rail">
                        <div className="text-center">
                          <span className={`block text-2xl font-black tracking-tighter transition-colors ${attended ? 'text-emerald-600' : 'text-slate-900'}`}>
                            {dateObj ? getDisplayTime(dateObj) : '--:--'}
                          </span>
                          <div className="flex items-center justify-center gap-1.5 mt-1">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                              {dateObj ? getDisplayFullDate(dateObj) : ''}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-1.5 w-full max-w-[108px]">
                          <button
                            onClick={(e) => handleToggleAsistencia(client, e)}
                            disabled={isSaving}
                            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all active:scale-95
                              ${attended 
                                ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-200/50' 
                                : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-800 hover:bg-slate-50'
                              } ${isSaving ? 'opacity-50' : ''}`}
                          >
                            {isSaving ? <RepairLoader variant="icon" /> : attended ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border-2 border-current" />}
                            {attended ? 'Asistió' : 'Marcar'}
                          </button>

                          {!attended && (
                            <button
                              onClick={(e) => handleOpenReagendarModal(client, e)}
                              disabled={isEtapaReagendar}
                              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all active:scale-95
                                ${isEtapaReagendar 
                                  ? 'bg-amber-100 text-amber-600 border-amber-200 opacity-60' 
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-white hover:shadow-md'
                                }`}
                            >
                              <CalendarClock className="w-3.5 h-3.5" />
                              {isEtapaReagendar ? 'Pend.' : 'Reagend.'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* MAIN CONTENT */}
                      <div className="wt-ops-card-main">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                               <h3 className="text-lg font-extrabold text-slate-900 tracking-tight truncate max-w-[360px]">
                                 {safeText(client.nombre) || 'Sin Nombre'}
                               </h3>
                               {isWeb1 && (
                                  <span className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-blue-100 text-blue-600 border border-blue-200 uppercase tracking-widest shadow-sm">
                                    WEB
                                  </span>
                               )}
                               <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black border uppercase tracking-widest shadow-sm ${getEtapaColor(client.estado_etapa)}`}>
                                  {safeText(client.estado_etapa).replace(/_/g, ' ')}
                               </span>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <div className="wt-ops-chip">
                                <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                                <span className="truncate max-w-[120px]">{safeText(client.modelo) || 'Modelo no esp.'}</span>
                              </div>
                              <div className="wt-ops-chip">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                <span>{getClientSede(client)}</span>
                              </div>
                              {safeText(client.source) && (
                                <div className="wt-ops-chip">
                                   <Layers className="w-3.5 h-3.5 text-slate-400" />
                                   <span className="truncate max-w-[100px]">{safeText(client.source)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {(safeText(client.intencion) || safeText(client.notas)) && (
                          <div className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                             <FileText className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                             <p className="text-xs text-slate-600 leading-relaxed italic line-clamp-2">
                               {safeText(client.intencion || client.notas)}
                             </p>
                          </div>
                        )}
                      </div>

                      {/* MESSAGES & MANUAL ACTIONS */}
                      <div className="wt-ops-card-aside">
                        <div className="space-y-3">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block ml-1">Último Mensaje</span>
                           {lastMsg ? (
                              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm relative group/msg">
                                 <div className="flex justify-between items-center mb-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-800 animate-pulse" />
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">{formatMsgTime(lastMsgDate)}</span>
                                 </div>
                                 <p className="text-[11px] text-slate-700 font-medium leading-relaxed line-clamp-2">"{lastMsg}"</p>
                              </div>
                           ) : (
                              <div className="h-14 flex items-center justify-center border border-dashed border-slate-200 rounded-xl">
                                 <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Sin actividad</span>
                              </div>
                           )}
                        </div>

                        <div className="flex items-center gap-2 justify-end">
                          {!attended && (
                              <button
                                  onClick={(e) => handleManualSetReagendar(client, e)}
                                  disabled={isEtapaReagendar}
                                  className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all border
                                      ${isEtapaReagendar
                                          ? 'bg-amber-50 text-amber-500 border-amber-100 opacity-50'
                                          : 'bg-white text-slate-400 border-slate-100 hover:text-slate-800 hover:border-slate-300 hover:shadow-md'
                                      }`}
                                  title="Editar manualmente"
                              >
                                  <PenBox className="w-4 h-4" />
                              </button>
                          )}

                          <button
                            onClick={(e) => handleWhatsAppClick(safeText(client.whatsapp), e, client)}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all border tracking-wide
                                ${isWeb1 
                                ? 'bg-black text-white border-black shadow-lg shadow-black/15 hover:bg-zinc-800'
                                : 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-200/50 hover:bg-emerald-700'
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
            <Pagination {...pagination} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in zoom-in duration-700 relative z-10">
            <div className="w-24 h-24 rounded-[40px] bg-white shadow-xl shadow-slate-200/50 flex items-center justify-center mb-8 border border-white relative group">
              <div className="absolute inset-0 bg-slate-800 blur-2xl opacity-10 group-hover:opacity-20 transition-opacity" />
              <Calendar className="w-10 h-10 text-slate-300 relative z-10" />
            </div>
            <h3 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Agenda Vacía</h3>
            <p className="text-slate-500 max-w-xs font-medium leading-relaxed">
              {searchTerm 
                ? `No hay resultados para "${searchTerm}" en esta vista.`
                : `Todo al día. No hay citas programadas para el filtro seleccionado.`}
            </p>
            {(searchTerm || dateFilter !== 'today') && (
              <button 
                onClick={() => { setSearchTerm(''); setDateFilter('today'); }}
                className="mt-10 px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-xl shadow-slate-200 hover:bg-black hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95"
              >
                Restablecer Filtros
              </button>
            )}
          </div>
        )}
      </div>
      </div>

      {isAdmin && (
      <AgendaReportModal
        clients={clients}
        selectedSede={selectedSede || 'Todas'}
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
      />
      )}
      <ClientModal
        isOpen={!!viewClient}
        onClose={() => setViewClient(null)}
        client={viewClient}
        onUpdate={onUpdate}
      />

      <NuevoCliente onCreated={() => void fetchClients()} floating={true} />
    </>
  );
};
