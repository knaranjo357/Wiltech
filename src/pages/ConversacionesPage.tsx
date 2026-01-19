// src/pages/ConversacionesPage.tsx
import React, { useEffect, useMemo, useRef, useState, useDeferredValue, useCallback, memo } from 'react';
import { 
    RefreshCw, Search, MessageSquare, ArrowUpDown, Bot, User, Filter, 
    MoreHorizontal, AlertCircle, Radio, Clock, Zap 
} from 'lucide-react';
import { Client } from '../types/client';
import { ClientService } from '../services/clientService';
import { formatDate, formatWhatsApp } from '../utils/clientHelpers';
import { ChatPanel } from '../components/ChatPanel';
import { ClientModal } from '../components/ClientModal';

/** ================== Tipos y Normalización ================== */

type ChatRow = {
  row_number: number;
  nombre: string;
  whatsapp: string;
  modelo: string | null; 
  ciudad: string | null;
  source: string | null;
  created: number; 
  last_msg: number; 
  // Siempre boolean: true = ENCENDIDO (default), false = APAGADO
  consentimiento_contacto: boolean; 
  subscriber_id: number | null;
};

interface ExtendedClient extends Omit<Client, 'created' | 'last_msg' | 'consentimiento_contacto' | 'modelo' | 'ciudad' | 'source'> {
  modelo?: string | null;
  ciudad?: string | null;
  guia_ciudad?: string | null;
  source?: string | null;
  created?: string | number | Date | null;
  last_msg?: string | number | Date | null;
  consentimiento_contacto?: boolean | string | number | null;
  subscriber_id?: number | null;
}

type SortOrder = 'asc' | 'desc';
type SortKey = 'created' | 'last_msg';

/** ================== Utilidades ================== */
const SOURCE_EMPTY = '__EMPTY__';
const PAGE_SIZE = 80;
const POLLING_INTERVAL = 15000;

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

// === LÓGICA DE NORMALIZACIÓN DEL BOT ===
// Si es false o "false" -> APAGADO.
// Cualquier otra cosa (null, undefined, "", true, "true") -> ENCENDIDO.
const normalizeConsent = (val: any): boolean => {
  if (val === false) return false;
  if (typeof val === 'string' && val.toLowerCase() === 'false') return false;
  return true; 
};

const fmt = (v: unknown, placeholder = ''): string => {
  const s = (v ?? '').toString().trim();
  return (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') ? placeholder : s;
};

const labelSource = (s?: string | null) => (s && s.trim() ? s : 'Directo');

function dedupeByWhatsapp(clients: ExtendedClient[]): ChatRow[] {
  const map = new Map<string, ChatRow>();
  
  for (const c of clients) {
    const wa = String(c.whatsapp || '').trim();
    if (!wa || !c.row_number) continue;

    const createdTs = parseDateToTimestamp(c.created);
    const lastMsgTs = parseDateToTimestamp(c.last_msg);

    const candidate: ChatRow = {
      row_number: c.row_number,
      nombre: fmt(c.nombre, 'Sin nombre'),
      whatsapp: wa,
      modelo: c.modelo || null,
      ciudad: c.ciudad || c.guia_ciudad || null,
      source: c.source || null,
      created: createdTs,
      last_msg: lastMsgTs,
      // Aplicamos la lógica: null/vacío -> true
      consentimiento_contacto: normalizeConsent(c.consentimiento_contacto),
      subscriber_id: c.subscriber_id ? Number(c.subscriber_id) : null,
    };

    const current = map.get(wa);
    if (!current || candidate.created > current.created) {
      map.set(wa, candidate);
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
  consentimiento_contacto: r.consentimiento_contacto,
} as unknown as Client);

function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  useEffect(() => { savedCallback.current = callback; }, [callback]);
  useEffect(() => {
    if (delay !== null) {
      const id = setInterval(() => savedCallback.current(), delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

/** ================== Componente de Fila Memoizado ================== */
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
  
  const source = row.source || '';
  let sourceBadgeClass = 'bg-slate-100 text-slate-500 border-slate-200';
  if (normalizeText(source).includes('wiltech')) sourceBadgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-100';
  else if (source) sourceBadgeClass = 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100';

  // Como ya normalizamos antes, true es explícitamente encendido
  const botActive = row.consentimiento_contacto === true; 

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className={`group relative w-full p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex items-start gap-3.5 select-none
        ${active 
          ? 'bg-white border-indigo-500 shadow-md shadow-indigo-100 scale-[1.01] z-10' 
          : 'bg-white border-transparent hover:bg-white hover:border-gray-200 hover:shadow-sm'
        }
      `}
    >
      <div className="relative shrink-0">
         <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold border shadow-sm transition-colors ${
            active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-500 border-gray-100 group-hover:bg-indigo-50 group-hover:text-indigo-600'
         }`}>
            {(row.nombre || '?').charAt(0).toUpperCase()}
         </div>
         {botActive && (
             <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center">
                 <Zap size={8} className="text-white fill-white" />
             </div>
         )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex justify-between items-start gap-2">
          <h3 className={`truncate text-sm font-bold leading-tight ${active ? 'text-indigo-950' : 'text-gray-800'}`}>
            {row.nombre}
          </h3>
          <span className={`text-[10px] whitespace-nowrap font-medium ${active ? 'text-indigo-400' : 'text-gray-400'}`}>
            {timeDisplay}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-500">
           <span className="font-mono truncate opacity-70 tracking-tight">{formatWhatsApp(row.whatsapp)}</span>
           {row.modelo && <span className="truncate hidden sm:inline text-gray-400">• {row.modelo}</span>}
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider border ${sourceBadgeClass}`}>
            {labelSource(source)}
          </span>
        </div>
      </div>

      <div className={`absolute right-3 bottom-3 flex gap-1 transition-all duration-200 ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <button 
           onClick={onOpenDialog} 
           className="p-1.5 bg-white border border-gray-200 hover:bg-indigo-50 hover:border-indigo-200 text-gray-400 hover:text-indigo-600 rounded-lg shadow-sm transition-colors" 
           title="Ver ficha completa" 
           disabled={busy}
        >
          <MessageSquare size={14} />
        </button>
        <button 
           onClick={onToggleBot} 
           className={`p-1.5 bg-white border border-gray-200 rounded-lg shadow-sm transition-colors ${
               botActive 
               ? 'hover:bg-red-50 hover:border-red-200 text-emerald-500 hover:text-red-500' 
               : 'hover:bg-emerald-50 hover:border-emerald-200 text-gray-400 hover:text-emerald-600'
           }`} 
           title={botActive ? "Apagar Bot" : "Encender Bot"} 
           disabled={busy}
        >
          {botActive ? <Bot size={14} /> : <User size={14} />}
        </button>
      </div>
      
      {busy && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex items-center justify-center rounded-2xl z-20">
           <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
        </div>
      )}
    </div>
  );
}, (prev, next) => {
    return prev.active === next.active && 
           prev.busy === next.busy && 
           prev.sortKey === next.sortKey &&
           prev.row === next.row;
});

/** ================== Página Principal ================== */
export const ConversacionesPage: React.FC = () => {
  const [allRows, setAllRows] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBackgroundUpdating, setIsBackgroundUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState('');
  const deferredSearch = useDeferredValue(searchText);
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [sortKey, setSortKey] = useState<SortKey>('last_msg');
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<ChatRow | null>(null);
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [savingRowId, setSavingRowId] = useState<number | null>(null);
  
  const listRef = useRef<HTMLDivElement | null>(null);

  const fetchList = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setIsBackgroundUpdating(true);
    
    const scrollTop = listRef.current?.scrollTop ?? 0;

    try {
      const data = await ClientService.getClients();
      const rawClients = Array.isArray(data) ? (data as unknown as ExtendedClient[]) : [];
      const rows = dedupeByWhatsapp(rawClients);
      
      setAllRows(currentRows => {
         if (JSON.stringify(currentRows) === JSON.stringify(rows)) return currentRows;
         return rows;
      });

      if (!selectedRow && !isSilent && rows.length > 0) {
        setSelectedRow(rows[0]);
      }
      
      setError(null);
    } catch (e: any) {
      if (!isSilent) setError(e?.message || 'Error cargando conversaciones');
    } finally {
      setLoading(false);
      setIsBackgroundUpdating(false);
      
      if (isSilent && listRef.current) {
         requestAnimationFrame(() => {
            if(listRef.current && Math.abs(listRef.current.scrollTop - scrollTop) < 50) {
                listRef.current.scrollTop = scrollTop;
            }
         });
      }
    }
  }, [selectedRow]);

  useEffect(() => { fetchList(false); }, []);

  useInterval(() => {
     if (!viewClient && !document.hidden && !savingRowId) {
        fetchList(true);
     }
  }, POLLING_INTERVAL);

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
          ciudad: detail.ciudad ?? detail.guia_ciudad !== undefined ? (detail.ciudad || detail.guia_ciudad || null) : r.ciudad,
          source: detail.source !== undefined ? (detail.source || null) : r.source,
          created: detail.created ? parseDateToTimestamp(detail.created) : r.created,
          last_msg: detail.last_msg ? parseDateToTimestamp(detail.last_msg) : r.last_msg,
          // Normalización en tiempo real
          consentimiento_contacto: detail.consentimiento_contacto !== undefined 
            ? normalizeConsent(detail.consentimiento_contacto) 
            : r.consentimiento_contacto,
          subscriber_id: detail.subscriber_id ? Number(detail.subscriber_id) : r.subscriber_id,
        };
      }));

      setSelectedRow(curr => {
        if (!curr || curr.row_number !== detail.row_number) return curr;
        return { ...curr, ...detail } as unknown as ChatRow;
      });
    };

    window.addEventListener('client:updated', handleUpdate as EventListener);
    return () => window.removeEventListener('client:updated', handleUpdate as EventListener);
  }, []);

  const handleUpdateClient = useCallback(async (payload: Partial<Client>) => {
    if (!payload.row_number) return false;
    setSavingRowId(payload.row_number);

    // Normalización antes de actualizar el estado local
    const internalPayload: Partial<ChatRow> = {
        nombre: payload.nombre,
        modelo: payload.modelo || null,
        ciudad: payload.ciudad || null,
        source: payload.source || null,
        consentimiento_contacto: payload.consentimiento_contacto !== undefined 
            ? normalizeConsent(payload.consentimiento_contacto as any) 
            : undefined
    };

    Object.keys(internalPayload).forEach(key => {
        if ((internalPayload as any)[key] === undefined) delete (internalPayload as any)[key];
    });

    setAllRows(prev => prev.map(r => r.row_number === payload.row_number ? { ...r, ...internalPayload } as ChatRow : r));
    setSelectedRow(curr => curr?.row_number === payload.row_number ? { ...curr, ...internalPayload } as ChatRow : curr);
    
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

  const { filteredAndSorted, sourceStats } = useMemo(() => {
    const statsMap = new Map<string, number>();
    allRows.forEach(r => {
      const key = (r.source || '').trim() || SOURCE_EMPTY;
      statsMap.set(key, (statsMap.get(key) || 0) + 1);
    });
    
    const stats = Array.from(statsMap.entries())
      .map(([value, count]) => ({ value, label: labelSource(value === SOURCE_EMPTY ? '' : value), count }))
      .sort((a, b) => b.count - a.count);

    let result = allRows;

    if (sourceFilter) {
      result = result.filter(r => ((r.source || '').trim() || SOURCE_EMPTY) === sourceFilter);
    }

    if (deferredSearch.trim()) {
      const q = normalizeText(deferredSearch);
      result = result.filter(r => 
        normalizeText(r.nombre).includes(q) || 
        normalizeText(r.modelo).includes(q) || 
        normalizeText(r.ciudad).includes(q) || 
        r.whatsapp.includes(q)
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

    return { filteredAndSorted: result, sourceStats: { total: allRows.length, items: stats } };
  }, [allRows, deferredSearch, sourceFilter, sortOrder, sortKey]);

  useEffect(() => { setPage(1); }, [deferredSearch, sourceFilter, sortKey, sortOrder]);

  const displayRows = useMemo(() => filteredAndSorted.slice(0, page * PAGE_SIZE), [filteredAndSorted, page]);
  const hasMore = displayRows.length < filteredAndSorted.length;

  const toggleBot = async (row: ChatRow, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Si no es false explícito, es true.
    const currentOn = row.consentimiento_contacto === true;
    
    if (currentOn && !window.confirm(`¿Pausar el Bot para ${row.nombre}?`)) return;

    await handleUpdateClient({ 
        row_number: row.row_number, 
        consentimiento_contacto: !currentOn 
    } as unknown as Partial<Client>);
  };

  return (
    <div className="h-[100dvh] bg-gray-50 flex flex-col lg:flex-row overflow-hidden font-sans text-gray-900">
      <aside className="w-full lg:w-[400px] xl:w-[450px] flex flex-col border-r border-gray-200 bg-[#F8F9FC] z-10 shadow-xl lg:shadow-none h-full relative">
        <div className="px-5 py-4 flex flex-col gap-4 bg-white/80 backdrop-blur-md z-20 sticky top-0 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2.5 tracking-tight">
              <MessageSquare className="w-6 h-6 text-indigo-600" />
              Conversaciones 
              <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full border border-indigo-100">
                  {filteredAndSorted.length}
              </span>
            </h2>
            <div className="flex items-center gap-2">
                {isBackgroundUpdating && (
                   <span className="text-[10px] font-medium text-gray-400 animate-pulse flex items-center gap-1">
                      <Radio className="w-3 h-3" /> LIVE
                   </span>
                )}
                <button 
                  onClick={() => fetchList(false)} 
                  disabled={loading} 
                  className={`p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-all active:scale-95 ${loading ? 'opacity-50' : ''}`} 
                  title="Sincronizar ahora"
                >
                  <RefreshCw className={`w-5 h-5 ${loading || isBackgroundUpdating ? 'animate-spin' : ''}`} />
                </button>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
            </div>
            <input 
                value={searchText} 
                onChange={(e) => setSearchText(e.target.value)} 
                placeholder="Buscar por nombre, wpp, modelo..." 
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm placeholder:text-gray-400" 
            />
          </div>

          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            <div className="relative min-w-[130px] shrink-0">
              <select 
                  value={sourceFilter} 
                  onChange={(e) => setSourceFilter(e.target.value)} 
                  className="w-full appearance-none pl-3 pr-8 py-2 text-xs font-medium bg-white border border-gray-200 rounded-xl hover:border-gray-300 cursor-pointer text-gray-600 outline-none transition-colors shadow-sm"
              >
                <option value="">Todas las fuentes</option>
                {sourceStats.items.map(s => <option key={s.value} value={s.value}>{s.label} ({s.count})</option>)}
              </select>
              <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
            
            <button 
               onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')} 
               className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 whitespace-nowrap shadow-sm transition-all active:scale-95"
            >
              <ArrowUpDown className="w-3 h-3" /> {sortOrder === 'desc' ? 'Recientes' : 'Antiguos'}
            </button>
            
            <div className="relative shrink-0">
                 <select 
                    value={sortKey} 
                    onChange={(e) => setSortKey(e.target.value as SortKey)} 
                    className="appearance-none pl-8 pr-3 py-2 text-xs font-medium bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 cursor-pointer outline-none shadow-sm"
                 >
                    <option value="last_msg">Por Mensaje</option>
                    <option value="created">Por Creación</option>
                 </select>
                 <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#F8F9FC] scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300">
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3 text-red-800 text-sm animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          {loading && allRows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-300" />
              <span className="text-xs font-medium uppercase tracking-widest opacity-60">Sincronizando...</span>
            </div>
          ) : displayRows.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-gray-400 gap-4 text-center px-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                  <Search className="w-8 h-8 text-gray-300" />
              </div>
              <div>
                  <p className="text-gray-900 font-semibold">Sin resultados</p>
                  <p className="text-xs mt-1">Intenta ajustar los filtros de búsqueda.</p>
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
                  className="w-full py-4 text-xs font-bold text-indigo-600 hover:bg-indigo-50/50 rounded-2xl transition-all flex items-center justify-center gap-2 mt-2 opacity-80 hover:opacity-100"
                >
                  <MoreHorizontal className="w-4 h-4" /> Cargar más contactos
                </button>
              )}
              
              <div className="h-8"></div>
            </>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-white relative z-0">
        {!selectedRow ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/30 p-8 text-center animate-in fade-in duration-500">
             <div className="w-24 h-24 bg-gradient-to-br from-indigo-50 to-white border border-indigo-50 rounded-[2rem] shadow-sm flex items-center justify-center mb-6">
                <MessageSquare className="w-10 h-10 text-indigo-300" />
             </div>
             <h3 className="text-gray-900 font-bold text-lg mb-2">Selecciona una conversación</h3>
             <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
                Elige un contacto del listado para visualizar el historial de mensajes, gestionar el bot y más.
             </p>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col bg-white shadow-2xl lg:shadow-none animate-in fade-in zoom-in-[0.99] duration-200">
             <ChatPanel key={selectedRow.row_number} client={rowToClient(selectedRow)} source={selectedRow.source || ''} />
          </div>
        )}
      </main>

      <ClientModal isOpen={!!viewClient} onClose={() => setViewClient(null)} client={viewClient} onUpdate={handleUpdateClient} />
    </div>
  );
};

export default ConversacionesPage;