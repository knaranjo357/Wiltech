// src/pages/ConversacionesPage.tsx
import React, { useEffect, useMemo, useRef, useState, useDeferredValue } from 'react';
import { RefreshCw, Search, MessageSquare, Clock, ArrowUpDown, Bot, User } from 'lucide-react';
import { Client } from '../types/client';
import { ClientService } from '../services/clientService';
import { formatDate, formatWhatsApp } from '../utils/clientHelpers';
import { ChatPanel } from '../components/ChatPanel';
import { ClientModal } from '../components/ClientModal';

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

const toNumOrNull = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// === Helpers para manejo de source dinámico ===
const SOURCE_EMPTY = '__EMPTY__';
const labelSource = (s?: string | null) => {
  const str = (s ?? '').toString().trim();
  return str ? str : '(sin source)';
};

/** ================== Tipos ================== */
type SortOrder = 'asc' | 'desc';
type SortKey = 'created' | 'last_msg';

type ChatRow = {
  row_number?: number;
  nombre: string;
  whatsapp: string;
  modelo?: string;
  ciudad?: string;
  source?: string | null;
  created: string | number | Date | null;
  /** Última vez que el usuario nos escribió (puede venir null) */
  last_msg?: string | number | Date | null;
  /** Flag usado en el proyecto para encender/apagar el bot */
  consentimiento_contacto?: boolean | '' | null;
  /** 🔑 NECESARIO para ChatPanel */
  subscriber_id?: number | null;
};

/** Dedup por whatsapp => conservar el más reciente por created */
function dedupeByWhatsapp(clients: Client[]): ChatRow[] {
  const map = new Map<string, ChatRow>();
  for (const c of clients) {
    const wa = String(c.whatsapp || '').trim();
    if (!wa) continue;
    const current = map.get(wa);
    const candidate: ChatRow = {
      row_number: c.row_number,
      nombre: fmt(c.nombre, 'Sin nombre'),
      whatsapp: wa,
      modelo: fmt((c as any).modelo, ''),
      ciudad: fmt((c as any).ciudad ?? (c as any).guia_ciudad ?? '', ''),
      source: (c as any).source ?? null,
      created: (c as any).created ?? null,
      last_msg: (c as any).last_msg ?? null,
      consentimiento_contacto: (c as any).consentimiento_contacto ?? null,
      // ⬇️ transportar el subscriber_id que viene del backend (como número)
      subscriber_id: toNumOrNull((c as any).subscriber_id),
    };
    if (!current || parseDateSafe(candidate.created) > parseDateSafe(current.created)) {
      map.set(wa, candidate);
    }
  }
  return Array.from(map.values());
}

/** Helper: convertir ChatRow -> Client mínimo */
const rowToClient = (r: ChatRow): Client =>
  ({
    row_number: r.row_number as number,
    nombre: r.nombre,
    whatsapp: r.whatsapp,
    modelo: r.modelo,
    ciudad: r.ciudad,
    created: r.created as any,
    source: r.source as any,
    consentimiento_contacto: (r.consentimiento_contacto ?? null) as any,
    // ⬇️ pasar el subscriber_id hacia el ChatPanel
    subscriber_id: (r.subscriber_id ?? null) as any,
  } as unknown as Client);

/** ================== Página ================== */
const DEFAULT_PAGE_SIZE = 80;

export const ConversacionesPage: React.FC = () => {
  const [all, setAll] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // búsqueda / filtros / orden
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const [sourceFilter, setSourceFilter] = useState<string>(''); // '', SOURCE_EMPTY o el valor del source
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc'); // asc/desc
  const [sortKey, setSortKey] = useState<SortKey>('created'); // created | last_msg

  // paginación
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1); // 1-based

  // selección (panel derecho)
  const [selected, setSelected] = useState<ChatRow | null>(null);
  const [selectedSource, setSelectedSource] = useState<string>('');

  // diálogo de chat (ClientModal)
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [savingRow, setSavingRow] = useState<number | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef(0);

  const fetchList = async () => {
    try {
      lastScrollTopRef.current = listRef.current?.scrollTop ?? 0;

      setLoading(true);
      setError(null);
      const data = await ClientService.getClients();
      const rows = dedupeByWhatsapp(Array.isArray(data) ? (data as Client[]) : []);
      setAll(rows);

      // selección inicial: más reciente por created (se mantiene)
      const first =
        [...rows].sort((a, b) => parseDateSafe(b.created) - parseDateSafe(a.created))[0] ?? null;
      setSelected(first || null);
      setSelectedSource(first?.source || '');
      setPage(1);
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar las conversaciones');
    } finally {
      setLoading(false);
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
          modelo: (detail as any).modelo ?? prevRow.modelo,
          ciudad: (detail as any).ciudad ?? (detail as any).guia_ciudad ?? prevRow.ciudad,
          source: (detail as any).source ?? prevRow.source,
          created: (detail as any).created ?? prevRow.created,
          last_msg: (detail as any).last_msg ?? prevRow.last_msg,
          consentimiento_contacto:
            (detail as any).consentimiento_contacto !== undefined
              ? (detail as any).consentimiento_contacto
              : prevRow.consentimiento_contacto,
          // ⬇️ actualizar si llegó subscriber_id del evento
          subscriber_id:
            (detail as any).subscriber_id !== undefined
              ? toNumOrNull((detail as any).subscriber_id)
              : prevRow.subscriber_id ?? null,
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
          modelo: (detail as any).modelo ?? prevSel.modelo,
          ciudad: (detail as any).ciudad ?? (detail as any).guia_ciudad ?? prevSel.ciudad,
          source: (detail as any).source ?? prevSel.source,
          created: (detail as any).created ?? prevSel.created,
          last_msg: (detail as any).last_msg ?? prevSel.last_msg,
          consentimiento_contacto:
            (detail as any).consentimiento_contacto !== undefined
              ? (detail as any).consentimiento_contacto
              : prevSel.consentimiento_contacto,
          subscriber_id:
            (detail as any).subscriber_id !== undefined
              ? toNumOrNull((detail as any).subscriber_id)
              : prevSel.subscriber_id ?? null,
        };
      });

      setViewClient(v =>
        v && detail && v.row_number === detail.row_number
          ? ({ ...v, ...detail } as Client)
          : v
      );
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

  /** Guardado desde el diálogo / toggles (optimista + rollback) */
  const onUpdate = async (payload: Partial<Client>): Promise<boolean> => {
    if (!payload.row_number) return false;

    setSavingRow(payload.row_number);
    const prevAll = all;
    const prevSelected = selected;
    const prevModal = viewClient;

    // Optimista en lista:
    setAll(prev =>
      prev.map(r =>
        r.row_number === payload.row_number
          ? ({
              ...r,
              ...payload,
              nombre: payload.nombre ?? r.nombre,
              modelo: (payload as any).modelo ?? r.modelo,
              ciudad: (payload as any).ciudad ?? r.ciudad,
              source: (payload as any).source ?? r.source,
              created: (payload as any).created ?? r.created,
              last_msg: (payload as any).last_msg ?? r.last_msg,
              consentimiento_contacto:
                (payload as any).consentimiento_contacto !== undefined
                  ? (payload as any).consentimiento_contacto
                  : r.consentimiento_contacto,
              subscriber_id:
                (payload as any).subscriber_id !== undefined
                  ? toNumOrNull((payload as any).subscriber_id)
                  : r.subscriber_id ?? null,
            } as ChatRow)
          : r
      )
    );
    // Optimista en seleccionado:
    setSelected(s =>
      s && s.row_number === payload.row_number
        ? ({
            ...s,
            ...payload,
            nombre: payload.nombre ?? s.nombre,
            modelo: (payload as any).modelo ?? s.modelo,
            ciudad: (payload as any).ciudad ?? s.ciudad,
            source: (payload as any).source ?? s.source,
            created: (payload as any).created ?? s.created,
            last_msg: (payload as any).last_msg ?? s.last_msg,
            consentimiento_contacto:
              (payload as any).consentimiento_contacto !== undefined
                ? (payload as any).consentimiento_contacto
                : s.consentimiento_contacto,
            subscriber_id:
              (payload as any).subscriber_id !== undefined
                ? toNumOrNull((payload as any).subscriber_id)
                : s.subscriber_id ?? null,
          } as ChatRow)
        : s
    );
    // Optimista en diálogo:
    setViewClient(v => (v && v.row_number === payload.row_number ? ({ ...v, ...payload } as Client) : v));

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
    } catch (e) {
      // rollback
      setAll(prevAll);
      setSelected(prevSelected);
      setViewClient(prevModal);
      setError('No se pudo guardar los cambios');
      return false;
    } finally {
      setSavingRow(null);
    }
  };

  /** Estadísticas dinámicas de sources */
  const sourceStats = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    for (const r of all) {
      const raw = (r.source ?? '').toString().trim();
      const key = raw ? raw : SOURCE_EMPTY;
      const label = key === SOURCE_EMPTY ? '(sin source)' : key;
      const prev = map.get(key);
      map.set(key, { label, count: (prev?.count ?? 0) + 1 });
    }
    const items = Array.from(map.entries())
      .map(([value, v]) => ({ value, ...v }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    return { total: all.length, items };
  }, [all]);

  /** Filtros + búsqueda */
  const filtered = useMemo(() => {
    let rows = [...all];

    if (sourceFilter) {
      rows = rows.filter(r => {
        const raw = (r.source ?? '').toString().trim();
        const key = raw ? raw : SOURCE_EMPTY;
        return key === sourceFilter;
      });
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

  /** Orden por clave seleccionada (created | last_msg) */
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const da = parseDateSafe(sortKey === 'last_msg' ? a.last_msg : a.created);
      const db = parseDateSafe(sortKey === 'last_msg' ? b.last_msg : b.created);
      return sortOrder === 'desc' ? db - da : da - db;
    });
  }, [filtered, sortOrder, sortKey]);

  /** Reset de paginación en cambios */
  useEffect(() => {
    setPage(1);
  }, [dq, sourceFilter, sortOrder, sortKey, all.length]);

  /** Paginación real (slice) */
  const total = sorted.length;
  const showing = Math.min(page * pageSize, total);
  const paged = useMemo(() => sorted.slice(0, showing), [sorted, showing]);

  /** Seleccionar conversación (panel derecho) */
  const onPick = (row: ChatRow) => {
    setSelected(row);
    setSelectedSource(row.source || '');
  };

  /** Abrir diálogo de chat (no llamamos “modal” en la UI) */
  const openChatDialog = (row: ChatRow, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setViewClient(rowToClient(row));
  };

  /** Toggle Bot ON/OFF usando la misma semántica que tu ListView */
  const toggleBot = async (row: ChatRow, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const botOn =
      row.consentimiento_contacto === true ||
      row.consentimiento_contacto === '' ||
      row.consentimiento_contacto === null;

    const newValue = botOn ? false : true;

    if (botOn) {
      const ok = window.confirm(
        '¿Desea apagar el bot para este contacto?\n' +
          'El asistente dejará de escribir automáticamente por WhatsApp.\n' +
          'Podrá volver a activarlo cuando quiera.'
      );
      if (!ok) return;
    }

    if (!row.row_number) return;
    await onUpdate({ row_number: row.row_number, consentimiento_contacto: newValue } as Partial<Client>);
  };

  /** Botón de orden (asc/desc) */
  const SortOrderButton: React.FC = () => (
    <button
      onClick={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 bg-white"
      title="Cambiar orden asc/desc"
    >
      <ArrowUpDown className="w-4 h-4" />
      <span className="inline-flex items-center gap-1 text-xs">
        {sortOrder === 'desc' ? 'Desc' : 'Asc'}
      </span>
    </button>
  );

  /** Item de lista con botones "Chat" y Toggle Bot a la derecha */
  const RowItem: React.FC<{
    row: ChatRow;
    active: boolean;
    onClick: () => void;
    onOpenDialog: (e?: React.MouseEvent) => void;
    onToggleBot: (e?: React.MouseEvent) => void;
    busy?: boolean;
    sortKey: SortKey;
  }> = ({ row, active, onClick, onOpenDialog, onToggleBot, busy, sortKey }) => {
    const timeRaw = sortKey === 'last_msg' ? row.last_msg : row.created;
    const createdHuman = timeRaw ? formatDate(String(timeRaw)) : '—';
    const source = row.source || '';
    const sourceColor =
      source === 'WiltechBga'
        ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200'
        : source === 'Wiltech'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-slate-50 text-slate-700 border-slate-200';

    const botOn =
      row.consentimiento_contacto === true ||
      row.consentimiento_contacto === '' ||
      row.consentimiento_contacto === null;

    return (
      <div
        onClick={onClick}
        role="button"
        tabIndex={0}
        className={`w-full p-3 rounded-xl border transition flex items-start gap-3 ${
          active ? 'bg-white border-indigo-200 shadow-sm' : 'bg-white/70 hover:bg-white border-gray-200'
        }`}
        title={`Ordenado por: ${sortKey === 'last_msg' ? 'Último mensaje' : 'Fecha de creación'}`}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold">
          {row.nombre?.trim()?.[0]?.toUpperCase() || 'C'}
        </div>

        {/* Contenido principal */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-gray-900">{row.nombre || 'Sin nombre'}</p>
            {/* Siempre mostrar una chapita, incluso si no hay source */}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${sourceColor}`}>
              {labelSource(source)}
            </span>
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

        {/* Acciones a la derecha */}
        <div className="shrink-0 flex flex-col sm:flex-row gap-2">
          {/* Abrir Info */}
          <button
            onClick={onOpenDialog}
            title="Abrir Info"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs disabled:opacity-50"
            aria-label="Abrir Info"
            disabled={busy}
          >
            <MessageSquare className="w-4 h-4" />
            Info
          </button>

          {/* Toggle Bot ON/OFF con iconos usuario/robot */}
          <button
            onClick={onToggleBot}
            title={botOn ? 'Desactivar bot' : 'Activar bot'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs disabled:opacity-50 ${
              botOn
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
            aria-label={botOn ? 'Bot encendido' : 'Bot apagado'}
            disabled={busy}
          >
            {botOn ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
            {botOn ? 'Bot' : 'Humano'}
          </button>
        </div>
      </div>
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

              {/* Orden: clave + dirección */}
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                title="Ordenar por"
              >
                <option value="created">Creación</option>
                <option value="last_msg">Último mensaje</option>
              </select>
              <SortOrderButton />
            </div>

            {/* Filtro por canal/source: lista desplegable dinámica */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                title="Filtrar por canal (source)"
              >
                <option value="">{`Todos (${sourceStats.total})`}</option>
                {sourceStats.items.map((it) => (
                  <option key={it.value} value={it.value}>
                    {`${it.label} (${it.count})`}
                  </option>
                ))}
              </select>

              {sourceFilter && (
                <button
                  onClick={() => setSourceFilter('')}
                  className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                  title="Quitar filtro"
                >
                  Quitar filtro
                </button>
              )}
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
                  onOpenDialog={(e) => openChatDialog(row, e)}
                  onToggleBot={(e) => toggleBot(row, e)}
                  busy={savingRow === row.row_number}
                  sortKey={sortKey}
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
            <div className="h-full w-full flex flex-col min-h-0">
              <div className="flex-1 min-h-0">
                <ChatPanel
                  client={rowToClient(selected)}
                  source={selectedSource}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Diálogo de cliente (con Chat y demás) */}
      <ClientModal
        isOpen={!!viewClient}
        onClose={() => setViewClient(null)}
        client={viewClient}
        onUpdate={onUpdate}
      />
    </div>
  );
};

export default ConversacionesPage;
