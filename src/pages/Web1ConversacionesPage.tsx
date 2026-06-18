// src/pages/Web1ConversacionesPage.tsx
import React, { useEffect, useMemo, useRef, useState, useDeferredValue, useCallback, memo } from 'react';
import { RefreshCw, Search, MessageSquare, ArrowUpDown, Bot, User, MoreHorizontal, AlertCircle, Hash, Globe, Zap } from 'lucide-react';
import { Client } from '../types/client';
import { ClientService } from '../services/clientService';
import { formatDate } from '../utils/clientHelpers';
import { ChatPanel } from '../components/ChatPanel';
import { ClientModal } from '../components/ClientModal';

/** ================== COMPONENTE AGENTE N8N (FORZADO MODO CLARO) ================== */
const N8nChatWidget = memo(() => {
  useEffect(() => {
    // 1. Cargar fuentes Google Fonts (Montserrat)
    const fontLink = document.createElement('link');
    fontLink.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&family=Lexend:wght@400;600&display=swap";
    fontLink.rel = "stylesheet";
    document.head.appendChild(fontLink);

    // 2. Cargar hoja de estilos base de n8n
    const styleLink = document.createElement('link');
    styleLink.href = "https://cdn.jsdelivr.net/npm/@n8n/chat/dist/style.css";
    styleLink.rel = "stylesheet";
    document.head.appendChild(styleLink);

    // 3. Inyectar script del chat
    const script = document.createElement('script');
    script.type = 'module';
    script.innerHTML = `
      import { createChat } from 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js';
      
      createChat({
        webhookUrl: 'https://n8n.alliasoft.com/webhook/b4d44bd0-9b8c-46da-97a1-108d15203166/chat',
        mode: 'window', 
        showWelcomeScreen: false,
        defaultLanguage: 'es',
        initialMessages: [
            '¡Hola! Bienvenid@.',
            '¿En qué puedo ayudarte hoy?'
        ],
        i18n: {
            es: {
                title: 'Wiltech',
                subtitle: '',
                footer: 'Powered by Xactus', 
                getStarted: 'Comenzar Chat',
                inputPlaceholder: 'Escribe tu mensaje aquí...',
            },
        },
      });
    `;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
      document.head.removeChild(styleLink);
      document.head.removeChild(fontLink);
    };
  }, []);

  return (
    <style>{`
      /* =========================================
         FORZAR TEMA CLARO (LIGHT MODE)
         ========================================= */
      :root {
          /* Colores Base de Marca */
          --brand-primary: #013e7b;
          --brand-accent: #5C95FF;
          --white: #FFFFFF;
          
          /* Colores Específicos del Tema Claro */
          --light-bg: #FFFFFF;
          --light-gray-bg: #F0F2F5; /* Gris estilo Messenger */
          --text-main: #1c1e21;
          --text-muted: #65676B;
          --border-color: #e0e0e0;

          /* =========================================
             VARIABLES N8N (Mapeo Directo a Claro)
             ========================================= */
          
          --chat--font-family: 'Montserrat', sans-serif;
          
          /* Colores Principales */
          --chat--color-primary: var(--brand-accent);
          --chat--color-secondary: var(--brand-primary);
          --chat--color-dark: var(--light-gray-bg);
          --chat--color-light: var(--white);
          
          /* Ventana Principal (Fondo Blanco) */
          --chat--window--background: var(--light-bg);
          
          /* Cabecera (Azul Marca) */
          --chat--header--background: var(--brand-primary);
          --chat--header--color: var(--white);
          
          /* Mensajes del BOT (Gris claro con texto negro) */
          --chat--message--bot--background: var(--light-gray-bg);
          --chat--message--bot--color: #000000;
          --chat--message--bot--border: 1px solid var(--border-color);
          
          /* Mensajes del USUARIO (Azul con texto blanco) */
          --chat--message--user--background: var(--brand-primary);
          --chat--message--user--color: var(--white);
          
          /* Área de Input (Fondo Blanco y Input Gris) */
          --chat--input-footer--background: var(--light-bg); 
          --chat--input--background: var(--light-gray-bg);
          --chat--input--color: #000000;
          --chat--input--placeholder-color: var(--text-muted);
          
          /* Botón Flotante */
          --chat--toggle--background: var(--brand-primary);
          --chat--toggle--hover--background: var(--brand-accent);
          --chat--toggle--icon-color: var(--white);
          
          /* Dimensiones y Capas */
          --chat--window--width: 10000px;
          --chat--window--height: 10000px;
          --chat--border-radius: 16px;
          --chat--z-index: 9999; 
      }
    `}</style>
  );
});

/** ================== Tipos y Normalización ================== */

type ChatRow = {
  row_number: number;
  nombre: string;
  whatsapp: string;
  asignado_a: string;
  modelo: string | null;
  ciudad: string | null;
  source: string | null;
  created: number;
  last_msg: number;
  consentimiento_contacto: boolean | null;
  subscriber_id: number | null;
};

interface ExtendedClient extends Omit<Client, 'created' | 'last_msg' | 'consentimiento_contacto' | 'modelo' | 'ciudad' | 'source'> {
  modelo?: string | null;
  ciudad?: string | null;
  guia_ciudad?: string | null;
  source?: string | null;
  asignado_a?: string | null;
  created?: string | number | Date | null;
  last_msg?: string | number | Date | null;
  consentimiento_contacto?: boolean | '' | null;
  subscriber_id?: number | null;
}

type SortOrder = 'asc' | 'desc';
type SortKey = 'created' | 'last_msg';

/** ================== Utilidades ================== */
const PAGE_SIZE = 80;
const TARGET_SOURCE = 'web1';

const normalizeText = (v: unknown) =>
  String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const parseDateToTimestamp = (v: unknown): number => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  const str = String(v).trim();
  if (!str) return 0;
  
  const safeStr = str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str;
  const time = Date.parse(safeStr);
  return Number.isNaN(time) ? 0 : time;
};

const normalizeConsent = (val: boolean | '' | null | undefined): boolean | null => {
  if (val === '' || val === undefined || val === null) return null;
  return val === true;
};

const fmt = (v: unknown, placeholder = ''): string => {
  const s = (v ?? '').toString().trim();
  return (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') ? placeholder : s;
};

/** Deduplicación y conversión basada en ASIGNADO_A */
function dedupeByAsignadoA(clients: ExtendedClient[]): ChatRow[] {
  const map = new Map<string, ChatRow>();
  
  for (const c of clients) {
    const currentSource = normalizeText(c.source);
    if (currentSource !== TARGET_SOURCE) continue;

    const rawId = c.asignado_a ? String(c.asignado_a).trim() : '';
    const uniqueId = rawId || `row_${c.row_number}`;

    const createdTs = parseDateToTimestamp(c.created);
    const lastMsgTs = parseDateToTimestamp(c.last_msg);

    const candidate: ChatRow = {
      row_number: c.row_number,
      nombre: fmt(c.nombre, 'Visitante Web'),
      whatsapp: c.whatsapp ? String(c.whatsapp).trim() : '', 
      asignado_a: rawId || uniqueId,
      modelo: c.modelo || null,
      ciudad: c.ciudad || c.guia_ciudad || null,
      source: c.source || TARGET_SOURCE,
      created: createdTs,
      last_msg: lastMsgTs,
      consentimiento_contacto: normalizeConsent(c.consentimiento_contacto),
      subscriber_id: c.subscriber_id ? Number(c.subscriber_id) : null,
    };

    const current = map.get(uniqueId);
    if (!current || candidate.created > current.created) {
      map.set(uniqueId, candidate);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.created - a.created);
}

const rowToClient = (r: ChatRow): Client => ({
  ...r,
  modelo: r.modelo || undefined, 
  ciudad: r.ciudad || '', 
  source: r.source || undefined,
  created: r.created ? new Date(r.created).toISOString() : undefined,
  last_msg: r.last_msg ? new Date(r.last_msg).toISOString() : undefined,
  consentimiento_contacto: r.consentimiento_contacto ?? undefined,
} as unknown as Client);

/** ================== Componentes Memoizados ================== */

const RowItem = memo(({ 
  row, active, onClick, onOpenDialog, onToggleBot, busy, sortKey 
}: {
  row: ChatRow;
  active: boolean;
  onClick: () => void;
  onOpenDialog: (e: React.MouseEvent) => void;
  onToggleBot: (e: React.MouseEvent) => void;
  busy?: boolean;
  sortKey: SortKey;
}) => {
  const timeTs = sortKey === 'last_msg' ? row.last_msg : row.created;
  const timeDisplay = timeTs > 0 ? formatDate(new Date(timeTs).toISOString()) : '—';
  
  const botActive = row.consentimiento_contacto !== false; 

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className={`group relative w-full p-4 rounded-3xl border transition-all duration-300 cursor-pointer flex items-start gap-4 select-none mb-2
        ${active 
          ? 'bg-white border-blue-500 shadow-2xl shadow-blue-100 scale-[1.02] z-10 ring-1 ring-blue-50' 
          : 'bg-white/40 backdrop-blur-sm border-transparent hover:bg-white/80 hover:border-slate-200 hover:shadow-xl'
        }
      `}
    >
      <div className="relative shrink-0">
         <div className={`w-12 h-12 rounded-[18px] flex items-center justify-center text-sm font-black border shadow-sm transition-all duration-300 ${
            active ? 'bg-slate-900 text-white border-slate-900 rotate-3' : 'bg-white text-slate-400 border-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600'
         }`}>
            <Globe className="w-5 h-5" />
         </div>
         {botActive ? (
             <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center shadow-lg animate-pulse" title="Bot Activo">
                 <Zap size={10} className="text-white fill-white" />
             </div>
         ) : (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-slate-200 border-2 border-white rounded-full flex items-center justify-center shadow-lg" title="Modo Manual">
                 <User size={10} className="text-slate-500" />
             </div>
         )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex justify-between items-start gap-2">
          <h3 className={`truncate text-[15px] font-black leading-tight tracking-tight ${active ? 'text-slate-900' : 'text-slate-700'}`}>
            {row.nombre}
          </h3>
          <span className={`text-[10px] whitespace-nowrap font-black uppercase tracking-widest ${active ? 'text-blue-600' : 'text-slate-400'}`}>
            {timeDisplay}
          </span>
        </div>

        <div className="flex flex-col gap-0.5 text-xs font-bold text-slate-500">
           <span className="font-mono truncate opacity-60 flex items-center gap-1.5">
             <Hash size={12} className="text-slate-300" /> {row.asignado_a}
           </span>
           {row.modelo && <span className="truncate opacity-50 text-[10px] uppercase font-black tracking-widest leading-none mt-1">• {row.modelo}</span>}
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          <span className="inline-flex px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-blue-50 text-blue-700 border-blue-100/50">
            WEB 1
          </span>
        </div>
      </div>

      <div className={`absolute right-3 top-1/2 -translate-y-1/2 flex gap-1.5 transition-all duration-300 ${active ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`}>
        <button 
           onClick={onOpenDialog} 
           className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-900 hover:text-white text-slate-400 rounded-xl shadow-xl transition-all active:scale-90" 
           title="Ficha del Cliente" 
           disabled={busy}
        >
          <Search size={14} />
        </button>
        <button 
           onClick={onToggleBot} 
           className={`w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-xl shadow-xl transition-all active:scale-90 ${
               botActive 
               ? 'hover:bg-red-50 hover:text-red-500' 
               : 'hover:bg-emerald-50 hover:text-emerald-600'
           }`} 
           title={botActive ? "Apagar Bot" : "Encender Bot"} 
           disabled={busy}
        >
          {botActive ? <User size={14} /> : <Bot size={14} />}
        </button>
      </div>
      
      {busy && (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] flex items-center justify-center rounded-3xl z-20">
           <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      )}
    </div>
  );
});

/** ================== Componente Principal ================== */
export const Web1ConversacionesPage: React.FC = () => {
  const [allRows, setAllRows] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState('');
  const deferredSearch = useDeferredValue(searchText);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [sortKey, setSortKey] = useState<SortKey>('created');
  const [page, setPage] = useState(1);

  const [selectedRow, setSelectedRow] = useState<ChatRow | null>(null);
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [savingRowId, setSavingRowId] = useState<number | null>(null);
  
  const listRef = useRef<HTMLDivElement | null>(null);

  // --- Carga de Datos ---
  const fetchList = useCallback(async (restoreScroll = false) => {
    const scrollTop = listRef.current?.scrollTop ?? 0;
    setLoading(true);
    setError(null);
    
    try {
      const data = await ClientService.getClients();
      const rawClients = Array.isArray(data) ? (data as unknown as ExtendedClient[]) : [];
      const rows = dedupeByAsignadoA(rawClients);
      setAllRows(rows);

      if (!selectedRow && rows.length > 0) {
        setSelectedRow(rows[0]);
      }
    } catch (e: any) {
      setError(e?.message || 'Error cargando conversaciones web1');
    } finally {
      setLoading(false);
      if (restoreScroll && listRef.current) {
        requestAnimationFrame(() => {
          if(listRef.current) listRef.current.scrollTop = scrollTop;
        });
      }
    }
  }, [selectedRow]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // --- Event Listeners ---
  useEffect(() => {
    const handleUpdate = (ev: Event) => {
      const detail = (ev as CustomEvent<Partial<ExtendedClient>>).detail;
      if (!detail?.row_number) return;

      setAllRows(prev => prev.map(r => {
        if (r.row_number !== detail.row_number) return r;
        
        return {
          ...r,
          nombre: detail.nombre !== undefined ? fmt(detail.nombre, r.nombre) : r.nombre,
          modelo: detail.modelo !== undefined ? (detail.modelo || null) : r.modelo,
          asignado_a: detail.asignado_a !== undefined ? (detail.asignado_a || r.asignado_a) : r.asignado_a,
          created: detail.created ? parseDateToTimestamp(detail.created) : r.created,
          last_msg: detail.last_msg ? parseDateToTimestamp(detail.last_msg) : r.last_msg,
          consentimiento_contacto: detail.consentimiento_contacto !== undefined 
            ? normalizeConsent(detail.consentimiento_contacto) 
            : r.consentimiento_contacto,
        };
      }));

      setSelectedRow(curr => {
        if (!curr) return null;
        if (curr.row_number === detail.row_number) {
            return {
                ...curr,
                ...detail,
                asignado_a: detail.asignado_a || curr.asignado_a,
                consentimiento_contacto: detail.consentimiento_contacto !== undefined 
                    ? normalizeConsent(detail.consentimiento_contacto) 
                    : curr.consentimiento_contacto
            } as ChatRow;
        }
        return curr;
      });
    };

    window.addEventListener('client:updated', handleUpdate as EventListener);
    return () => {
      window.removeEventListener('client:updated', handleUpdate as EventListener);
    };
  }, []);

  // --- Guardado ---
  const handleUpdateClient = useCallback(async (payload: Partial<Client>) => {
    if (!payload.row_number) return false;
    setSavingRowId(payload.row_number);

    const internalPayload: Partial<ChatRow> = {
        nombre: payload.nombre,
        modelo: payload.modelo || null,
        consentimiento_contacto: payload.consentimiento_contacto !== undefined 
            ? normalizeConsent(payload.consentimiento_contacto as any) 
            : undefined
    };

    Object.keys(internalPayload).forEach(key => {
        if ((internalPayload as any)[key] === undefined) delete (internalPayload as any)[key];
    });

    setAllRows(prev => prev.map(r => r.row_number === payload.row_number ? { ...r, ...internalPayload } as ChatRow : r));
    
    setSelectedRow(curr => {
        if (!curr) return null;
        return curr.row_number === payload.row_number ? { ...curr, ...internalPayload } as ChatRow : curr;
    });
    
    try {
      if (typeof (ClientService as any).updateClient === 'function') {
        await (ClientService as any).updateClient(payload);
      } else {
        await fetch('/api/clients/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      return true;
    } catch {
      fetchList(true); 
      return false;
    } finally {
      setSavingRowId(null);
    }
  }, [fetchList]);

  // --- Filtrado ---
  const filteredAndSorted = useMemo(() => {
    let result = allRows;
    if (deferredSearch.trim()) {
      const q = normalizeText(deferredSearch);
      result = result.filter(r => 
        normalizeText(r.nombre).includes(q) || 
        normalizeText(r.modelo).includes(q) || 
        normalizeText(r.asignado_a).includes(q) 
      );
    }
    result.sort((a, b) => {
      const valA = sortKey === 'last_msg' ? a.last_msg : a.created;
      const valB = sortKey === 'last_msg' ? b.last_msg : b.created;
      if (!valA && !valB) return 0;
      if (!valA) return 1; 
      if (!valB) return -1;
      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });
    return result;
  }, [allRows, deferredSearch, sortOrder, sortKey]);

  useEffect(() => { setPage(1); }, [deferredSearch, sortKey, sortOrder]);

  const displayRows = useMemo(() => filteredAndSorted.slice(0, page * PAGE_SIZE), [filteredAndSorted, page]);
  const hasMore = displayRows.length < filteredAndSorted.length;

  const toggleBot = async (row: ChatRow, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentOn = row.consentimiento_contacto !== false;
    if (currentOn) {
      const confirm = window.confirm(`¿Pausar el Bot para ${row.nombre}?`);
      if (!confirm) return;
    }
    await handleUpdateClient({ 
        row_number: row.row_number, 
        consentimiento_contacto: !currentOn 
    } as unknown as Partial<Client>);
  };

  const chatClient = useMemo(() => {
    if (!selectedRow) return null;
    const baseClient = rowToClient(selectedRow);
    return {
      ...baseClient,
      whatsapp: selectedRow.asignado_a, 
      real_whatsapp_display: '' 
    } as Client;
  }, [selectedRow]);

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col lg:flex-row overflow-hidden font-sans text-slate-900 relative">
      
      {/* AGENTE N8N INCRUSTADO (MODO CLARO) */}
      <N8nChatWidget />

      {/* Background Decorations */}
      <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-blue-600/5 blur-[100px] rounded-full pointer-events-none" />

      {/* SIDEBAR LIST */}
      <aside className="w-full lg:w-[420px] xl:w-[480px] flex flex-col border-r border-slate-200/50 bg-white/40 backdrop-blur-3xl z-10 h-full relative">
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col gap-5 bg-white/60 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xl">
                  <Globe size={20} />
               </div>
               <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Web 1</h2>
                  <div className="flex items-center gap-1.5">
                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{filteredAndSorted.length} Visitantes</span>
                  </div>
               </div>
            </div>
            
            <button 
              onClick={() => fetchList(true)} 
              disabled={loading} 
              className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-100 shadow-xl transition-all active:scale-95 disabled:opacity-50"
              title="Recargar"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <div className="wt-input-wrap !bg-white/80">
              <Search className="wt-input-icon !text-slate-400" />
              <input 
                  value={searchText} 
                  onChange={(e) => setSearchText(e.target.value)} 
                  placeholder="ID asignado o nombre..." 
                  className="bg-transparent border-transparent"
                  type="search"
              />
            </div>

            <div className="flex gap-2 pb-1 overflow-x-auto no-scrollbar">
              <button 
                 onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')} 
                 className="flex items-center gap-2 px-4 py-2 text-[11px] font-black uppercase tracking-wider bg-white border border-slate-200/60 rounded-xl hover:bg-slate-50 text-slate-600 shadow-sm transition-all"
              >
                <ArrowUpDown className="w-3 h-3 text-blue-500" /> {sortOrder === 'desc' ? 'Nuevos' : 'Viejos'}
              </button>
              
              <div className="relative shrink-0">
                   <select 
                      value={sortKey} 
                      onChange={(e) => setSortKey(e.target.value as SortKey)} 
                      className="appearance-none pl-3 pr-8 py-2 text-[11px] font-black uppercase tracking-wider bg-white border border-slate-200/60 rounded-xl hover:bg-slate-50 text-slate-600 cursor-pointer outline-none shadow-sm"
                   >
                      <option value="last_msg">Últ. Mensaje</option>
                      <option value="created">Creación</option>
                   </select>
                   <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar bg-slate-50/30">
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3 text-red-800 text-xs font-bold uppercase tracking-wider animate-in fade-in slide-in-from-top-2 mb-4">
              <AlertCircle size={20} className="shrink-0 text-red-500" />
              <p>{error}</p>
            </div>
          )}

          {loading && allRows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
              <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Buscando en Web 1...</span>
            </div>
          ) : displayRows.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-6 text-center px-10">
              <div className="w-20 h-20 bg-white rounded-[32px] shadow-xl flex items-center justify-center border border-slate-100">
                  <Globe size={32} className="text-slate-100 opacity-50" />
              </div>
              <div>
                  <p className="text-slate-900 font-black text-lg">No hay conversas</p>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">No se encontraron chats "web1".</p>
              </div>
            </div>
          ) : (
            <>
              {displayRows.map(row => (
                <RowItem
                  key={row.row_number}
                  row={row}
                  active={selectedRow?.row_number === row.row_number}
                  onClick={() => setSelectedRow(row)}
                  onOpenDialog={(e) => { e.stopPropagation(); setViewClient(rowToClient(row)); }}
                  onToggleBot={(e) => toggleBot(row, e)}
                  busy={savingRowId === row.row_number}
                  sortKey={sortKey}
                />
              ))}
              
              {hasMore && (
                <button 
                  onClick={() => setPage(p => p + 1)} 
                  className="w-full py-6 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 hover:bg-white rounded-3xl transition-all border border-transparent hover:border-blue-100 hover:shadow-xl mt-4"
                >
                  <MoreHorizontal className="w-4 h-4 mx-auto mb-1" /> Cargar más
                </button>
              )}
            </>
          )}
        </div>
      </aside>

      {/* CHAT MAIN AREA */}
      <main className="flex-1 flex flex-col min-w-0 bg-white relative">
        {!selectedRow ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-500">
             <div className="w-32 h-32 bg-slate-50 border border-white rounded-[40px] shadow-2xl flex items-center justify-center mb-10 relative group">
                <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-5 group-hover:opacity-10 transition-opacity" />
                <Globe className="w-12 h-12 text-blue-200 relative z-10" />
             </div>
             <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Visitantes Web 1</h3>
             <p className="text-slate-500 max-w-sm mx-auto font-bold text-sm leading-relaxed">
                Selecciona un visitante para ver su historial en vivo y gestionar la interacción.
             </p>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col bg-white animate-in fade-in zoom-in-[0.99] duration-300">
             {chatClient && <ChatPanel client={chatClient} source="web1" />}
          </div>
        )}
      </main>

      <ClientModal isOpen={!!viewClient} onClose={() => setViewClient(null)} client={viewClient} onUpdate={handleUpdateClient} />
    </div>
  );
};

export default Web1ConversacionesPage;