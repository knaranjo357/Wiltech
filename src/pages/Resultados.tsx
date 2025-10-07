// src/pages/Resultados.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, RefreshCw, X, Phone, Clock, BarChart2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Brush,
  Cell,
} from 'recharts';

import { ClientService } from '../services/clientService';
import { Client } from '../types/client';
import { ClientModal } from '../components/ClientModal';
import { formatWhatsApp, getEtapaColor, getCategoriaColor } from '../utils/clientHelpers';

/** ================== Utils de fecha (compatibles con Agenda) ================== */
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const parseAgendaDate = (raw?: string | null): Date | null => {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();

  // ISO
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return new Date(iso);

  // YYYY-MM-DD HH:mm[:ss]
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const [, y, mo, d, hh, mm, ss] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), ss ? Number(ss) : 0);
  }

  // YYYY-MM-DD
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d), 0, 0, 0);
  }

  // fallback
  if (s.includes(' ')) {
    const tryAlt = Date.parse(s.replace(' ', 'T'));
    if (!Number.isNaN(tryAlt)) return new Date(tryAlt);
  }
  return null;
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

/** ================== Normalizadores / Sede ================== */
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

/** ================== Tipos ================== */
type DayPoint = { key: string; label: string; count: number; when: 'past' | 'today' | 'future' };

const COLORS = {
  past: '#2563EB',   // blue-600
  today: '#16A34A',  // green-600
  future: '#A855F7', // purple-600
  barHover: '#7C3AED', // violet-600
};

export const Resultados: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔎 Filtro principal requerido: agenda_ciudad_sede
  const [sedeFilter, setSedeFilter] = useState<string>('ALL');

  // 🔍 búsqueda opcional
  const [search, setSearch] = useState<string>('');

  // 📊 selección de barra (día) para mostrar lista detallada
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // 🔧 Modal
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

      setClients(prev => prev.map(c => (c.row_number === detail.row_number ? ({ ...c, ...detail } as Client) : c)));
      setViewClient(v => (v && detail && v.row_number === detail.row_number ? ({ ...v, ...detail } as Client) : v));
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

  /** === Validación de fecha y sede === */
  const withValidDate = useMemo(() => {
    return clients.filter(c => !!parseAgendaDate((c as any).fecha_agenda));
  }, [clients]);

  /** === Sedes únicas para el filtro (agenda_ciudad_sede) === */
  const sedes = useMemo(() => {
    const s = new Set<string>();
    withValidDate.forEach(c => {
      const sede = (c as any).agenda_ciudad_sede ? String((c as any).agenda_ciudad_sede).trim() : '';
      if (sede && !isInvalidNoAplica(sede)) s.add(sede);
    });
    return ['ALL', ...Array.from(s).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))];
  }, [withValidDate]);

  /** === Filtrado base por sede + búsqueda === */
  const filtered = useMemo(() => {
    let data = withValidDate;

    if (sedeFilter !== 'ALL') {
      const nf = normalize(sedeFilter);
      data = data.filter(c => normalize(String((c as any).agenda_ciudad_sede || '')) === nf);
    }

    if (search.trim()) {
      const q = normalize(search.trim());
      data = data.filter(c => {
        const nombre = normalize(String(c.nombre || ''));
        const modelo = normalize(String(c.modelo || ''));
        const ciudad = normalize(String(c.ciudad || ''));
        const sede = normalize(String((c as any).agenda_ciudad_sede || ''));
        const tel = String(c.whatsapp || '').replace('@s.whatsapp.net', '');
        return nombre.includes(q) || modelo.includes(q) || ciudad.includes(q) || sede.includes(q) || tel.includes(q);
      });
    }
    return data;
  }, [withValidDate, sedeFilter, search]);

  /** === Serie por día (TODOS: pasado y futuro) === */
  const series: DayPoint[] = useMemo(() => {
    const map = new Map<string, DayPoint>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const c of filtered) {
      const d = parseAgendaDate((c as any).fecha_agenda);
      if (!d) continue;

      const key = toYMD(d);
      const stamp = new Date(d);
      stamp.setHours(0, 0, 0, 0);

      let when: DayPoint['when'] = 'past';
      if (sameLocalDay(stamp, today)) when = 'today';
      else if (stamp > today) when = 'future';

      const label = d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });

      if (!map.has(key)) map.set(key, { key, label, count: 0, when });
      map.get(key)!.count += 1;
    }

    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [filtered]);

  /** === Lista de agendas del día seleccionado === */
  const selectedItems = useMemo(() => {
    if (!selectedKey) return [];
    const day = new Date(selectedKey + 'T00:00:00');

    return filtered
      .filter(c => {
        const d = parseAgendaDate((c as any).fecha_agenda);
        return d ? sameLocalDay(d, day) : false;
      })
      .sort((a, b) => {
        const ta = parseAgendaDate((a as any).fecha_agenda)?.getTime() ?? 0;
        const tb = parseAgendaDate((b as any).fecha_agenda)?.getTime() ?? 0;
        return ta - tb;
      });
  }, [filtered, selectedKey]);

  /** === Helpers UI === */
  const handleWhatsAppClick = (whatsapp: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const phoneNumber = (whatsapp || '').replace('@s.whatsapp.net', '');
    const url = `https://wa.me/${phoneNumber}`;
    window.open(url, '_blank');
  };

  const legendPayload = [
    { value: 'Pasado', type: 'square', color: COLORS.past, id: 'past' },
    { value: 'Hoy', type: 'square', color: COLORS.today, id: 'today' },
    { value: 'Futuro', type: 'square', color: COLORS.future, id: 'future' },
  ];

  /** === Render === */
  return (
    <div className="space-y-6">
      {/* Header / Filtros */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/40 p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Resultados de Agendas</h2>
              <p className="text-sm text-gray-500">Reporte de agendas por día (pasado y futuro)</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            {/* Filtro sede (agenda_ciudad_sede) */}
            <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-purple-50 p-3 rounded-xl border border-indigo-200">
              <span className="text-sm font-medium text-indigo-700">Sede (agenda_ciudad_sede):</span>
              <select
                value={sedeFilter}
                onChange={(e) => {
                  setSedeFilter(e.target.value);
                  setSelectedKey(null);
                }}
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
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedKey(null);
                }}
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

      {/* Gráfica */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/40 p-6">
        {loading ? (
          <div className="py-12 text-center text-gray-600">Cargando datos…</div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">{error}</div>
        ) : series.length ? (
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip
                  formatter={(value: any) => [value, 'Agendas']}
                  labelFormatter={(label: any, payload: any) =>
                    payload?.[0]?.payload?.key ||
                    new Date().toLocaleDateString()
                  }
                />
                <Legend payload={legendPayload} />
                <Bar
                  dataKey="count"
                  name="Agendas"
                  onClick={(entry: any) => setSelectedKey(entry?.key ?? null)}
                  isAnimationActive
                >
                  {series.map((s) => (
                    <Cell
                      key={s.key}
                      cursor="pointer"
                      fill={
                        selectedKey === s.key
                          ? COLORS.barHover
                          : s.when === 'today'
                          ? COLORS.today
                          : s.when === 'future'
                          ? COLORS.future
                          : COLORS.past
                      }
                    />
                  ))}
                </Bar>
                {series.length > 24 && <Brush dataKey="label" height={24} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-12 text-center text-gray-500">No hay datos para mostrar.</div>
        )}
      </div>

      {/* KPIs rápidos */}
      {!loading && !error && !!series.length && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/90 rounded-2xl border border-white/40 shadow p-5">
            <p className="text-sm text-gray-500">Total agendas</p>
            <p className="text-3xl font-semibold">{series.reduce((a, b) => a + b.count, 0)}</p>
          </div>
          <div className="bg-white/90 rounded-2xl border border-white/40 shadow p-5">
            <p className="text-sm text-gray-500">Días con actividad</p>
            <p className="text-3xl font-semibold">{series.length}</p>
          </div>
          <div className="bg-white/90 rounded-2xl border border-white/40 shadow p-5">
            <p className="text-sm text-gray-500">Pico por día</p>
            <p className="text-3xl font-semibold">
              {Math.max(...series.map(s => s.count))}
            </p>
          </div>
        </div>
      )}

      {/* Lista detallada del día seleccionado */}
      {!!selectedKey && (
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
                        <span><strong>Modelo:</strong> {client.modelo || 'N/A'}</span>
                        <span><strong>Ciudad:</strong> {client.ciudad || 'N/A'}</span>
                        <span className="inline-flex items-center text-purple-600">
                          <Clock className="w-4 h-4 mr-1" />
                          {displayDate((client as any).fecha_agenda)}
                        </span>
                      </div>

                      {client.intencion && (
                        <p className="text-sm text-gray-600 mt-1">
                          <strong>Intención:</strong> {client.intencion}
                        </p>
                      )}
                      {client.notas && (
                        <p className="text-sm text-gray-600 mt-1">
                          <strong>Notas:</strong> {client.notas}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <button
                        onClick={(e) => handleWhatsAppClick(client.whatsapp as any, e)}
                        className="flex items-center text-green-600 hover:text-green-700 font-medium transition-colors duration-300 group mb-2 ml-auto"
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        <span className="text-sm">{formatWhatsApp(client.whatsapp as any)}</span>
                      </button>

                      <div className="flex items-center gap-2 justify-end">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border-2 shadow-sm ${getEtapaColor(client.estado_etapa as any)}`}
                        >
                          {(client.estado_etapa || 'Sin_estado').replace(/_/g, ' ')}
                        </span>
                        {client.categoria_contacto && (
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm ${getCategoriaColor(client.categoria_contacto as any)}`}
                          >
                            {(client.categoria_contacto as string).replace(/_/g, ' ')}
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
