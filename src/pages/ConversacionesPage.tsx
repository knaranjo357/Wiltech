// src/pages/ConversacionesPage.tsx
import React, { useEffect, useMemo, useRef, useState, useDeferredValue, useCallback, memo } from 'react';
import { RefreshCw, Search, MessageSquare, ArrowUpDown, Bot, User, Filter, MoreHorizontal, AlertCircle } from 'lucide-react';
import { Client } from '../types/client';
import { ClientService } from '../services/clientService';
import { formatDate, formatWhatsApp } from '../utils/clientHelpers';
import { ChatPanel } from '../components/ChatPanel';
import { ClientModal } from '../components/ClientModal';

/** ================== Tipos y Normalización ================== */

// Definición del estado interno de la fila
type ChatRow = {
  row_number: number;
  nombre: string;
  whatsapp: string;
  modelo: string | null; // Nullable para compatibilidad con Client
  ciudad: string | null;
  source: string | null;
  created: number; // Timestamp
  last_msg: number; // Timestamp
  consentimiento_contacto: boolean | null;
  subscriber_id: number | null;
};

// Usamos Omit para evitar conflictos de herencia (ej: ciudad required vs optional)
interface ExtendedClient extends Omit<Client, 'created' | 'last_msg' | 'consentimiento_contacto' | 'modelo' | 'ciudad' | 'source'> {
  // Redefiniciones permisivas para lo que viene del backend
  modelo?: string | null;
  ciudad?: string | null;
  guia_ciudad?: string | null;
  source?: string | null;
  created?: string | number | Date | null;
  last_msg?: string | number | Date | null;
  consentimiento_contacto?: boolean | '' | null;
  subscriber_id?: number | null;
}

type SortOrder = 'asc' | 'desc';
type SortKey = 'created' | 'last_msg';

/** ================== Utilidades ================== */
const SOURCE_EMPTY = '__EMPTY__';
const PAGE_SIZE = 80;

const normalizeText = (v: unknown) =>
  String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const parseDateToTimestamp = (v: unknown): number => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  const str = String(v).trim();
  if (!str) return 0;
  
  const safeStr = str.includes(' ') && !str.includes('T') 
    ? str.replace(' ', 'T') 
    : str;

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

const labelSource = (s?: string | null) => (s && s.trim() ? s : 'Directo');

/** Deduplicación y conversión */
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
  // Castings necesarios para satisfacer la interfaz Client original
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
  
  const source = row.source || '';
  let sourceBadgeClass = 'bg-gray-100 text-gray-600 border-gray-200';
  if (normalizeText(source).includes('wiltech')) sourceBadgeClass = 'bg-blue-50 text-blue-700 border-blue-100';
  else if (source) sourceBadgeClass = 'bg-purple-50 text-purple-700 border-purple-100';

  const botActive = row.consentimiento_contacto !== false; 

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className={`group relative w-full p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer flex items-start gap-3 ${
        active 
          ? 'bg-indigo-50/60 border-indigo-200 shadow-sm ring-1 ring-indigo-100' 
          : 'bg-white border-transparent hover:border-gray-200 hover:bg-gray-50/80 hover:shadow-sm'
      }`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold border shadow-sm transition-colors ${
        active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 group-hover:border-indigo-200 group-hover:text-indigo-600'
      }`}>
        {(row.nombre || '?').charAt(0).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex justify-between items-start">
          <h3 className={`truncate text-sm font-bold ${active ? 'text-indigo-900' : 'text-gray-800'}`}>
            {row.nombre}
          </h3>
          <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2 font-medium">
            {timeDisplay}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
           <span className="font-mono truncate opacity-80">{formatWhatsApp(row.whatsapp)}</span>
           {row.modelo && <span className="truncate hidden sm:inline">• {row.modelo}</span>}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium border ${sourceBadgeClass}`}>
            {labelSource(source)}
          </span>
          
          <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border ${botActive ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
             {botActive ? <Bot size={10} /> : <User size={10} />}
             <span>{botActive ? 'Bot' : 'Manual'}</span>
          </div>
        </div>
      </div>

      <div className="absolute right-2 bottom-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur rounded-lg p-0.5 shadow-sm border border-gray-100">
        <button onClick={onOpenDialog} className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-md transition-colors" title="Ver detalles" disabled={busy}>
          <MessageSquare size={14} />
        </button>
        <button onClick={onToggleBot} className={`p-1.5 rounded-md transition-colors ${botActive ? 'hover:bg-red-50 text-red-500' : 'hover:bg-emerald-50 text-emerald-600'}`} title={botActive ? "Apagar Bot" : "Encender Bot"} disabled={busy}>
          {botActive ? <User size={14} /> : <Bot size={14} />}
        </button>
      </div>
      
      {busy && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center rounded-2xl z-10">
           <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
        </div>
      )}
    </div>
  );
});

/** ================== Componente Principal ================== */
export const ConversacionesPage: React.FC = () => {
  const [allRows, setAllRows] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros y Orden
  const [searchText, setSearchText] = useState('');
  const deferredSearch = useDeferredValue(searchText);
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [sortKey, setSortKey] = useState<SortKey>('created');

  // Paginación
  const [page, setPage] = useState(1);

  // Selección
  const [selectedRow, setSelectedRow] = useState<ChatRow | null>(null);
  
  // UI Modals
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
      // Casting seguro aquí porque ExtendedClient es permisivo
      const rawClients = Array.isArray(data) ? (data as unknown as ExtendedClient[]) : [];
      const rows = dedupeByWhatsapp(rawClients);
      setAllRows(rows);

      if (!selectedRow && rows.length > 0) {
        setSelectedRow(rows[0]);
      }
    } catch (e: any) {
      setError(e?.message || 'Error cargando conversaciones');
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

  // --- Event Listeners (Update en tiempo real) ---
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
          consentimiento_contacto: detail.consentimiento_contacto !== undefined 
            ? normalizeConsent(detail.consentimiento_contacto) 
            : r.consentimiento_contacto,
          subscriber_id: detail.subscriber_id ? Number(detail.subscriber_id) : r.subscriber_id,
        };
      }));

      setSelectedRow(curr => {
        // FIX: Verificar null antes de acceder
        if (!curr) return null;
        
        if (curr.row_number === detail.row_number) {
            return {
                ...curr,
                ...detail,
                modelo: detail.modelo || curr.modelo,
                ciudad: detail.ciudad || curr.ciudad,
                source: detail.source || curr.source,
                consentimiento_contacto: detail.consentimiento_contacto !== undefined 
                    ? normalizeConsent(detail.consentimiento_contacto) 
                    : curr.consentimiento_contacto
            } as ChatRow;
        }
        return curr;
      });
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'crm:client-updated' && e.newValue) fetchList(true);
    };

    window.addEventListener('client:updated', handleUpdate as EventListener);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('client:updated', handleUpdate as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, [fetchList]);

  // --- Guardado (FIX: Acepta Partial<Client> para satisfacer ClientModal) ---
  const handleUpdateClient = useCallback(async (payload: Partial<Client>) => {
    if (!payload.row_number) return false;
    setSavingRowId(payload.row_number);

    // Convertimos el payload de Client a lo que espera nuestro ChatRow (Extended)
    // Se usa 'as any' para propiedades que sabemos que existen pero TS se queja por ser Optional vs Null
    const internalPayload: Partial<ChatRow> = {
        nombre: payload.nombre,
        modelo: payload.modelo || null,
        ciudad: payload.ciudad || null,
        source: payload.source || null,
        // Si viene 'created' como string, no lo actualizamos aquí para simplificar (o lo parseamos)
        consentimiento_contacto: payload.consentimiento_contacto !== undefined 
            ? normalizeConsent(payload.consentimiento_contacto as any) 
            : undefined
    };

    // Limpiar undefineds
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

  // --- Filtrado y Ordenamiento ---
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

      // Mover items sin fecha al final siempre
      if (!valA && !valB) return 0;
      if (!valA) return 1; 
      if (!valB) return -1;

      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });

    return { filteredAndSorted: result, sourceStats: { total: allRows.length, items: stats } };
  }, [allRows, deferredSearch, sourceFilter, sortOrder, sortKey]);

  // Reset page
  useEffect(() => { setPage(1); }, [deferredSearch, sourceFilter, sortKey, sortOrder]);

  const displayRows = useMemo(() => filteredAndSorted.slice(0, page * PAGE_SIZE), [filteredAndSorted, page]);
  const hasMore = displayRows.length < filteredAndSorted.length;

  const toggleBot = async (row: ChatRow, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentOn = row.consentimiento_contacto !== false;
    if (currentOn) {
      const confirm = window.confirm(`¿Pausar el Bot para ${row.nombre}?`);
      if (!confirm) return;
    }
    // Casting necesario para cumplir con Partial<Client>
    await handleUpdateClient({ 
        row_number: row.row_number, 
        consentimiento_contacto: !currentOn 
    } as unknown as Partial<Client>);
  };

  return (
    <div className="h-[100dvh] bg-gray-50/50 flex flex-col lg:flex-row overflow-hidden">
      
      <aside className="w-full lg:w-[400px] xl:w-[450px] flex flex-col border-r border-gray-200 bg-white z-10 shadow-xl lg:shadow-none h-full">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-col gap-3 bg-white/80 backdrop-blur-sm z-20">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              Chats <span className="text-xs font-normal bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{filteredAndSorted.length}</span>
            </h2>
            <button onClick={() => fetchList(true)} disabled={loading} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors disabled:opacity-50" title="Recargar">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
            <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Buscar..." className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" />
          </div>

          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            <div className="relative min-w-[120px]">
              <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="w-full appearance-none pl-2 pr-6 py-1.5 text-xs bg-white border border-gray-200 rounded-lg hover:border-gray-300 cursor-pointer text-gray-600 outline-none">
                <option value="">Todos</option>
                {sourceStats.items.map(s => <option key={s.value} value={s.value}>{s.label} ({s.count})</option>)}
              </select>
              <Filter className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
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
              <span className="text-xs">Sincronizando...</span>
            </div>
          ) : displayRows.length === 0 ? (
            <div className="py-10 flex flex-col items-center text-gray-400 gap-2 text-center px-4">
              <Search className="w-8 h-8 opacity-20" />
              <span className="text-sm">No se encontraron resultados.</span>
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
                <button onClick={() => setPage(p => p + 1)} className="w-full py-3 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors flex items-center justify-center gap-2">
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
                <MessageSquare className="w-8 h-8 text-indigo-200" />
             </div>
             <h3 className="text-gray-700 font-medium mb-1">Selecciona una conversación</h3>
             <p className="text-sm max-w-xs mx-auto">Elige un contacto para ver el historial.</p>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col bg-white lg:rounded-l-3xl shadow-2xl lg:shadow-none overflow-hidden border-l border-gray-200/50">
             <ChatPanel client={rowToClient(selectedRow)} source={selectedRow.source || ''} />
          </div>
        )}
      </main>

      <ClientModal isOpen={!!viewClient} onClose={() => setViewClient(null)} client={viewClient} onUpdate={handleUpdateClient} />
    </div>
  );
};

export default ConversacionesPage;