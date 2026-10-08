import { RepairLoader } from '../components/RepairLoader';
import { countryFetch } from '../services/countryRequest';
import { Pagination } from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
// src/pages/Web1ConversacionesPage.tsx
import React, { useEffect, useMemo, useRef, useState, useDeferredValue, useCallback, memo } from 'react';
import { RefreshCw, Search, ArrowUpDown, Bot, User, AlertCircle, Hash, Globe, Zap } from 'lucide-react';
import { Client } from '../types/client';
import { ClientService } from '../services/clientService';
import { ConversationDataService } from '../services/conversationDataService';
import { formatDate } from '../utils/clientHelpers';
import { ChatPanel } from '../components/ChatPanel';
import { ClientModal } from '../components/ClientModal';
import { dedupeByAsignadoA, fmt, normalizeConsent, normalizeText, parseDateToTimestamp, type ChatRow, type ExtendedClient } from '../utils/webConversationRows';

/** ================== Tipos y Normalización ================== */

type SortOrder = 'asc' | 'desc';
type SortKey = 'created' | 'last_msg';

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
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      className={`group relative w-full p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex items-start gap-3 select-none
        ${active 
          ? 'bg-slate-950 border-slate-950 shadow-lg z-10'
          : 'bg-white border-transparent hover:border-slate-200 hover:shadow-sm'
        }
      `}
    >
      <div className="relative shrink-0">
         <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black border transition-all duration-200 ${
            active ? 'bg-white text-slate-950 border-white' : 'bg-slate-50 text-slate-500 border-slate-100 group-hover:text-black'
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

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex justify-between items-start gap-2">
          <h3 className={`truncate text-sm font-extrabold leading-tight tracking-tight ${active ? 'text-white' : 'text-slate-800'}`}>
            {row.nombre}
          </h3>
          <span className={`text-[9px] whitespace-nowrap font-black uppercase tracking-wider ${active ? 'text-slate-300' : 'text-slate-400'}`}>
            {timeDisplay}
          </span>
        </div>

        <div className={`flex flex-col gap-0.5 text-[11px] font-bold ${active ? 'text-slate-300' : 'text-slate-500'}`}>
           <span className="font-mono truncate opacity-60 flex items-center gap-1.5">
             <Hash size={12} className="text-slate-300" /> {row.asignado_a}
           </span>
           {row.modelo && <span className="truncate opacity-50 text-[10px] uppercase font-black tracking-widest leading-none mt-1">• {row.modelo}</span>}
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          <span className={`inline-flex px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border ${active ? 'bg-white/10 text-white border-white/10' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
            WEB
          </span>
        </div>
      </div>

      <div className={`absolute right-2.5 bottom-2.5 flex gap-1 transition-all duration-200 ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <button 
           onClick={onOpenDialog} 
           className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 rounded-lg transition-all active:scale-90" 
           title="Ficha del Cliente" 
           disabled={busy}
        >
          <Search size={14} />
        </button>
        <button 
           onClick={onToggleBot} 
           className={`w-7 h-7 flex items-center justify-center bg-white border border-slate-200 rounded-lg transition-all active:scale-90 ${
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
        <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] flex items-center justify-center rounded-2xl z-20">
           <RepairLoader variant="icon" />
        </div>
      )}
    </div>
  );
});

/** ================== Componente Principal ================== */
export const Web1ConversacionesPage: React.FC<{ onOpenConversations?: () => void }> = ({ onOpenConversations }) => {
  const [allRows, setAllRows] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState('');
  const deferredSearch = useDeferredValue(searchText);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [sortKey, setSortKey] = useState<SortKey>('created');

  const [selectedRow, setSelectedRow] = useState<ChatRow | null>(null);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [savingRowId, setSavingRowId] = useState<number | null>(null);
  
  const listRef = useRef<HTMLDivElement | null>(null);
  const fetchingRef = useRef(false);
  const lastFetchRef = useRef(0);

  // --- Carga de Datos ---
  const fetchList = useCallback(async (restoreScroll = false, force = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    const scrollTop = listRef.current?.scrollTop ?? 0;
    setLoading(true);
    setError(null);
    
    try {
      const data = await ConversationDataService.getClients({ force });
      const rawClients = Array.isArray(data) ? (data as unknown as ExtendedClient[]) : [];
      const rows = dedupeByAsignadoA(rawClients);
      setAllRows(rows);
      setSelectedRow(current => rows.find(row => row.row_number === current?.row_number) ?? rows[0] ?? null);
      lastFetchRef.current = Date.now();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando conversaciones web1');
    } finally {
      fetchingRef.current = false;
      setLoading(false);
      if (restoreScroll && listRef.current) {
        requestAnimationFrame(() => {
          if(listRef.current) listRef.current.scrollTop = scrollTop;
        });
      }
    }
  }, []);

  useEffect(() => { void fetchList(false, true); }, [fetchList]);

  useEffect(() => {
    const refreshIfStale = () => {
      if (document.visibilityState === 'visible' && !viewClient && !savingRowId && Date.now() - lastFetchRef.current >= 30_000) {
        void fetchList(true, true);
      }
    };
    const interval = window.setInterval(refreshIfStale, 30_000);
    window.addEventListener('focus', refreshIfStale);
    document.addEventListener('visibilitychange', refreshIfStale);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshIfStale);
      document.removeEventListener('visibilitychange', refreshIfStale);
    };
  }, [fetchList, savingRowId, viewClient]);

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
        nombre: payload.nombre ?? undefined,
        modelo: payload.modelo || null,
        consentimiento_contacto: payload.consentimiento_contacto !== undefined 
            ? normalizeConsent(payload.consentimiento_contacto)
            : undefined
    };

    (Object.keys(internalPayload) as Array<keyof ChatRow>).forEach(key => {
        if (internalPayload[key] === undefined) delete internalPayload[key];
    });

    setAllRows(prev => prev.map(r => r.row_number === payload.row_number ? { ...r, ...internalPayload } as ChatRow : r));
    
    setSelectedRow(curr => {
        if (!curr) return null;
        return curr.row_number === payload.row_number ? { ...curr, ...internalPayload } as ChatRow : curr;
    });
    
    try {
      if (typeof ClientService.updateClient === 'function') {
        await ClientService.updateClient(payload);
      } else {
        await countryFetch('/api/clients/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      ConversationDataService.patchClient();
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
    let result = [...allRows];
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


  const pagination = usePagination(filteredAndSorted, JSON.stringify([deferredSearch, sortKey, sortOrder]));
  const displayRows = pagination.items;

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
    return rowToClient(selectedRow);
  }, [selectedRow]);

  return (
    <div className="h-[calc(100dvh-4rem)] md:h-[100dvh] bg-slate-50 flex flex-col lg:flex-row overflow-hidden font-sans text-slate-900 relative">
      
      {/* Background Decorations */}

      {/* SIDEBAR LIST */}
      <aside className={`w-full lg:w-[350px] xl:w-[380px] shrink-0 flex-col border-r border-slate-200 bg-white z-10 h-full relative ${mobileChatOpen ? 'hidden lg:flex' : 'flex'}`}>
        <div className="px-4 py-3.5 border-b border-slate-100 flex flex-col gap-3 bg-white/95 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center shadow-sm">
                  <Globe size={18} />
               </div>
               <div>
                  <h1 className="wt-page-title !text-lg">Web</h1>
                  <div className="flex items-center gap-1.5">
                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{filteredAndSorted.length} Visitantes</span>
                  </div>
               </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenConversations}
                className="h-9 px-3 rounded-xl bg-slate-950 text-white hover:bg-slate-800 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
              >
                Chats
              </button>
              <button 
                onClick={() => fetchList(true, true)} 
                disabled={loading} 
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-950 hover:border-slate-300 transition-all active:scale-95 disabled:opacity-50"
                title="Recargar"
              >
                {loading ? <RepairLoader variant="icon" /> : <RefreshCw size={18} />}
              </button>
            </div>
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

            <div className="flex gap-2 overflow-x-auto no-scrollbar">
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

        <div ref={listRef} className="flex-1 overflow-y-auto p-2.5 space-y-1 custom-scrollbar bg-slate-50/50">
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3 text-red-800 text-xs font-bold uppercase tracking-wider animate-in fade-in slide-in-from-top-2 mb-4">
              <AlertCircle size={20} className="shrink-0 text-red-500" />
              <p>{error}</p>
            </div>
          )}

          {loading && allRows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
              <RepairLoader variant="icon" className="repair-loader--large" />
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
                  onClick={() => { setSelectedRow(row); setMobileChatOpen(true); }}
                  onOpenDialog={(e) => { e.stopPropagation(); setViewClient(rowToClient(row)); }}
                  onToggleBot={(e) => toggleBot(row, e)}
                  busy={savingRowId === row.row_number}
                  sortKey={sortKey}
                />
              ))}
              
              <Pagination {...pagination} />
            </>
          )}
        </div>
      </aside>

      {/* CHAT MAIN AREA */}
      <main className={`flex-1 flex-col min-w-0 min-h-0 bg-white relative ${mobileChatOpen ? 'flex' : 'hidden lg:flex'}`}>
        {!selectedRow ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-500">
             <div className="w-32 h-32 bg-slate-50 border border-white rounded-[40px] shadow-2xl flex items-center justify-center mb-10 relative group">
                <div className="absolute inset-0 bg-black blur-3xl opacity-5 group-hover:opacity-10 transition-opacity" />
                <Globe className="w-12 h-12 text-blue-200 relative z-10" />
             </div>
             <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Visitantes Web 1</h3>
             <p className="text-slate-500 max-w-sm mx-auto font-bold text-sm leading-relaxed">
                Selecciona un visitante para ver su historial en vivo y gestionar la interacción.
             </p>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col bg-white animate-in fade-in zoom-in-[0.99] duration-300">
             {chatClient && <ChatPanel key={`${chatClient.row_number}:${chatClient.whatsapp}`} client={chatClient} source="web1" onBack={() => setMobileChatOpen(false)} />}
          </div>
        )}
      </main>

      <ClientModal isOpen={!!viewClient} onClose={() => setViewClient(null)} client={viewClient} onUpdate={handleUpdateClient} />
    </div>
  );
};

export default Web1ConversacionesPage;
