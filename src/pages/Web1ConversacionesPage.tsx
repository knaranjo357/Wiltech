// src/pages/Web1ConversacionesPage.tsx
import React, { useEffect, useMemo, useRef, useState, useDeferredValue, useCallback, memo } from 'react';
import { RefreshCw, Search, MessageSquare, ArrowUpDown, Bot, User, MoreHorizontal, AlertCircle, Hash, Globe } from 'lucide-react';
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
        showWelcomeScreen: true,
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
          --chat--window--width: 400px;
          --chat--window--height: 600px;
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
      className={`group relative w-full p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer flex items-start gap-3 ${
        active 
          ? 'bg-blue-50/60 border-blue-200 shadow-sm ring-1 ring-blue-100' 
          : 'bg-white border-transparent hover:border-gray-200 hover:bg-gray-50/80 hover:shadow-sm'
      }`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold border shadow-sm transition-colors ${
        active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 group-hover:border-blue-200 group-hover:text-blue-600'
      }`}>
        <Globe size={16} />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex justify-between items-start">
          <h3 className={`truncate text-sm font-bold ${active ? 'text-blue-900' : 'text-gray-800'}`}>
            {row.nombre}
          </h3>
          <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2 font-medium">
            {timeDisplay}
          </span>
        </div>

        <div className="flex flex-col gap-0.5 text-xs text-gray-500">
           <span className="font-mono truncate text-gray-600 flex items-center gap-1 font-medium">
             <Hash size={10} className="text-gray-400" /> {row.asignado_a}
           </span>
           {row.modelo && <span className="truncate opacity-80">• {row.modelo}</span>}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium border bg-blue-50 text-blue-700 border-blue-100">
            WEB 1
          </span>
          
          <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border ${botActive ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
             {botActive ? <Bot size={10} /> : <User size={10} />}
             <span>{botActive ? 'Bot' : 'Manual'}</span>
          </div>
        </div>
      </div>

      <div className="absolute right-2 bottom-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur rounded-lg p-0.5 shadow-sm border border-gray-100">
        <button onClick={onOpenDialog} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-md transition-colors" title="Ver detalles" disabled={busy}>
          <MessageSquare size={14} />
        </button>
        <button onClick={onToggleBot} className={`p-1.5 rounded-md transition-colors ${botActive ? 'hover:bg-red-50 text-red-500' : 'hover:bg-emerald-50 text-emerald-600'}`} title={botActive ? "Apagar Bot" : "Encender Bot"} disabled={busy}>
          {botActive ? <User size={14} /> : <Bot size={14} />}
        </button>
      </div>
      
      {busy && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center rounded-2xl z-10">
           <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
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
    <div className="h-[100dvh] bg-gray-50/50 flex flex-col lg:flex-row overflow-hidden relative">
      
      {/* AGENTE N8N INCRUSTADO (MODO CLARO) */}
      <N8nChatWidget />

      <aside className="w-full lg:w-[400px] xl:w-[450px] flex flex-col border-r border-gray-200 bg-white z-10 shadow-xl lg:shadow-none h-full">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-col gap-3 bg-white/80 backdrop-blur-sm z-20">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-600" />
              Chats Web 1 <span className="text-xs font-normal bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{filteredAndSorted.length}</span>
            </h2>
            <button onClick={() => fetchList(true)} disabled={loading} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors disabled:opacity-50" title="Recargar">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Buscar por ID asignado..." className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
          </div>

          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            <button onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')} className="flex items-center gap-1 px-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 whitespace-nowrap">
              <ArrowUpDown className="w-3 h-3" /> {sortOrder === 'desc' ? 'Recientes' : 'Antiguos'}
            </button>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="appearance-none px-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 cursor-pointer outline-none">
              <option value="created">Creado</option>
              <option value="last_msg">Mensaje</option>
            </select>
          </div>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50/50 scrollbar-thin scrollbar-thumb-gray-200">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-3 text-red-800 text-sm mb-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {loading && allRows.length === 0 ? (
            <div className="py-10 flex flex-col items-center text-gray-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span className="text-xs">Buscando en Web 1...</span>
            </div>
          ) : displayRows.length === 0 ? (
            <div className="py-10 flex flex-col items-center text-gray-400 gap-2 text-center px-4">
              <Search className="w-8 h-8 opacity-20" />
              <span className="text-sm">No se encontraron chats con source="web1".</span>
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
                <button onClick={() => setPage(p => p + 1)} className="w-full py-3 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-xl transition-colors flex items-center justify-center gap-2">
                  <MoreHorizontal className="w-4 h-4" /> Cargar más
                </button>
              )}
            </>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-[#F3F4F6] relative">
        {!selectedRow ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 p-6 text-center">
             <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mb-4">
                <Globe className="w-8 h-8 text-blue-200" />
             </div>
             <h3 className="text-gray-700 font-medium mb-1">Web 1 Conversaciones</h3>
             <p className="text-sm max-w-xs mx-auto">Selecciona un visitante para ver su historial usando el ID asignado.</p>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col bg-white lg:rounded-l-3xl shadow-2xl lg:shadow-none overflow-hidden border-l border-gray-200/50">
             {chatClient && <ChatPanel client={chatClient} source="web1" />}
          </div>
        )}
      </main>

      <ClientModal isOpen={!!viewClient} onClose={() => setViewClient(null)} client={viewClient} onUpdate={handleUpdateClient} />
    </div>
  );
};

export default Web1ConversacionesPage;