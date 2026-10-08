import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Percent,
  Truck,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Client } from '../types/client';
import { Pagination } from './Pagination';
import { usePagination } from '../hooks/usePagination';
import { isMexicoEnvioGestionado, mexicoText as safeText } from '../utils/enviosMexico';
import {
  getReportPeriod,
  isDateWithinReportRange,
  REPORT_GROUPING_META,
  type ReportGrouping,
} from '../utils/reportDates';
import { ReportDateFilters } from './ReportDateFilters';

type ShipmentPeriod = {
  key: string;
  label: string;
  envios: number;
  gestionadosPlataforma: number;
  porcentajeGestionado: number;
};

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
  iconClassName: string;
};

const formatPercent = (value: number) =>
  `${value.toLocaleString('es-MX', { maximumFractionDigits: 1 })}%`;

const parseReportDate = (raw: unknown): Date | null => {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;

  if (typeof raw === 'number') {
    const date = new Date(raw < 10_000_000_000 ? raw * 1000 : raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const value = safeText(raw);
  if (!value) return null;

  // Las fechas sin zona se interpretan como locales para no desplazar el mes.
  const localMatch = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T]+(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (localMatch) {
    const [, year, month, day, hour = '0', minute = '0', second = '0'] = localMatch;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const MetricCard = ({ icon: Icon, label, value, detail, iconClassName }: MetricCardProps) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
    <div className="flex flex-col-reverse items-start justify-between gap-2 sm:flex-row sm:gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
        <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</p>
      </div>
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClassName}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
    <p className="mt-3 text-[11px] font-medium leading-relaxed text-slate-500">{detail}</p>
  </div>
);

interface EnviosMexicoReportModalProps {
  clients: Client[];
  isOpen: boolean;
  onClose: () => void;
  onOpenClient: (client: Client) => void;
  isClientOpen: boolean;
}

export const EnviosMexicoReportModal: React.FC<EnviosMexicoReportModalProps> = ({ clients, isOpen, onClose, onOpenClient, isClientOpen }) => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [grouping, setGrouping] = useState<ReportGrouping>('month');
  const [selectedPeriodKey, setSelectedPeriodKey] = useState('');
  const [onlyPlatform, setOnlyPlatform] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  const filteredClients = useMemo(() => {
    const hasDateRange = Boolean(dateFrom || dateTo);
    return clients.filter((client) => {
      const createdAt = parseReportDate(client.created);
      if (!createdAt) return !hasDateRange;
      return isDateWithinReportRange(createdAt, dateFrom, dateTo);
    });
  }, [clients, dateFrom, dateTo]);

  const summary = useMemo(() => {
    const total = filteredClients.length;
    const managedByPlatform = filteredClients.filter(isMexicoEnvioGestionado).length;
    const notManagedByPlatform = total - managedByPlatform;
    const managementRate = total ? (managedByPlatform / total) * 100 : 0;

    return { total, managedByPlatform, notManagedByPlatform, managementRate };
  }, [filteredClients]);

  const periodData = useMemo<ShipmentPeriod[]>(() => {
    const buckets = new Map<string, Omit<ShipmentPeriod, 'porcentajeGestionado'>>();

    filteredClients.forEach((client) => {
      const createdAt = parseReportDate(client.created);
      if (!createdAt) return;

      const period = getReportPeriod(createdAt, grouping);
      const key = period.key;
      const current = buckets.get(key) ?? {
        key,
        label: period.label,
        envios: 0,
        gestionadosPlataforma: 0,
      };

      current.envios += 1;
      if (isMexicoEnvioGestionado(client)) current.gestionadosPlataforma += 1;
      buckets.set(key, current);
    });

    return Array.from(buckets.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((period) => ({
        ...period,
        porcentajeGestionado: period.envios
          ? (period.gestionadosPlataforma / period.envios) * 100
          : 0,
      }));
  }, [filteredClients, grouping]);

  const chartData = periodData.slice(-24);
  const groupingMeta = REPORT_GROUPING_META[grouping];
  const selectedPeriod = periodData.find(period => period.key === selectedPeriodKey);
  const detailClients = useMemo(() => filteredClients.filter(client => {
    if (onlyPlatform && !isMexicoEnvioGestionado(client)) return false;
    if (!selectedPeriod) return true;
    const createdAt = parseReportDate(client.created);
    return createdAt !== null && getReportPeriod(createdAt, grouping).key === selectedPeriod.key;
  }), [filteredClients, grouping, selectedPeriod, onlyPlatform]);
  const pagination = usePagination(detailClients, JSON.stringify([dateFrom, dateTo, grouping, selectedPeriod?.key, onlyPlatform]));

  const selectPeriod = (key: string, platformOnly = false) => {
    setSelectedPeriodKey(key);
    setOnlyPlatform(platformOnly);
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (!isOpen || isClientOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isClientOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={`wt-shipping-report fixed inset-0 z-[160] bg-slate-50 ${isClientOpen ? 'invisible pointer-events-none' : ''}`}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-label="Reporte de envíos México · DHL"
        aria-modal="true"
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-50"
        role="dialog"
      >
        <header className="relative shrink-0 overflow-hidden bg-gradient-to-br from-black via-zinc-900 to-zinc-800 p-4 sm:px-7 sm:pb-7 sm:pt-5">
          <div className="absolute -right-8 -top-10 h-44 w-44 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-20 w-56 rounded-full bg-white/5 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white shadow-lg shadow-black/20 sm:flex">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <p className="hidden text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200 sm:block">Control logístico</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">Reporte de envíos México · DHL</h2>
                <p className="mt-1 text-xs font-medium text-slate-300">Actividad y estados registrados.</p>
              </div>
            </div>
            <button
              aria-label="Cerrar reporte de envíos"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-slate-300 transition hover:bg-white/20 hover:text-white active:scale-95"
              onClick={onClose}
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <ReportDateFilters
            dateFrom={dateFrom}
            dateTo={dateTo}
            grouping={grouping}
            onDateFromChange={(value) => { setDateFrom(value); setSelectedPeriodKey(''); }}
            onDateToChange={(value) => { setDateTo(value); setSelectedPeriodKey(''); }}
            onGroupingChange={(value) => { setGrouping(value); setSelectedPeriodKey(''); }}
            onReset={() => {
              setDateFrom('');
              setDateTo('');
              setGrouping('month');
              setSelectedPeriodKey('');
              setOnlyPlatform(false);
            }}
          />

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard
              detail="Registros que hoy pertenecen al flujo de logística."
              icon={Truck}
              iconClassName="bg-slate-100 text-slate-700"
              label="Envíos registrados"
              value={summary.total.toLocaleString('es-MX')}
            />
            <MetricCard
              detail="Envíos identificados como con estado gestionado registrado."
              icon={CheckCircle2}
              iconClassName="bg-emerald-50 text-emerald-600"
              label="Gestionados registrados"
              value={summary.managedByPlatform.toLocaleString('es-MX')}
            />
            <MetricCard
              detail="Proporción de envíos con estado gestionado registrado."
              icon={Percent}
              iconClassName="bg-indigo-50 text-indigo-600"
              label="Tasa de gestión"
              value={formatPercent(summary.managementRate)}
            />
            <MetricCard
              detail="Registros que aún no tienen esa gestión registrada."
              icon={ClipboardCheck}
              iconClassName="bg-amber-50 text-amber-600"
              label="Pendientes / otros estados"
              value={summary.notManagedByPlatform.toLocaleString('es-MX')}
            />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-slate-800">
                    <CalendarDays className="h-4 w-4 text-indigo-500" />
                    <h3 className="text-sm font-black">Evolución {groupingMeta.label.toLowerCase()}</h3>
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-slate-500">
                    {periodData.length > chartData.length
                      ? `La gráfica muestra las últimas ${chartData.length} agrupaciones; puedes elegir cualquier período en el listado.`
                      : 'Datos agrupados por fecha de creación dentro del rango seleccionado.'}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-indigo-600">Haz clic en una barra para ver sus envíos. La barra verde muestra los con estado gestionado registrado.</p>
                </div>
                <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {periodData.length} {groupingMeta.plural}
                </span>
              </div>

              {chartData.length ? (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer height="100%" width="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
                      <CartesianGrid stroke="#eef2f7" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        axisLine={false}
                        dataKey="label"
                        minTickGap={18}
                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 12px 26px rgba(15, 23, 42, 0.12)' }}
                        cursor={{ fill: '#f8fafc' }}
                        labelStyle={{ color: '#334155', fontWeight: 800 }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                      <Bar dataKey="envios" fill="#334155" name="Envíos registrados" radius={[7, 7, 0, 0]} cursor="pointer" onClick={(_, index) => selectPeriod(chartData[index].key)} />
                      <Bar dataKey="gestionadosPlataforma" fill="#10b981" name="Gestionados registrados" radius={[7, 7, 0, 0]} cursor="pointer" onClick={(_, index) => selectPeriod(chartData[index].key, true)} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
                  <CalendarDays className="h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-bold text-slate-500">Aún no hay fechas de creación para graficar.</p>
                </div>
              )}
            </div>

            <aside className="hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm xl:block">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Indicador principal</p>
              <p className="mt-1 text-4xl font-black tracking-tight text-slate-900">{formatPercent(summary.managementRate)}</p>
              <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600">de los envíos registrados ya fueron con estado gestionado registrado.</p>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-black to-slate-500 transition-all duration-500"
                  style={{ width: `${Math.min(Math.max(summary.managementRate, 0), 100)}%` }}
                />
              </div>
              <p className="mt-3 text-[11px] text-slate-500">Las fechas corresponden a la creación del registro, no a la generación de la guía: esa fecha no está disponible.</p>
            </aside>
          </div>

            <div ref={detailRef} className="mt-5 scroll-mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-5">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Envíos y guías · {selectedPeriod?.label || 'Todo el rango'}</h3>
                  <p role="status" className="mt-1 text-xs text-slate-500">{detailClients.length} registros{onlyPlatform ? ' con estado gestionado registrado' : ''}. Abre un caso para consultar toda su información.</p>
                  <p className="mt-1 text-xs text-slate-500">Se usa la fecha de creación del registro; la fecha de generación de la guía no está disponible.</p>
                </div>
                <div className="flex w-full min-w-0 flex-wrap items-center gap-3 sm:w-auto">
                  <label className="flex w-full min-w-0 flex-col gap-2 text-xs font-semibold text-slate-600 sm:w-auto sm:flex-row sm:items-center">
                    Período
                    <select aria-label="Período de los envíos" className="rounded-lg border border-slate-200 p-2" value={selectedPeriod?.key || ''} onChange={event => setSelectedPeriodKey(event.target.value)}>
                      <option value="">Todo el rango</option>
                      {[...periodData].reverse().map(period => <option key={period.key} value={period.key}>{period.label}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                    <input type="checkbox" checked={onlyPlatform} onChange={event => setOnlyPlatform(event.target.checked)} />
                    Solo gestionados registrados
                  </label>
                </div>
              </div>
              <div className="divide-y divide-slate-100 md:hidden">
                {pagination.items.map(client => (
                  <article key={client.row_number} className="space-y-3 p-4">
                    <div>
                      <h4 className="break-words text-sm font-bold text-slate-900">{safeText(client.guia_nombre_completo) || 'No registrado'}</h4>
                      <p className="mt-1 text-xs text-slate-500">{safeText(client.guia_telefono) || 'No registrado'}</p>
                      <p className={`mt-1 text-xs ${isMexicoEnvioGestionado(client) ? 'font-semibold text-emerald-700' : 'text-slate-500'}`}>{isMexicoEnvioGestionado(client) ? 'Gestionado registrado' : 'Otra gestión / pendiente'}</p>
                      <p className="mt-1 text-xs text-slate-500">{safeText(client.estado_envio) || safeText(client.estado_etapa) || 'No registrado'}</p>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                      <div className="min-w-0"><dt className="text-slate-500">Guía de ida</dt><dd className="mt-1 break-all font-mono font-semibold">{safeText(client.guia_numero_ida) || 'No registrado'}</dd></div>
                      <div className="min-w-0"><dt className="text-slate-500">Guía de retorno</dt><dd className="mt-1 break-all font-mono font-semibold">{safeText(client.guia_numero_retorno) || 'No registrado'}</dd></div>
                      <div className="col-span-2"><dt className="text-slate-500">Origen / dirección</dt><dd className="mt-1 break-words">{[safeText(client.guia_ciudad), safeText(client.guia_departamento_estado), safeText(client.guia_direccion)].filter(Boolean).join(' · ') || 'No registrado'}</dd></div>
                      <div className="col-span-2"><dt className="text-slate-500">Creación del registro</dt><dd className="mt-1">{parseReportDate(client.created)?.toLocaleString('es-MX') || 'No registrado'}</dd></div>
                    </dl>
                    <button type="button" onClick={() => onOpenClient(client)} className="min-h-11 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700">Abrir caso</button>
                  </article>
                ))}
              </div>
              <div className="custom-scrollbar hidden overflow-x-auto md:block">
                <table className="min-w-[1000px] w-full text-left">
                  <thead className="sticky top-0 bg-slate-50/95 text-[10px] font-black uppercase tracking-wider text-slate-400 backdrop-blur">
                    <tr>
                      <th className="px-4 py-3">Cliente / contacto</th>
                      <th className="px-4 py-3">Creación del registro</th>
                      <th className="px-4 py-3">Origen / dirección</th>
                      <th className="px-4 py-3">Guía de ida</th>
                      <th className="px-4 py-3">Guía de retorno</th>
                      <th className="px-4 py-3">Gestión / estado</th>
                      <th className="px-4 py-3">Caso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {pagination.items.map((client) => (
                      <tr className="transition-colors hover:bg-slate-50/70" key={client.row_number}>
                        <td className="px-4 py-3 text-slate-700">
                          <p className="font-bold">{safeText(client.guia_nombre_completo) || 'No registrado'}</p>
                          <p className="mt-1 text-xs">{safeText(client.guia_telefono) || 'No registrado'}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{parseReportDate(client.created)?.toLocaleString('es-MX') || 'No registrado'}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <p className="font-semibold">{safeText(client.guia_ciudad) || 'No registrado'}</p>
                          <p>{safeText(client.guia_departamento_estado) || 'No registrado'}</p>
                          <p>{safeText(client.guia_direccion) || 'No registrado'}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{safeText(client.guia_numero_ida) || 'No registrado'}</td>
                        <td className="px-4 py-3 font-mono text-xs">{safeText(client.guia_numero_retorno) || 'No registrado'}</td>
                        <td className="px-4 py-3 text-xs">
                          <p className={isMexicoEnvioGestionado(client) ? 'font-bold text-emerald-700' : 'text-slate-500'}>{isMexicoEnvioGestionado(client) ? 'Gestionado registrado' : 'Otra gestión / pendiente'}</p>
                          <p className="mt-1 text-slate-500">{safeText(client.estado_envio) || safeText(client.estado_etapa) || 'No registrado'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => onOpenClient(client)} aria-label={`Abrir caso de ${safeText(client.guia_nombre_completo) || 'No registrado'}`} className="whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">Abrir caso</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!detailClients.length && <p className="p-8 text-center text-sm text-slate-500">No hay envíos para esta selección.</p>}
              <Pagination {...pagination} />
            </div>
        </div>
      </section>
    </div>,
    document.body,
  );
};
