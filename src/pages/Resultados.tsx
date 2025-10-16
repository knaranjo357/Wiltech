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
  Cell,
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
  if (g === 'day') {
    return d.toLocaleDateString('es-CO', { month: 'short', day: '2-digit' });
  }
  if (g === 'week') {
    return `Sem ${toYMD(d)}`; // lunes de la semana
  }
  // month
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

const displayDate = (s?: string | null) => {
  const d = parseAgendaDate(s);
  if (!d) return 'Fecha inválida';
  return `${d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
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

/** ================== Tipos / Colores ================== */
type BucketPoint = {
  key: string;
  label: string;
  when: 'past' | 'today' | 'future';
  // comparación por source
  bogotaCount: number;
  bogotaUnique: number;
  bgaCount: number;
  bgaUnique: number;
  // totales (por si quieres mostrar stacked en el futuro)
  totalCount: number;
  totalUnique: number;
};

const COLORS = {
  bogota: '#2563EB',     // blue-600
  bogotaSelected: '#1D4ED8', // blue-700
  bga: '#A855F7',        // purple-600
  bgaSelected: '#7C3AED',    // violet-600
};

const classifySource = (c: Client): 'bogota' | 'bga' | 'other' => {
  const s = String((c as any).source ?? '').trim();
  const sN = s.toLowerCase();
  if (sN === 'wiltech') return 'bogota';
  if (sN === 'wiltechbga') return 'bga';
  return 'other';
};

export const Resultados: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs: agendas vs creados
  const [activeTab, setActiveTab] = useState<'agendas' | 'creados'>('agendas');

  // Filtro principal: agenda_ciudad_sede
  const [sedeFilter, setSedeFilter] = useState<string>('ALL');

  // Búsqueda texto
  const [search, setSearch] = useState<string>('');

  // Rango de fechas (YYYY-MM-DD)
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Agrupación
  const [granularity, setGranularity] = useState<Granularity>('day');

  // selección de barra para detalle (solo en agendas)
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

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

  useEffect(() => {
    fetchClients();
  }, []);

  /** === Sincronización con otras vistas/pestañas === */
  useEffect(() => {
    const onExternalUpdate = (ev: Event) => {
      const detail = (ev as CustomEvent<Partial<Client>>).detail;
      if (!detail || !('row_number' in detail)) return;

      setClients(prev => prev.map(c => (c.row_number === (detail as any).row_number ? ({ ...c, ...detail } as Client) : c)));
      setViewClient(v => (v && detail && v.row_number === (detail as any).row_number ? ({ ...v, ...detail } as Client) : v));
    };

    window.addEventListener('client:updated', onExternalUpdate as any);

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'crm:client-updated' && e.newValue) fetchClients();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('client:updated', onExternalUpdate as any);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  /** === onUpdate para modal (optimista + rollback) === */
  const onUpdate = async (payload: Partial<Client>): Promise<boolean> => {
    if (!payload.row_number) return false;
    setSavingRow(payload.row_number);

    const prevClients = clients;
    const prevView = viewClient;

    setClients(prev => prev.map(c => (c.row_number === payload.row_number ? ({ ...c, ...payload } as Client) : c)));
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
    } catch {
      setClients(prevClients);
      setViewClient(prevView);
      setError('No se pudo guardar los cambios');
      return false;
    } finally {
      setSavingRow(null);
    }
  };

  /** === Validación por fecha base === */
  const withValidAgendaDate = useMemo(() => {
    return clients.filter(c => !!parseAgendaDate((c as any).fecha_agenda));
  }, [clients]);

  const withValidCreatedDate = useMemo(() => {
    return clients.filter(c => !!parseCreatedToBogota((c as any).created));
  }, [clients]);

  /** === Sedes únicas para el filtro (agenda_ciudad_sede) === */
  const sedes = useMemo(() => {
    const s = new Set<string>();
    withValidAgendaDate.forEach(c => {
      const sede = (c as any).agenda_ciudad_sede ? String((c as any).agenda_ciudad_sede).trim() : '';
      if (sede && !isInvalidNoAplica(sede)) s.add(sede);
    });
    return ['ALL', ...Array.from(s).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))];
  }, [withValidAgendaDate]);

  /** === Helpers comunes de filtro === */
  const inRange = (d: Date) => {
    const sd = startOfDay(d).getTime();
    if (fromDate) {
      const f = new Date(fromDate + 'T00:00:00');
      if (sd < f.getTime()) return false;
    }
    if (toDate) {
      const t = new Date(toDate + 'T23:59:59.999');
      if (sd > t.getTime()) return false;
    }
    return true;
  };

  const passTextAndSede = (c: Client) => {
    // Filtro de sede
    if (sedeFilter !== 'ALL') {
      const nf = normalize(sedeFilter);
      const sede = normalize(String((c as any).agenda_ciudad_sede || ''));
      if (sede !== nf) return false;
    }
    // Búsqueda de texto
    if (search.trim()) {
      const q = normalize(search.trim());
      const nombre = normalize(String(c.nombre || ''));
      const modelo = normalize(String((c as any).modelo || ''));
      const ciudad = normalize(String((c as any).ciudad || ''));
      const sede = normalize(String((c as any).agenda_ciudad_sede || ''));
      const tel = String((c as any).whatsapp || '').replace('@s.whatsapp.net', '');
      if (!(nombre.includes(q) || modelo.includes(q) || ciudad.includes(q) || sede.includes(q) || tel.includes(q))) {
        return false;
      }
    }
    return true;
  };

  /** === Series comparativas por bucket (AGENDAS) === */
  const seriesAgendas: BucketPoint[] = useMemo(() => {
    const map = new Map<
      string,
      {
        start: Date;
        when: BucketPoint['when'];
        bogCount: number; bogSet: Set<string>;
        bgaCount: number; bgaSet: Set<string>;
        totCount: number; totSet: Set<string>;
      }
    >();

    const today = startOfDay(new Date());

    for (const c of withValidAgendaDate) {
      if (!passTextAndSede(c)) continue;
      const d = parseAgendaDate((c as any).fecha_agenda);
      if (!d || !inRange(d)) continue;

      const start = bucketStart(d, granularity);
      const key = toYMD(start);

      if (!map.has(key)) {
        const s = startOfDay(start);
        let when: BucketPoint['when'] = 'past';
        if (sameLocalDay(s, today)) when = 'today';
        else if (s > today) when = 'future';

        map.set(key, {
          start: s,
          when,
          bogCount: 0, bogSet: new Set(),
          bgaCount: 0, bgaSet: new Set(),
          totCount: 0, totSet: new Set(),
        });
      }

      const rec = map.get(key)!;
      const ck = String((c as any).whatsapp || c.row_number || `${c.nombre}|${(c as any).ciudad}`);

      // totales
      rec.totCount += 1;
      rec.totSet.add(ck);

      // por source
      const src = classifySource(c);
      if (src === 'bogota') {
        rec.bogCount += 1;
        rec.bogSet.add(ck);
      } else if (src === 'bga') {
        rec.bgaCount += 1;
        rec.bgaSet.add(ck);
      }
    }

    const arr: BucketPoint[] = Array.from(map.entries())
      .map(([key, r]) => ({
        key,
        label: formatBucketLabel(r.start, granularity),
        when: r.when,
        bogotaCount: r.bogCount,
        bogotaUnique: r.bogSet.size,
        bgaCount: r.bgaCount,
        bgaUnique: r.bgaSet.size,
        totalCount: r.totCount,
        totalUnique: r.totSet.size,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));

    return arr;
  }, [withValidAgendaDate, granularity, search, sedeFilter, fromDate, toDate]);

  /** === Series comparativas por bucket (CREADOS ajustado a -5) === */
  const seriesCreated: BucketPoint[] = useMemo(() => {
    const map = new Map<
      string,
      {
        start: Date;
        when: BucketPoint['when'];
        bogCount: number; bogSet: Set<string>;
        bgaCount: number; bgaSet: Set<string>;
        totCount: number; totSet: Set<string>;
      }
    >();

    const today = startOfDay(new Date());

    for (const c of withValidCreatedDate) {
      if (!passTextAndSede(c)) continue;
      const d = parseCreatedToBogota((c as any).created);
      if (!d || !inRange(d)) continue;

      const start = bucketStart(d, granularity);
      const key = toYMD(start);

      if (!map.has(key)) {
        const s = startOfDay(start);
        let when: BucketPoint['when'] = 'past';
        if (sameLocalDay(s, today)) when = 'today';
        else if (s > today) when = 'future';

        map.set(key, {
          start: s,
          when,
          bogCount: 0, bogSet: new Set(),
          bgaCount: 0, bgaSet: new Set(),
          totCount: 0, totSet: new Set(),
        });
      }

      const rec = map.get(key)!;
      const ck = String((c as any).whatsapp || c.row_number || `${c.nombre}|${(c as any).ciudad}`);

      rec.totCount += 1;
      rec.totSet.add(ck);

      const src = classifySource(c);
      if (src === 'bogota') {
        rec.bogCount += 1;
        rec.bogSet.add(ck);
      } else if (src === 'bga') {
        rec.bgaCount += 1;
        rec.bgaSet.add(ck);
      }
    }

    const arr: BucketPoint[] = Array.from(map.entries())
      .map(([key, r]) => ({
        key,
        label: formatBucketLabel(r.start, granularity),
        when: r.when,
        bogotaCount: r.bogCount,
        bogotaUnique: r.bogSet.size,
        bgaCount: r.bgaCount,
        bgaUnique: r.bgaSet.size,
        totalCount: r.totCount,
        totalUnique: r.totSet.size,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));

    return arr;
  }, [withValidCreatedDate, granularity, search, sedeFilter, fromDate, toDate]);

  // Serie activa según tab
  const activeSeries = activeTab === 'agendas' ? seriesAgendas : seriesCreated;

  /** === Lista de agendas del bucket seleccionado (solo tab AGENDAS) === */
  const selectedItems = useMemo(() => {
    if (activeTab !== 'agendas' || !selectedKey) return [];
    return withValidAgendaDate
      .filter(c => passTextAndSede(c))
      .filter(c => {
        const d = parseAgendaDate((c as any).fecha_agenda);
        if (!d) return false;
        const b = bucketStart(d, granularity);
        return toYMD(b) === selectedKey && inRange(d);
      })
      .sort((a, b) => {
        const ta = parseAgendaDate((a as any).fecha_agenda)?.getTime() ?? 0;
        const tb = parseAgendaDate((b as any).fecha_agenda)?.getTime() ?? 0;
        return ta - tb;
      });
  }, [activeTab, selectedKey, withValidAgendaDate, granularity, sedeFilter, search, fromDate, toDate]);

  /** === KPIs rápidos (totales y por source) === */
  const totalAgendas = seriesAgendas.reduce((a, b) => a + b.totalCount, 0);
  const totalClientesAgendados = seriesAgendas.reduce((a, b) => a + b.totalUnique, 0);
  const totalAgendasBog = seriesAgendas.reduce((a, b) => a + b.bogotaCount, 0);
  const totalAgendasBga = seriesAgendas.reduce((a, b) => a + b.bgaCount, 0);

  const totalCreados = seriesCreated.reduce((a, b) => a + b.totalCount, 0);
  const totalClientesCreados = seriesCreated.reduce((a, b) => a + b.totalUnique, 0);
  const totalCreadosBog = seriesCreated.reduce((a, b) => a + b.bogotaCount, 0);
  const totalCreadosBga = seriesCreated.reduce((a, b) => a + b.bgaCount, 0);

  /** === Tooltip comparativo === */
  const tooltipFormatter = (value: any, name: any, props: any) => {
    const p = props?.payload as BucketPoint | undefined;
    if (!p) return [value, name];
    if (props.dataKey === 'bogotaCount') {
      return [`${value} / ${p.bogotaUnique}`, 'Bogotá: Agendas / Clientes'];
    }
    if (props.dataKey === 'bgaCount') {
      return [`${value} / ${p.bgaUnique}`, 'Bucaramanga: Agendas / Clientes'];
    }
    return [value, name];
  };

  const tooltipLabel = (_: any, payload: any[]) => {
    const k = payload?.[0]?.payload?.key as string | undefined;
    return k ?? new Date().toLocaleDateString();
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
              <p className="text-sm text-gray-500">Comparativo Bogotá vs Bucaramanga por {granularity === 'day' ? 'día' : granularity === 'week' ? 'semana' : 'mes'}</p>
            </div>
          </div>

          {/* Tabs para elegir gráfica */}
          <div className="flex items-center gap-2">
            {(['agendas', 'creados'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSelectedKey(null); }}
                className={`px-3 py-2 rounded-xl border transition ${
                  activeTab === tab ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                {tab === 'agendas' ? 'Agendas' : 'Creados'}
              </button>
            ))}

            {/* Agrupación */}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-gray-600">Agrupar por</span>
              <select
                className="px-3 py-2 border border-gray-200 rounded-xl"
                value={granularity}
                onChange={e => { setGranularity(e.target.value as Granularity); setSelectedKey(null); }}
                title="Agrupar por día/semana/mes"
              >
                <option value="day">Día</option>
                <option value="week">Semana</option>
                <option value="month">Mes</option>
              </select>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            {/* Sede */}
            <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-purple-50 p-3 rounded-xl border border-indigo-200">
              <span className="text-sm font-medium text-indigo-700">Sede (agenda_ciudad_sede):</span>
              <select
                value={sedeFilter}
                onChange={(e) => { setSedeFilter(e.target.value); setSelectedKey(null); }}
                className="px-3 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                title="Filtrar por sede"
              >
                {sedes.map(s => (
                  <option key={s} value={s}>
                    {s === 'ALL' ? 'Todas' : s}
                  </option>
                ))}
              </select>
            </div>

            {/* Búsqueda */}
            <div className="relative w-full max-w-md">
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSelectedKey(null); }}
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
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setSelectedKey(null); }}
                className="px-3 py-2 border border-gray-200 rounded-xl"
                title="Desde"
              />
              <span className="text-gray-500">—</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setSelectedKey(null); }}
                className="px-3 py-2 border border-gray-200 rounded-xl"
                title="Hasta"
              />
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

      {/* Gráfica comparativa */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/40 p-6">
        {loading ? (
          <div className="py-12 text-center text-gray-600">Cargando datos…</div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">{error}</div>
        ) : activeSeries.length ? (
          <>
            <div className="flex items-center gap-4 text-sm mb-3">
              <span className="inline-flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLORS.bogota }} />
                Bogotá (source: Wiltech)
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLORS.bga }} />
                Bucaramanga (source: WiltechBga)
              </span>
            </div>
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeSeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={tooltipFormatter} labelFormatter={tooltipLabel} />
                  <Legend />
                  {/* Bogotá */}
                  <Bar
                    dataKey="bogotaCount"
                    name="Bogotá"
                    onClick={(entry: any) => {
                      if (activeTab === 'agendas') setSelectedKey(entry?.key ?? null);
                    }}
                    isAnimationActive
                  >
                    {activeSeries.map((s) => (
                      <Cell
                        key={`bog-${s.key}`}
                        cursor={activeTab === 'agendas' ? 'pointer' : 'default'}
                        fill={selectedKey === s.key && activeTab === 'agendas' ? COLORS.bogotaSelected : COLORS.bogota}
                      />
                    ))}
                  </Bar>

                  {/* Bucaramanga */}
                  <Bar
                    dataKey="bgaCount"
                    name="Bucaramanga"
                    onClick={(entry: any) => {
                      if (activeTab === 'agendas') setSelectedKey(entry?.key ?? null);
                    }}
                    isAnimationActive
                  >
                    {activeSeries.map((s) => (
                      <Cell
                        key={`bga-${s.key}`}
                        cursor={activeTab === 'agendas' ? 'pointer' : 'default'}
                        fill={selectedKey === s.key && activeTab === 'agendas' ? COLORS.bgaSelected : COLORS.bga}
                      />
                    ))}
                  </Bar>

                  {activeSeries.length > 24 && <Brush dataKey="label" height={24} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="py-12 text-center text-gray-500">No hay datos para mostrar.</div>
        )}
      </div>

      {/* KPIs rápidos */}
      {!loading && !error && !!(seriesAgendas.length + seriesCreated.length) && (
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
          <div className="bg-white/90 rounded-2xl border border-white/40 shadow p-5">
            <p className="text-sm text-gray-500">Agendas (Σ)</p>
            <p className="text-3xl font-semibold">{totalAgendas}</p>
            <p className="text-xs text-gray-500 mt-1">Clientes únicos: {totalClientesAgendados}</p>
          </div>
          <div className="bg-white/90 rounded-2xl border border-white/40 shadow p-5">
            <p className="text-sm text-gray-500">Agendas Bogotá</p>
            <p className="text-3xl font-semibold">{totalAgendasBog}</p>
          </div>
          <div className="bg-white/90 rounded-2xl border border-white/40 shadow p-5">
            <p className="text-sm text-gray-500">Agendas Bucaramanga</p>
            <p className="text-3xl font-semibold">{totalAgendasBga}</p>
          </div>

          <div className="bg-white/90 rounded-2xl border border-white/40 shadow p-5">
            <p className="text-sm text-gray-500">Creados (Σ)</p>
            <p className="text-3xl font-semibold">{totalCreados}</p>
            <p className="text-xs text-gray-500 mt-1">Clientes únicos: {totalClientesCreados}</p>
          </div>
          <div className="bg-white/90 rounded-2xl border border-white/40 shadow p-5">
            <p className="text-sm text-gray-500">Creados Bogotá</p>
            <p className="text-3xl font-semibold">{totalCreadosBog}</p>
          </div>
          <div className="bg-white/90 rounded-2xl border border-white/40 shadow p-5">
            <p className="text-sm text-gray-500">Creados Bucaramanga</p>
            <p className="text-3xl font-semibold">{totalCreadosBga}</p>
          </div>
        </div>
      )}

      {/* Lista detallada del bucket seleccionado (solo para Agendas) */}
      {activeTab === 'agendas' && !!selectedKey && (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/40 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                Agendas del <span className="text-indigo-600">{selectedKey}</span>
              </h3>
              <p className="text-sm text-gray-500">
                {sedeFilter === 'ALL' ? 'Todas las sedes' : `Sede: ${sedeFilter}`} • {selectedItems.length} registro
                {selectedItems.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => setSelectedKey(null)}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 inline-flex items-center gap-2"
              title="Cerrar detalle"
            >
              <X className="w-4 h-4" />
              Cerrar
            </button>
          </div>

          {selectedItems.length ? (
            <div className="divide-y divide-gray-100">
              {selectedItems.map((client) => (
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
                      <h4 className="text-base font-semibold text-gray-900">
                        {client.nombre || 'Sin nombre'}
                      </h4>

                      <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-gray-700">
                        <span><strong>Modelo:</strong> {(client as any).modelo || 'N/A'}</span>
                        <span><strong>Ciudad:</strong> {(client as any).ciudad || 'N/A'}</span>
                        <span className="inline-flex items-center text-purple-600">
                          <Clock className="w-4 h-4 mr-1" />
                          {displayDate((client as any).fecha_agenda)}
                        </span>
                      </div>

                      {(client as any).intencion && (
                        <p className="text-sm text-gray-600 mt-1">
                          <strong>Intención:</strong> {(client as any).intencion}
                        </p>
                      )}
                      {(client as any).notas && (
                        <p className="text-sm text-gray-600 mt-1">
                          <strong>Notas:</strong> {(client as any).notas}
                        </p>
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
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border-2 shadow-sm ${getEtapaColor((client as any).estado_etapa as any)}`}
                        >
                          {(((client as any).estado_etapa || 'Sin_estado') as string).replace(/_/g, ' ')}
                        </span>
                        {(client as any).categoria_contacto && (
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm ${getCategoriaColor((client as any).categoria_contacto as any)}`}
                          >
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
            <div className="py-10 text-center text-gray-500">
              No hay agendas para ese día con los filtros aplicados.
            </div>
          )}
        </div>
      )}

      {/* Modal reutilizable con edición inline */}
      <ClientModal isOpen={!!viewClient} onClose={() => setViewClient(null)} client={viewClient} onUpdate={onUpdate} />
    </div>
  );
};

export default Resultados;
