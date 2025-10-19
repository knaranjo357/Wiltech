import React, { useEffect, useMemo, useRef, useState, useDeferredValue } from 'react';
import { RefreshCw, Search, MessageSquare, Clock, ArrowUpDown } from 'lucide-react';
import { Client } from '../types/client';
import { ClientService } from '../services/clientService';
import { formatDate, formatWhatsApp } from '../utils/clientHelpers';
import { ChatPanel } from '../components/ChatPanel';

/** ================== Utilidades ================== */
const canon = (v: unknown) =>
  String(v ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

const parseDateSafe = (v: unknown): number => {
  if (!v) return 0;
  const raw = String(v).trim();
  if (!raw) return 0;
  const iso =
    raw.includes(' ') && !raw.includes('T')
      ? raw.replace(' ', 'T') + (raw.length === 16 ? ':00' : '')
      : raw;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? 0 : time;
};

const fmt = (v: unknown, placeholder = ''): string => {
  const s = (v ?? '').toString().trim();
  if (!s) return placeholder;
  const lower = s.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return placeholder;
  return s;
};

type SortOrder = 'asc' | 'desc';

type ChatRow = {
  row_number?: number;
  nombre: string;
  whatsapp: string;
  modelo?: string;
  ciudad?: string;
  source?: string | null;
  created: string | number | Date | null;
};

/** Dedup por whatsapp => conservar el más reciente por created */
function dedupeByWhatsapp(clients: Client[]): ChatRow[] {
  const map = new Map<string, ChatRow>();
  for (const c of clients) {
    const wa = String(c.whatsapp || '').trim();
    if (!wa) continue;
    const current = map.get(wa);
    const created = c.created ?? null;
    const candidate: ChatRow = {
      row_number: c.row_number,
      nombre: fmt(c.nombre, 'Sin nombre'),
      whatsapp: wa,
      modelo: fmt(c.modelo, ''),
      ciudad: fmt((c as any).ciudad ?? (c as any).guia_ciudad ?? '', ''),
      source: (c as any).source ?? null,
      created,
    };
    if (!current || parseDateSafe(candidate.created) > parseDateSafe(current.created)) {
      map.set(wa, candidate);
    }
  }
  return Array.from(map.values());
}

/** ================== Página ================== */
const DEFAULT_PAGE_SIZE = 80;

export const ConversacionesPage: React.FC = () => {
  const [all, setAll] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // búsqueda / filtros / orden
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const [sourceFilter, setSourceFilter] = useState<string>(''); // '', 'Wiltech', 'WiltechBga'
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc'); // SOLO fecha asc/desc

  // paginación
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1); // 1-based

  // selección
  const [selected, setSelected] = useState<ChatRow | null>(null);
  const [selectedSource, setSelectedSource] = useState<string>('');

  const listRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef(0);

  const fetchList = async () => {
    try {
      // preservar la posición actual del scroll de la lista
      lastScrollTopRef.current = listRef.current?.scrollTop ?? 0;

      setLoading(true);
      setError(null);
      const data = await ClientService.getClients();
      const rows = dedupeByWhatsapp(Array.isArray(data) ? (data as Client[]) : []);
      setAll(rows);

      // selección inicial: más reciente
      const first =
        [...rows].sort((a, b) => parseDateSafe(b.created) - parseDateSafe(a.created))[0] ?? null;
      setSelected(first || null);
      setSelectedSource(first?.source || '');
      setPage(1);
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar las conversaciones');
    } finally {
      setLoading(false);
      // restaurar scroll de la lista tras el render
      requestAnimationFrame(() => {
        if (listRef.current) listRef.current.scrollTop = lastScrollTopRef.current;
      });
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  /** Escuchar actualizaciones externas */
  useEffect(() => {
    const onExternalUpdate = (ev: Event) => {
      const detail = (ev as CustomEvent<Partial<Client>>).detail;
      if (!detail || !('row_number' in detail)) return;

      setAll(prev => {
        const idx = prev.findIndex(r => r.row_number === detail.row_number);
        if (idx === -1) return prev;
        const prevRow = prev[idx];
        const nextRow: ChatRow = {
          ...prevRow,
          nombre: detail.nombre !== undefined ? fmt(detail.nombre, prevRow.nombre) : prevRow.nombre,
          modelo: detail.modelo !== undefined ? fmt(detail.modelo, prevRow.modelo) : prevRow.modelo,
          ciudad: (detail as any).ciudad ?? (detail as any).guia_ciudad ?? prevRow.ciudad,
          source: (detail as any).source ?? prevRow.source,
          created: (detail as any).created ?? prevRow.created,
        };
        const copy = [...prev];
        copy[idx] = nextRow;
        return copy;
      });

      setSelected(prevSel => {
        if (!prevSel || prevSel.row_number !== detail.row_number) return prevSel;
        return {
          ...prevSel,
          nombre: detail.nombre !== undefined ? fmt(detail.nombre, prevSel.nombre) : prevSel.nombre,
          modelo: detail.modelo !== undefined ? fmt(detail.modelo, prevSel.modelo) : prevSel.modelo,
          ciudad: (detail as any).ciudad ?? (detail as any).guia_ciudad ?? prevSel.ciudad,
          source: (detail as any).source ?? prevSel.source,
          created: (detail as any).created ?? prevSel.created,
        };
      });
    };

    window.addEventListener('client:updated', onExternalUpdate as any);

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'crm:client-updated' && e.newValue) fetchList();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('client:updated', onExternalUpdate as any);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  /** Filtros + búsqueda */
  const filtered = useMemo(() => {
    let rows = [...all];

    if (sourceFilter) {
      rows = rows.filter(r => (r.source || '') === sourceFilter);
    }

    if (dq.trim()) {
      const s = canon(dq);
      rows = rows.filter(r => {
        const name = canon(r.nombre);
        const model = canon(r.modelo ?? '');
        const city = canon(r.ciudad ?? '');
        const phone = String(r.whatsapp || '').replace('@s.whatsapp.net', '');
        return name.includes(s) || model.includes(s) || city.includes(s) || phone.includes(s);
      });
    }

    return rows;
  }, [all, dq, sourceFilter]);

  /** Orden SOLO por fecha */
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const da = parseDateSafe(a.created);
      const db = parseDateSafe(b.created);
      // desc => más recientes primero
      return sortOrder === 'desc' ? db - da : da - db;
    });
  }, [filtered, sortOrder]);

  /** Reset de paginación en cambios */
  useEffect(() => {
    setPage(1);
  }, [dq, sourceFilter, sortOrder, all.length]);

  /** Paginación real (slice) */
  const total = sorted.length;
  const showing = Math.min(page * pageSize, total);
  const paged = useMemo(() => sorted.slice(0, showing), [sorted, showing]);

  /** Conteos por tag */
  const counts = useMemo(() => {
    let wil = 0;
    let bga = 0;
    for (const r of all) {
      if (r.source === 'Wiltech') wil++;
      else if (r.source === 'WiltechBga') bga++;
    }
    return { all: all.length, wiltech: wil, wiltechBga: bga };
  }, [all]);

  /** Seleccionar conversación */
  const onPick = (row: ChatRow) => {
    setSelected(row);
    setSelectedSource(row.source || '');
    // no tocamos el scroll general; solo se actualiza el panel derecho
  };

  /** Botón de orden (fecha) */
  const SortByDateButton: React.FC = () => (
    <button
      onClick={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 bg-white"
      title="Cambiar orden por fecha"
    >
      <ArrowUpDown className="w-4 h-4" />
      <span className="inline-flex items-center gap-1 text-xs">
        Fecha {sortOrder === 'desc' ? '↓' : '↑'}
      </span>
    </button>
  );

  /** Chip/tag */
  const Chip: React.FC<{ active?: boolean; onClick: () => void; children: React.ReactNode }> = ({
    active,
    onClick,
    children,
  }) => (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs border transition ${
        active
          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
          : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
      }`}
    >
      {children}
    </button>
  );

  /** Item de lista */
  const RowItem: React.FC<{ row: ChatRow; active: boolean; onClick: () => void }> = ({
    row,
    active,
    onClick,
  }) => {
    const createdHuman = row.created ? formatDate(String(row.created)) : '—';
    const source = row.source || '';
    const sourceColor =
      source === 'WiltechBga'
        ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200'
        : source === 'Wiltech'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-slate-50 text-slate-700 border-slate-200';

    return (
      <button
        onClick={onClick}
        className={`w-full text-left p-3 rounded-xl border transition flex items-start gap-3 ${
          active ? 'bg-white border-indigo-200 shadow-sm' : 'bg-white/70 hover:bg-white border-gray-200'
        }`}
        title="Abrir conversación"
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold">
          {row.nombre?.trim()?.[0]?.toUpperCase() || 'C'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-gray-900">{row.nombre || 'Sin nombre'}</p>
            {source && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${sourceColor}`}>
                {source}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-gray-600 flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="font-mono">{formatWhatsApp(row.whatsapp)}</span>
          </div>
          <div className="mt-1 text-xs text-gray-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>{createdHuman}</span>
            {row.modelo && <span className="ml-2 truncate">• {row.modelo}</span>}
          </div>
        </div>
      </button>
    );
  };

  return (
    // Altura pantalla completa + sin scroll chaining en el contenedor raíz
    <div className="h-[100dvh] grid grid-cols-1 lg:grid-cols-12 gap-4 overscroll-none">
      {/* Columna izquierda: lista de chats (scroll independiente) */}
      <aside className="lg:col-span-5 xl:col-span-4 min-h-0">
        <div className="h-full overflow-hidden bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-white/40 flex flex-col">
          {/* Header lista */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-2 shrink-0">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Conversaciones</h2>
              <p className="text-sm text-gray-500">
                Mostrando {Math.min(showing, total)} de {total} chat{total !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                title="Tamaño de página"
              >
                {[40, 80, 120, 200].map((n) => (
                  <option key={n} value={n}>
                    {n}/página
                  </option>
                ))}
              </select>
              <button
                onClick={fetchList}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.99] transition"
                aria-label="Recargar lista"
                disabled={loading}
                title="Recargar lista"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="text-sm">Recargar</span>
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="p-3 border-b border-gray-100 flex flex-col gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por nombre, teléfono, ciudad o modelo…"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Orden únicamente por fecha asc/desc */}
              <SortByDateButton />
            </div>

            {/* Tags Wiltech / WiltechBga */}
            <div className="flex items-center gap-2 flex-wrap">
              <Chip active={sourceFilter === ''} onClick={() => setSourceFilter('')}>
                Todos ({counts.all})
              </Chip>
              <Chip active={sourceFilter === 'Wiltech'} onClick={() => setSourceFilter('Wiltech')}>
                Wiltech ({counts.wiltech})
              </Chip>
              <Chip
                active={sourceFilter === 'WiltechBga'}
                onClick={() => setSourceFilter('WiltechBga')}
              >
                WiltechBga ({counts.wiltechBga})
              </Chip>
            </div>
          </div>

          {/* Lista scrollable: SOLO renderiza `paged` */}
          <div
            ref={listRef}
            className="p-3 overflow-y-auto min-h-0 flex-1 space-y-2 overscroll-contain"
            style={{ background: '#F7F7FB' }}
            aria-busy={loading ? 'true' : 'false'}
          >
            {loading && (
              <div className="flex items-center justify-center py-8 text-gray-600">
                <div className="w-8 h-8 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin mr-3" />
                Cargando conversaciones…
              </div>
            )}

            {!loading && error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {error}
              </div>
            )}

            {!loading && !error && paged.length === 0 && (
              <div className="p-3 bg-white border border-gray-200 rounded-xl text-gray-600 text-sm">
                No hay conversaciones para mostrar.
              </div>
            )}

            {!loading &&
              !error &&
              paged.map((row) => (
                <RowItem
                  key={`${row.whatsapp}-${row.row_number ?? ''}`}
                  row={row}
                  active={selected?.whatsapp === row.whatsapp}
                  onClick={() => onPick(row)}
                />
              ))}

            {/* Paginador */}
            {!loading && !error && showing < total && (
              <div className="pt-2 flex flex-col items-center gap-2">
                <button
                  onClick={() => setPage((p) => p + 1)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                >
                  Cargar más
                </button>
                <div className="text-[11px] text-gray-500">
                  {showing}/{total}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Columna derecha: conversación (scroll independiente en ChatPanel) */}
      <main className="lg:col-span-7 xl:col-span-8 min-h-0">
        <div className="h-full overflow-hidden bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-white/40 flex flex-col">
          {!selected ? (
            <div className="flex-1 grid place-items-center p-6 overscroll-contain" style={{ background: '#F6F7FB' }}>
              <div className="text-center text-gray-600">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-70" />
                <p className="text-sm">Selecciona un chat en la izquierda para ver la conversación.</p>
              </div>
            </div>
          ) : (
            // ChatPanel maneja su scroll interno (mensajes) y el composer abajo.
            <div className="h-full w-full flex flex-col min-h-0">
              <div className="flex-1 min-h-0">
                <ChatPanel
                  client={{
                    nombre: selected.nombre,
                    whatsapp: selected.whatsapp,
                    modelo: selected.modelo,
                    ciudad: selected.ciudad as any,
                    row_number: selected.row_number as any,
                  } as Client}
                  source={selectedSource}
                  onSourceChange={setSelectedSource}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ConversacionesPage;
