// src/pages/Resultados.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, X, Phone, Clock, BarChart2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Brush,
  Legend,
} from 'recharts';

import { ClientService } from '../services/clientService';
import { Client } from '../types/client';
import { ClientModal } from '../components/ClientModal';
import { formatWhatsApp, getEtapaColor, getCategoriaColor } from '../utils/clientHelpers';

/** ================== Utils ================== */
type Granularity = 'day' | 'week' | 'month';

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const startOfWeekMonday = (d: Date) => {
  const x = startOfDay(d);
  const day = x.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // días desde lunes
  x.setDate(x.getDate() - diff);
  return x;
};
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

const bucketStart = (d: Date, g: Granularity) =>
  g === 'day' ? startOfDay(d) : g === 'week' ? startOfWeekMonday(d) : startOfMonth(d);

const formatBucketLabel = (d: Date, g: Granularity) => {
  if (g === 'day') return d.toLocaleDateString('es-CO', { month: 'short', day: '2-digit' });
  if (g === 'week') return `Sem ${toYMD(d)}`; // lunes de la semana
  return d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
};

/** ================== Parsers de fechas ================== */
const parseAgendaDate = (raw?: string | null): Date | null => {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();

  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return new Date(iso);

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const [, y, mo, d, hh, mm, ss] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), ss ? Number(ss) : 0);
    }

  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d), 0, 0, 0);
  }

  if (s.includes(' ')) {
    const tryAlt = Date.parse(s.replace(' ', 'T'));
    if (!Number.isNaN(tryAlt)) return new Date(tryAlt);
  }
  return null;
};

// created (timestamptz +0) -> ajustar a -5 (Bogotá)
const parseCreatedToBogota = (raw?: string | null): Date | null => {
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return null;
  // raw viene en UTC (+0). Bogotá es -05:00 y no tiene DST.
  return new Date(ms - 5 * 60 * 60 * 1000);
};

const sameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const displayAgendaDate = (s?: string | null) => {
  const d = parseAgendaDate(s);
  if (!d) return 'Fecha inválida';
  return `${d.toLocaleDateString('es-CO', {
    weekday: 'short', year: 'numeric', month: 'short', day: '2-digit',
  })} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const displayCreatedDate = (s?: string | null) => {
  const d = parseCreatedToBogota(s);
  if (!d) return 'Fecha inválida';
  return `${d.toLocaleDateString('es-CO', {
    weekday: 'short', year: 'numeric', month: 'short', day: '2-digit',
  })} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** ================== Normalizadores ================== */
const normalize = (v: string) =>
  v.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();

const canon = (v: unknown) =>
  String(v ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

const isInvalidNoAplica = (v: unknown) => {
  const c = canon(v);
  return c === '' || c === 'no aplica' || c === 'no';
};

/** ================== Source & Sede helpers ================== */
const SOURCE_EMPTY = '__EMPTY__';
const labelSource = (s?: string | null) => {
  const str = (s ?? '').toString().trim();
  return str ? str : '(sin source)';
};

const PALETTE = [
  '#2563EB','#A855F7','#10B981','#F59E0B','#EF4444','#14B8A6','#8B5CF6','#3B82F6','#D946EF','#06B6D4',
  '#84CC16','#F97316','#DC2626','#22C55E','#0EA5E9','#EAB308','#F43F5E','#4F46E5','#059669','#7C3AED'
];
const hashString = (s: string) => {
  let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
};
const colorForSource = (key: string) => PALETTE[hashString(key) % PALETTE.length];

// Paleta distinta para sedes
const SEDE_PALETTE = [
  '#0ea5e9', '#16a34a', '#f97316', '#a855f7', '#e11d48', '#22c55e', '#9333ea', '#ef4444', '#06b6d4', '#84cc16'
];
const colorForSede = (sede: string) => SEDE_PALETTE[hashString(sede || 'unknown') % SEDE_PALETTE.length];

/** ================== Tipos ================== */
type BucketPoint = Record<string, any> & {
  key: string;           // YYYY-MM-DD de inicio de bucket
  label: string;         // etiqueta para XAxis
  when: 'past' | 'today' | 'future';
  totalCount: number;
  totalUnique: number;
};

export const Resultados: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros principales
  const [sedeFilter, setSedeFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [granularity, setGranularity] = useState<Granularity>('day');

  // Filtro de source (como Conversaciones)
  const [sourceFilter, setSourceFilter] = useState<string>(''); // '', SOURCE_EMPTY o valor del source

  // Visibilidad por source en la leyenda (toggle por color)
  const [visibleSources, setVisibleSources] = useState<Set<string>>(new Set());

  // Detalle seleccionado (para lista inferior)
  const [selectedDetail, setSelectedDetail] = useState<null | { kind: 'agendas' | 'creados'; key: string }>(null);

  // Modal
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [savingRow, setSavingRow] = useState<number | null>(null);

  /** === Carga inicial === */
  const fetchClients = async () => {
    try {
      setLoading(true);
      const data = await ClientService.getClients();
      setClients(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  /** === Sincronización con otras vistas/pestañas === */
  useEffect(() => {
    const onExternalUpdate = (ev: Event) => {
      const detail = (ev as CustomEvent<Partial<Client>>).detail;
      if (!detail || !("row_number" in detail)) return;
      setClients(prev => prev.map(c => (c.row_number === (detail as any).row_number ? ({ ...c, ...detail } as Client) : c)));
      setViewClient(v => (v && detail && v.row_number === (detail as any).row_number ? ({ ...v, ...detail } as Client) : v));
    };
    window.addEventListener('client:updated', onExternalUpdate as any);
    const onStorage = (e: StorageEvent) => { if (e.key === 'crm:client-updated' && e.newValue) fetchClients(); };
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('client:updated', onExternalUpdate as any); window.removeEventListener('storage', onStorage); };
  }, []);

  /** === Validación por fecha base === */
  const withValidAgendaDate = useMemo(() => clients.filter(c => !!parseAgendaDate((c as any).fecha_agenda)), [clients]);
  const withValidCreatedDate = useMemo(() => clients.filter(c => !!parseCreatedToBogota((c as any).created)), [clients]);

  /** === Sedes únicas para el filtro (agenda_ciudad_sede) === */
  const sedes = useMemo(() => {
    const s = new Set<string>();
    withValidAgendaDate.forEach(c => {
      const sede = (c as any).agenda_ciudad_sede ? String((c as any).agenda_ciudad_sede).trim() : '';
      if (sede && !isInvalidNoAplica(sede)) s.add(sede);
    });
    return ['ALL', ...Array.from(s).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))];
  }, [withValidAgendaDate]);

  /** === Fuentes dinámicas (meta) para dropdown y leyenda === */
  const sourcesMeta = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    for (const c of clients) {
      const raw = ((c as any).source ?? '').toString().trim();
      const key = raw ? raw : SOURCE_EMPTY;
      const label = key === SOURCE_EMPTY ? '(sin source)' : raw;
      const prev = map.get(key);
      map.set(key, { label, count: (prev?.count ?? 0) + 1 });
    }
    const items = Array.from(map.entries()).map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    return { total: clients.length, items };
  }, [clients]);

  /** === Helpers comunes de filtro === */
  const inRange = (d: Date) => {
    const sd = startOfDay(d).getTime();
    if (fromDate) { const f = new Date(fromDate + 'T00:00:00'); if (sd < f.getTime()) return false; }
    if (toDate)   { const t = new Date(toDate + 'T23:59:59.999'); if (sd > t.getTime()) return false; }
    return true;
  };

  const passTextSedeSource = (c: Client) => {
    if (sedeFilter !== 'ALL') {
      const nf = normalize(sedeFilter);
      const sede = normalize(String((c as any).agenda_ciudad_sede || ''));
      if (sede !== nf) return false;
    }
    if (sourceFilter) {
      const raw = ((c as any).source ?? '').toString().trim();
      const key = raw ? raw : SOURCE_EMPTY;
      if (key !== sourceFilter) return false;
    }
    if (search.trim()) {
      const q = normalize(search.trim());
      const nombre = normalize(String(c.nombre || ''));
      const modelo = normalize(String((c as any).modelo || ''));
      const ciudad = normalize(String((c as any).ciudad || ''));
      const sede = normalize(String((c as any).agenda_ciudad_sede || ''));
      const tel = String((c as any).whatsapp || '').replace('@s.whatsapp.net', '');
      if (!(nombre.includes(q) || modelo.includes(q) || ciudad.includes(q) || sede.includes(q) || tel.includes(q))) return false;
    }
    return true;
  };

  /** === Constructor de series dinámicas por source (apiladas) === */
  const buildSeries = (
    base: Client[],
    dateGetter: (c: Client) => Date | null
  ) => {
    const map = new Map<
      string,
      {
        start: Date; when: BucketPoint['when'];
        counts: Map<string, number>; // por source
        uniques: Map<string, Set<string>>; // por source
        totSet: Set<string>;
      }
    >();

    const today = startOfDay(new Date());
    const allSourceKeys = new Set<string>();

    for (const c of base) {
      if (!passTextSedeSource(c)) continue;
      const d = dateGetter(c);
      if (!d || !inRange(d)) continue;

      const start = bucketStart(d, granularity);
      const key = toYMD(start);
      if (!map.has(key)) {
        const s = startOfDay(start);
        let when: BucketPoint['when'] = 'past';
        if (sameLocalDay(s, today)) when = 'today'; else if (s > today) when = 'future';
        map.set(key, { start: s, when, counts: new Map(), uniques: new Map(), totSet: new Set() });
      }

      const rec = map.get(key)!;
      const srcRaw = ((c as any).source ?? '').toString().trim();
      const srcKey = srcRaw ? srcRaw : SOURCE_EMPTY;
      allSourceKeys.add(srcKey);

      // claves únicas por persona/contacto (para "clientes únicos")
      const uniqueId = String((c as any).whatsapp || c.row_number || `${c.nombre}|${(c as any).ciudad}`);
      rec.totSet.add(uniqueId);

      // sumatorios por source
      rec.counts.set(srcKey, (rec.counts.get(srcKey) ?? 0) + 1);
      if (!rec.uniques.has(srcKey)) rec.uniques.set(srcKey, new Set());
      rec.uniques.get(srcKey)!.add(uniqueId);
    }

    const uniqueMap = new Map<string, Map<string, number>>();

    const points: BucketPoint[] = Array.from(map.entries()).map(([key, r]) => {
      const row: BucketPoint = {
        key,
        label: formatBucketLabel(r.start, granularity),
        when: r.when,
        totalCount: 0,
        totalUnique: r.totSet.size,
      } as BucketPoint;
      const uMap = new Map<string, number>();

      let total = 0;
      for (const [srcKey, cnt] of r.counts.entries()) {
        (row as any)[srcKey] = cnt; // campo dinámico para Recharts
        uMap.set(srcKey, r.uniques.get(srcKey)?.size ?? 0);
        total += cnt;
      }
      row.totalCount = total;
      uniqueMap.set(key, uMap);
      return row;
    }).sort((a, b) => a.key.localeCompare(b.key));

    const sourceKeys = Array.from(allSourceKeys.values());
    return { points, sourceKeys, uniqueMap } as const;
  };

  // Series
  const agendasSeries = useMemo(() => buildSeries(withValidAgendaDate, (c) => parseAgendaDate((c as any).fecha_agenda)), [withValidAgendaDate, granularity, search, sedeFilter, sourceFilter, fromDate, toDate]);
  const creadosSeries = useMemo(() => buildSeries(withValidCreatedDate, (c) => parseCreatedToBogota((c as any).created)), [withValidCreatedDate, granularity, search, sedeFilter, sourceFilter, fromDate, toDate]);

  // Fuente de verdad para leyenda (union de keys de ambas series)
  const legendKeys = useMemo(() => Array.from(new Set([ ...agendasSeries.sourceKeys, ...creadosSeries.sourceKeys ])), [agendasSeries.sourceKeys, creadosSeries.sourceKeys]);

  // Inicializar/actualizar visibilidad cuando cambian las keys
  useEffect(() => {
    setVisibleSources(prev => {
      if (prev.size === 0) return new Set(legendKeys);
      const next = new Set(prev);
      legendKeys.forEach(k => next.add(k)); // añade nuevas
      return next;
    });
  }, [JSON.stringify(legendKeys)]);

  /** === KPIs rápidos (totales) === */
  const totalAgendas = agendasSeries.points.reduce((a, b) => a + b.totalCount, 0);
  const totalClientesAgendados = agendasSeries.points.reduce((a, b) => a + b.totalUnique, 0);
  const totalCreados = creadosSeries.points.reduce((a, b) => a + b.totalCount, 0);
  const totalClientesCreados = creadosSeries.points.reduce((a, b) => a + b.totalUnique, 0);

  /** === Tooltip personalizado (solo números y Total) === */
  type RechartsPayload = any; // relajar tipos para evitar incompatibilidades de readonly
  const StackedTooltip: React.FC<{ labelResolver: (k: string) => string }> = ({ labelResolver, ...props }: any) => {
    const { active, payload, label } = props as { active?: boolean; payload?: readonly RechartsPayload[]; label?: any };
    if (!active || !payload || !payload.length) return null;

    const rows = (payload as readonly RechartsPayload[]).map((p: any) => ({
      name: labelResolver(String(p.dataKey)),
      value: Number(p.value) || 0,
      color: p.fill as string,
      dataKey: String(p.dataKey),
    }));

    const total = rows.reduce((s, r) => s + r.value, 0);

    return (
      <div className="rounded-lg border border-gray-200 bg-white/95 text-gray-800 shadow p-3 min-w-[180px]">
        <div className="text-xs text-gray-500 mb-2">{String(label)}</div>
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.dataKey} className="flex items-center justify-between gap-3 text-sm">
              <span className="inline-flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: r.color }} />
                {r.name}
              </span>
              <span className="tabular-nums font-medium">{r.value}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-sm font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{total}</span>
        </div>
      </div>
    );
  };

  /** === Leyenda personalizada con acciones (click para toggle, Shift+click para aislar) === */
  const LegendContent: React.FC<{ keys: string[]; onToggle: (key: string, mode: 'toggle' | 'solo') => void; visible: Set<string> }> = ({ keys, onToggle, visible }) => (
    <div className="flex flex-wrap gap-2 text-sm">
      {keys.map((k) => (
        <button
          key={k}
          onClick={(e) => onToggle(k, (e as any).shiftKey || (e as any).metaKey || (e as any).ctrlKey ? 'solo' : 'toggle')}
          className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition ${visible.has(k) ? 'bg-white border-gray-200' : 'bg-gray-100 border-gray-200 opacity-60'}`}
          title={`${visible.has(k) ? 'Ocultar' : 'Mostrar'} ${labelSource(k === SOURCE_EMPTY ? '' : k)}`}
        >
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colorForSource(k) }} />
          <span className="text-xs">{labelSource(k === SOURCE_EMPTY ? '' : k)}</span>
        </button>
      ))}
      {!!keys.length && (
        <div className="ml-2 inline-flex gap-2">
          <button className="text-[11px] px-2 py-1 rounded border border-gray-200" onClick={() => setVisibleSources(new Set(keys))}>Todos</button>
          <button className="text-[11px] px-2 py-1 rounded border border-gray-200" onClick={() => setVisibleSources(new Set())}>Ninguno</button>
        </div>
      )}
    </div>
  );

  /** === Bloque de gráfico reusable (stacked dinámico por source) === */
  const ChartBlock: React.FC<{
    title: string;
    subtitle: string;
    data: BucketPoint[];
    sourceKeys: string[];
    uniqueMap: Map<string, Map<string, number>>; // se conserva por si luego se usa, pero NO se muestra en tooltip
    onBarClick?: (entryKey: string | null) => void;
    showBrush?: boolean;
    height?: number;
  }> = ({ title, subtitle, data, sourceKeys, uniqueMap, onBarClick, showBrush = true, height = 340 }) => {
    const labelResolver = (k: string) => labelSource(k === SOURCE_EMPTY ? '' : k);

    // Por si no hay visibles, no renderizar series
    const renderKeys = sourceKeys.filter(k => visibleSources.has(k));

    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/40 p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-gray-800">{title}</h3>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
          <LegendContent keys={sourceKeys} onToggle={(k, mode) => {
            setVisibleSources(prev => {
              if (mode === 'solo') return new Set([k]);
              const next = new Set(prev);
              if (next.has(k)) next.delete(k); else next.add(k);
              return next;
            });
          }} visible={visibleSources} />
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-600">Cargando datos…</div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">{error}</div>
        ) : data.length ? (
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height={height}>
              <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                {/* Tooltip SOLO números + Total */}
                <Tooltip content={<StackedTooltip labelResolver={labelResolver} />} />
                <Legend content={() => null} />

                {renderKeys.map((k) => (
                  <Bar
                    key={k}
                    dataKey={k}
                    name={labelResolver(k)}
                    stackId="a"
                    fill={colorForSource(k)}
                    onClick={(_, index) => onBarClick?.(data[index]?.key ?? null)}
                    isAnimationActive
                  />
                ))}

                {showBrush && data.length > 24 && <Brush dataKey="label" height={24} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-12 text-center text-gray-500">No hay datos para mostrar.</div>
        )}
      </div>
    );
  };

  /** === Render === */
  return (
    <div className="space-y-6">
      {/* Header / Filtros superiores */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/40 p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Resultados</h2>
              <p className="text-sm text-gray-500">Comparativo por {granularity === 'day' ? 'día' : granularity === 'week' ? 'semana' : 'mes'} (apilado por source)</p>
            </div>
          </div>

          {/* Controles de agrupación y filtros */}
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            {/* Agrupación */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Agrupar por</span>
              <select
                className="px-3 py-2 border border-gray-200 rounded-xl"
                value={granularity}
                onChange={e => { setGranularity(e.target.value as Granularity); setSelectedDetail(null); }}
                title="Agrupar por día/semana/mes"
              >
                <option value="day">Día</option>
                <option value="week">Semana</option>
                <option value="month">Mes</option>
              </select>
            </div>

            {/* Sede */}
            <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-purple-50 p-3 rounded-xl border border-indigo-200">
              <span className="text-sm font-medium text-indigo-700">Sede (agenda_ciudad_sede):</span>
              <select
                value={sedeFilter}
                onChange={(e) => { setSedeFilter(e.target.value); setSelectedDetail(null); }}
                className="px-3 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                title="Filtrar por sede"
              >
                {sedes.map(s => (
                  <option key={s} value={s}>
                    {s === 'ALL' ? 'Todas' : s}
                  </option>
                ))}
              </select>
              {sedeFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-2 px-2 py-1 text-xs rounded-lg border border-indigo-200 bg-white">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: colorForSede(sedeFilter) }} />
                  {sedeFilter}
                </span>
              )}
            </div>

            {/* Filtro por source (como Conversaciones) */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Canal (source)</span>
              <select
                value={sourceFilter}
                onChange={(e) => { setSourceFilter(e.target.value); setSelectedDetail(null); }}
                className="px-3 py-2 border border-gray-200 rounded-xl"
                title="Filtrar por canal (source)"
              >
                <option value="">{`Todos (${sourcesMeta.total})`}</option>
                {sourcesMeta.items.map((it) => (
                  <option key={it.key} value={it.key}>{`${it.label} (${it.count})`}</option>
                ))}
              </select>
              {sourceFilter && (
                <button
                  onClick={() => setSourceFilter('')}
                  className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                  title="Quitar filtro de source"
                >
                  Quitar
                </button>
              )}
            </div>

            {/* Búsqueda */}
            <div className="relative w-full max-w-md">
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSelectedDetail(null); }}
                placeholder="Buscar por nombre, modelo, ciudad o WhatsApp…"
                className="w-full pl-3 pr-9 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              {search && (
                <button
                  title="Limpiar"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-gray-100"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              )}
            </div>

            {/* Rango de fechas */}
            <div className="flex items-center gap-2">
              <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setSelectedDetail(null); }} className="px-3 py-2 border border-gray-200 rounded-xl" title="Desde" />
              <span className="text-gray-500">—</span>
              <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setSelectedDetail(null); }} className="px-3 py-2 border border-gray-200 rounded-xl" title="Hasta" />
            </div>

            <button
              onClick={fetchClients}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.99] transition ml-auto"
              aria-label="Recargar"
              disabled={loading || savingRow !== null}
              title={savingRow !== null ? 'Guardando cambios…' : 'Recargar'}
            >
              <RefreshCw className="w-4 h-4" />
              <span className="text-sm">{savingRow !== null ? 'Guardando…' : 'Recargar'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* === GRÁFICAS UNA SOBRE LA OTRA (stacked por source) === */}
      <ChartBlock
        title="Agendas"
        subtitle={`Apiladas por ${granularity === 'day' ? 'día' : granularity === 'week' ? 'semana' : 'mes'} • click en color para mostrar/ocultar, Shift+click para aislar`}
        data={agendasSeries.points}
        sourceKeys={agendasSeries.sourceKeys}
        uniqueMap={agendasSeries.uniqueMap}
        onBarClick={(k) => setSelectedDetail(k ? { kind: 'agendas', key: k } : null)}
        showBrush
        height={340}
      />

      <ChartBlock
        title="Creados"
        subtitle={`Apiladas por ${granularity === 'day' ? 'día' : granularity === 'week' ? 'semana' : 'mes'} • click en color para mostrar/ocultar, Shift+click para aislar`}
        data={creadosSeries.points}
        sourceKeys={creadosSeries.sourceKeys}
        uniqueMap={creadosSeries.uniqueMap}
        onBarClick={(k) => setSelectedDetail(k ? { kind: 'creados', key: k } : null)}
        showBrush
        height={340}
      />

      {/* KPIs rápidos */}
      {!loading && !error && !!(agendasSeries.points.length + creadosSeries.points.length) && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white/90 rounded-2xl border border-white/40 shadow p-5">
            <p className="text-sm text-gray-500">Agendas (Σ)</p>
            <p className="text-3xl font-semibold">{totalAgendas}</p>
            <p className="text-xs text-gray-500 mt-1">Clientes únicos: {totalClientesAgendados}</p>
          </div>
          <div className="bg-white/90 rounded-2xl border border-white/40 shadow p-5">
            <p className="text-sm text-gray-500">Creados (Σ)</p>
            <p className="text-3xl font-semibold">{totalCreados}</p>
            <p className="text-xs text-gray-500 mt-1">Clientes únicos: {totalClientesCreados}</p>
          </div>
          <div className="bg-white/90 rounded-2xl border border-white/40 shadow p-5">
            <p className="text-sm text-gray-500">Sources (agendas)</p>
            <p className="text-base text-gray-700">{agendasSeries.sourceKeys.map(k => labelSource(k === SOURCE_EMPTY ? '' : k)).join(', ') || '—'}</p>
          </div>
          <div className="bg-white/90 rounded-2xl border border-white/40 shadow p-5">
            <p className="text-sm text-gray-500">Sources (creados)</p>
            <p className="text-base text-gray-700">{creadosSeries.sourceKeys.map(k => labelSource(k === SOURCE_EMPTY ? '' : k)).join(', ') || '—'}</p>
          </div>
        </div>
      )}

      {/* Lista detallada del bucket seleccionado (Agendas o Creados) */}
      {selectedDetail && (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/40 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                {selectedDetail.kind === 'agendas' ? 'Agendas' : 'Creados'} del <span className="text-indigo-600">{selectedDetail.key}</span>
              </h3>
              <p className="text-sm text-gray-500">
                {sedeFilter === 'ALL' ? 'Todas las sedes' : `Sede: ${sedeFilter}`} {sourceFilter ? `• Source: ${labelSource(sourceFilter === SOURCE_EMPTY ? '' : sourceFilter)}` : ''}
              </p>
            </div>
            <button
              onClick={() => setSelectedDetail(null)}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 inline-flex items-center gap-2"
              title="Cerrar detalle"
            >
              <X className="w-4 h-4" />
              Cerrar
            </button>
          </div>

          {(() => {
            const items = (selectedDetail.kind === 'agendas' ? withValidAgendaDate : withValidCreatedDate)
              .filter(c => passTextSedeSource(c))
              .filter(c => {
                const d = selectedDetail.kind === 'agendas' ? parseAgendaDate((c as any).fecha_agenda) : parseCreatedToBogota((c as any).created);
                if (!d) return false;
                const b = bucketStart(d, granularity);
                return toYMD(b) === selectedDetail.key && inRange(d);
              })
              .sort((a, b) => {
                const ta = (selectedDetail.kind === 'agendas' ? parseAgendaDate((a as any).fecha_agenda) : parseCreatedToBogota((a as any).created))?.getTime() ?? 0;
                const tb = (selectedDetail.kind === 'agendas' ? parseAgendaDate((b as any).fecha_agenda) : parseCreatedToBogota((b as any).created))?.getTime() ?? 0;
                return ta - tb;
              });

            return items.length ? (
              <div className="divide-y divide-gray-100">
                {items.map((client) => (
                  <div
                    key={client.row_number}
                    onClick={() => setViewClient(client)}
                    className="p-6 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 transition-all duration-300 cursor-pointer"
                    role="button"
                    tabIndex={0}
                    aria-label={`Abrir modal de ${client.nombre || 'cliente'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-base font-semibold text-gray-900">{client.nombre || 'Sin nombre'}</h4>
                        <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-gray-700">
                          <span><strong>Modelo:</strong> {(client as any).modelo || 'N/A'}</span>
                          <span><strong>Ciudad:</strong> {(client as any).ciudad || 'N/A'}</span>
                          {((client as any).agenda_ciudad_sede) && (
                            <span className="inline-flex items-center gap-2">
                              <strong>Sede:</strong>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs" style={{ borderColor: colorForSede(String((client as any).agenda_ciudad_sede)), color: '#374151' }}>
                                <span className="w-2 h-2 rounded-sm inline-block" style={{ background: colorForSede(String((client as any).agenda_ciudad_sede)) }} />
                                {String((client as any).agenda_ciudad_sede)}
                              </span>
                            </span>
                          )}
                          <span className="inline-flex items-center text-purple-600">
                            <Clock className="w-4 h-4 mr-1" />
                            {selectedDetail.kind === 'agendas' ? displayAgendaDate((client as any).fecha_agenda) : displayCreatedDate((client as any).created)}
                          </span>
                        </div>
                        {(client as any).intencion && (
                          <p className="text-sm text-gray-600 mt-1"><strong>Intención:</strong> {(client as any).intencion}</p>
                        )}
                        {(client as any).notas && (
                          <p className="text-sm text-gray-600 mt-1"><strong>Notas:</strong> {(client as any).notas}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const phoneNumber = String((client as any).whatsapp || '').replace('@s.whatsapp.net', '');
                            window.open(`https://wa.me/${phoneNumber}`, '_blank');
                          }}
                          className="flex items-center text-green-600 hover:text-green-700 font-medium transition-colors duration-300 group mb-2 ml-auto"
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          <span className="text-sm">{formatWhatsApp((client as any).whatsapp as any)}</span>
                        </button>
                        <div className="flex items-center gap-2 justify-end">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border-2 shadow-sm ${getEtapaColor((client as any).estado_etapa as any)}`}>
                            {(((client as any).estado_etapa || 'Sin_estado') as string).replace(/_/g, ' ')}
                          </span>
                          {(client as any).categoria_contacto && (
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm ${getCategoriaColor((client as any).categoria_contacto as any)}`}>
                              {(((client as any).categoria_contacto as string) || '').replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-gray-500">No hay registros para ese período con los filtros aplicados.</div>
            );
          })()}
        </div>
      )}

      {/* Modal reutilizable con edición inline */}
      <ClientModal isOpen={!!viewClient} onClose={() => setViewClient(null)} client={viewClient} onUpdate={(async (payload: Partial<Client>) => {
        if (!payload.row_number) return false; setSavingRow(payload.row_number);
        const prev = clients, prevView = viewClient;
        setClients(curr => curr.map(c => (c.row_number === payload.row_number ? ({ ...c, ...payload } as Client) : c)));
        setViewClient(v => (v && v.row_number === payload.row_number ? ({ ...v, ...payload } as Client) : v));
        try {
          if (typeof (ClientService as any).updateClient === 'function') await (ClientService as any).updateClient(payload);
          else await fetch('/api/clients/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          return true;
        } catch {
          setClients(prev); setViewClient(prevView); setError('No se pudo guardar los cambios'); return false;
        } finally { setSavingRow(null); }
      })} />
    </div>
  );
};

export default Resultados;
