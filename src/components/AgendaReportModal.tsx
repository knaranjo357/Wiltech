import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  MapPin,
  Percent,
  User,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Client } from '../types/client';
import { normalize, safeText } from '../utils/textUtils';
import {
  getReportPeriod,
  isDateWithinReportRange,
  REPORT_GROUPING_META,
  ReportDateFilters,
  type ReportGrouping,
} from './ReportDateFilters';

type AgendaPeriod = {
  key: string;
  label: string;
  agendas: number;
  evaluables: number;
  asistieron: number;
  sinRegistrar: number;
  proximas: number;
  porcentajeAsistencia: number | null;
};

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
  iconClassName: string;
};

const formatPercent = (value: number | null) =>
  value === null
    ? '—'
    : `${value.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%`;

const parseAgendaReportDate = (raw: unknown): Date | null => {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;

  if (typeof raw === 'number') {
    const date = new Date(raw < 10_000_000_000 ? raw * 1000 : raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const value = String(raw ?? '').trim();
  if (!value) return null;

  // Se resuelve el formato local antes de Date.parse para proteger la agrupación mensual.
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
    <div className="flex items-start justify-between gap-3">
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

const SOURCE_TO_CITY: Record<string, string> = {
  wiltech: 'Bogotá',
  wiltechbga: 'Bucaramanga',
};

const getAgendaCity = (client: Client): string => {
  const assignedCity = safeText(client.agenda_ciudad_sede);
  if (assignedCity) return assignedCity;

  const cityFromSource = SOURCE_TO_CITY[normalize(safeText(client.source))];
  return cityFromSource || safeText(client.ciudad);
};
interface AgendaReportModalProps {
  clients: Client[];
  isOpen: boolean;
  onClose: () => void;
  selectedSede?: string | null;
}

export const AgendaReportModal: React.FC<AgendaReportModalProps> = ({ clients, isOpen, onClose, selectedSede }) => {
  const [selectedCity, setSelectedCity] = useState('Todas');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [grouping, setGrouping] = useState<ReportGrouping>('month');
  const openedRef = useRef(false);

  const cities = useMemo(() => {
    const cityMap = new Map<string, string>();
    clients.forEach((client) => {
      const city = getAgendaCity(client);
      const cityKey = normalize(city);
      if (cityKey && !cityMap.has(cityKey)) cityMap.set(cityKey, city);
    });
    return Array.from(cityMap.values()).sort((a, b) => a.localeCompare(b, 'es-CO'));
  }, [clients]);

  useEffect(() => {
    if (!isOpen) {
      openedRef.current = false;
      return;
    }
    if (openedRef.current) return;

    openedRef.current = true;
    const selectedCityKey = normalize(selectedSede);
    const matchingCity = cities.find((city) => normalize(city) === selectedCityKey);
    setSelectedCity(matchingCity ?? 'Todas');
  }, [cities, isOpen, selectedSede]);

  const cityFilteredClients = useMemo(() => {
    if (selectedCity === 'Todas') return clients;
    const selectedCityKey = normalize(selectedCity);
    return clients.filter((client) => normalize(getAgendaCity(client)) === selectedCityKey);
  }, [clients, selectedCity]);

  const reportClients = useMemo(() => cityFilteredClients.filter((client) => {
    const agendaDate = parseAgendaReportDate(client.fecha_agenda);
    return agendaDate ? isDateWithinReportRange(agendaDate, dateFrom, dateTo) : false;
  }), [cityFilteredClients, dateFrom, dateTo]);

  const report = useMemo(() => {
    const now = new Date();
    const buckets = new Map<string, Omit<AgendaPeriod, 'porcentajeAsistencia'>>();

    reportClients.forEach((client) => {
      const agendaDate = parseAgendaReportDate(client.fecha_agenda);
      if (!agendaDate) return;

      const period = getReportPeriod(agendaDate, grouping);
      const key = period.key;
      const current = buckets.get(key) ?? {
        key,
        label: period.label,
        agendas: 0,
        evaluables: 0,
        asistieron: 0,
        sinRegistrar: 0,
        proximas: 0,
      };

      const isElapsed = agendaDate.getTime() <= now.getTime();
      const attended = client.asistio_agenda === true;

      current.agendas += 1;
      if (isElapsed) {
        current.evaluables += 1;
        if (attended) current.asistieron += 1;
        else current.sinRegistrar += 1;
      } else {
        current.proximas += 1;
      }
      buckets.set(key, current);
    });

    const periods = Array.from(buckets.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((period) => ({
        ...period,
        porcentajeAsistencia: period.evaluables
          ? (period.asistieron / period.evaluables) * 100
          : null,
      }));

    const totalAgendas = periods.reduce((total, period) => total + period.agendas, 0);
    const evaluables = periods.reduce((total, period) => total + period.evaluables, 0);
    const asistieron = periods.reduce((total, period) => total + period.asistieron, 0);
    const sinRegistrar = periods.reduce((total, period) => total + period.sinRegistrar, 0);
    const proximas = periods.reduce((total, period) => total + period.proximas, 0);

    return {
      periods,
      chartData: periods.slice(-24),
      totalAgendas,
      evaluables,
      asistieron,
      sinRegistrar,
      proximas,
      porcentajeAsistencia: evaluables ? (asistieron / evaluables) * 100 : null,
    };
  }, [grouping, reportClients]);

  const groupingMeta = REPORT_GROUPING_META[grouping];

  useEffect(() => {
    if (!isOpen) return undefined;

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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200 sm:p-6"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-label="Reporte de agendas"
        aria-modal="true"
        className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] bg-slate-50 shadow-2xl ring-1 ring-black/10"
        role="dialog"
      >
        <header className="relative shrink-0 overflow-hidden bg-gradient-to-br from-black via-zinc-900 to-zinc-800 px-5 pb-7 pt-5 sm:px-7">
          <div className="absolute -right-8 -top-10 h-44 w-44 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-20 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white shadow-lg shadow-black/20">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">Seguimiento comercial</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">Reporte de agendas</h2>
                <p className="mt-1 text-xs font-medium text-slate-300">Asistencia histórica de todas las citas cargadas en Agenda.</p>
              </div>
            </div>
            <button
              aria-label="Cerrar reporte de agendas"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-slate-300 transition hover:bg-white/20 hover:text-white active:scale-95"
              onClick={onClose}
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="relative mt-5 flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-blue-100">
              <MapPin className="h-3.5 w-3.5" />
              <span>Filtrar por ciudad</span>
            </div>
            <div className="relative w-full sm:w-[230px]">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-200" />
              <select
                aria-label="Filtrar reporte por ciudad"
                className="w-full appearance-none rounded-xl border border-white/15 bg-slate-900/70 py-2.5 pl-9 pr-9 text-xs font-bold text-white outline-none transition hover:bg-slate-800 focus:ring-2 focus:ring-blue-300/60"
                onChange={(event) => setSelectedCity(event.target.value)}
                value={selectedCity}
              >
                <option className="bg-white text-slate-900" value="Todas">Todas las ciudades</option>
                {cities.map((city) => (
                  <option className="bg-white text-slate-900" key={city} value={city}>{city}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-200" />
            </div>
          </div>        </header>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <ReportDateFilters
            dateFrom={dateFrom}
            dateTo={dateTo}
            grouping={grouping}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onGroupingChange={setGrouping}
            onReset={() => {
              setDateFrom('');
              setDateTo('');
              setGrouping('month');
            }}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              detail="Citas con fecha válida dentro del histórico cargado."
              icon={CalendarDays}
              iconClassName="bg-slate-100 text-slate-700"
              label="Agendas registradas"
              value={report.totalAgendas.toLocaleString('es-CO')}
            />
            <MetricCard
              detail="Citas transcurridas que fueron marcadas como asistidas."
              icon={CheckCircle2}
              iconClassName="bg-emerald-50 text-emerald-600"
              label="Asistieron"
              value={report.asistieron.toLocaleString('es-CO')}
            />
            <MetricCard
              detail="Asistieron sobre las citas cuya fecha ya transcurrió."
              icon={Percent}
              iconClassName="bg-blue-50 text-blue-600"
              label="Tasa de asistencia"
              value={formatPercent(report.porcentajeAsistencia)}
            />
            <MetricCard
              detail={`${report.proximas.toLocaleString('es-CO')} citas futuras no se incluyen en la tasa.`}
              icon={Clock}
              iconClassName="bg-amber-50 text-amber-600"
              label="Sin registrar"
              value={report.sinRegistrar.toLocaleString('es-CO')}
            />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-slate-800">
                    <CalendarDays className="h-4 w-4 text-blue-500" />
                    <h3 className="text-sm font-black">Asistencia {groupingMeta.label.toLowerCase()}</h3>
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-slate-500">
                    {report.periods.length > report.chartData.length
                      ? `La gráfica muestra las últimas ${report.chartData.length} agrupaciones; el detalle contiene todo el rango.`
                      : 'Las citas futuras quedan fuera del porcentaje de asistencia.'}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {report.periods.length} {groupingMeta.plural}
                </span>
              </div>

              {report.chartData.length ? (
                <div className="h-[290px] w-full">
                  <ResponsiveContainer height="100%" width="100%">
                    <ComposedChart data={report.chartData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
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
                        yAxisId="count"
                      />
                      <YAxis
                        axisLine={false}
                        domain={[0, 100]}
                        orientation="right"
                        tick={{ fill: '#60a5fa', fontSize: 10 }}
                        tickFormatter={(value: number) => `${value}%`}
                        tickLine={false}
                        yAxisId="rate"
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 12px 26px rgba(15, 23, 42, 0.12)' }}
                        cursor={{ fill: '#f8fafc' }}
                        labelStyle={{ color: '#334155', fontWeight: 800 }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                      <Bar dataKey="asistieron" fill="#10b981" name="Asistieron" radius={[7, 7, 0, 0]} stackId="attendance" yAxisId="count" />
                      <Bar dataKey="sinRegistrar" fill="#fbbf24" name="Sin registrar" radius={[7, 7, 0, 0]} stackId="attendance" yAxisId="count" />
                      <Line
                        activeDot={{ r: 5 }}
                        connectNulls={false}
                        dataKey="porcentajeAsistencia"
                        dot={{ r: 3 }}
                        name="% asistencia"
                        stroke="#2563eb"
                        strokeWidth={2.5}
                        type="monotone"
                        yAxisId="rate"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-[290px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
                  <CalendarDays className="h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-bold text-slate-500">Aún no hay agendas con fecha para graficar.</p>
                </div>
              )}
            </div>

            <aside className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                <User className="h-5 w-5" />
              </div>
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Citas evaluables</p>
              <p className="mt-1 text-4xl font-black tracking-tight text-slate-900">{report.evaluables.toLocaleString('es-CO')}</p>
              <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600">citas ya transcurrieron y pueden aportar a la tasa de asistencia.</p>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-black to-slate-500 transition-all duration-500"
                  style={{ width: `${Math.min(Math.max(report.porcentajeAsistencia ?? 0, 0), 100)}%` }}
                />
              </div>
              <p className="mt-3 text-[10px] font-bold text-slate-400">“Sin registrar” no significa inasistencia: todavía no fue marcado.</p>
            </aside>
          </div>

          {report.periods.length > 0 && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Detalle {groupingMeta.label.toLowerCase()}</h3>
                  <p className="mt-1 text-[11px] font-medium text-slate-500">El porcentaje solo toma las citas que ya ocurrieron.</p>
                </div>
              </div>
              <div className="custom-scrollbar max-h-[260px] overflow-auto">
                <table className="min-w-[760px] w-full text-left">
                  <thead className="sticky top-0 bg-slate-50/95 text-[10px] font-black uppercase tracking-wider text-slate-400 backdrop-blur">
                    <tr>
                      <th className="px-4 py-3 sm:px-5">{groupingMeta.singular}</th>
                      <th className="px-4 py-3 text-right">Agendas</th>
                      <th className="px-4 py-3 text-right">Asistieron</th>
                      <th className="px-4 py-3 text-right">Sin registrar</th>
                      <th className="px-4 py-3 text-right sm:px-5">Tasa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {[...report.periods].reverse().map((period) => (
                      <tr className="transition-colors hover:bg-slate-50/70" key={period.key}>
                        <td className="px-4 py-3 font-bold capitalize text-slate-700 sm:px-5">{period.label}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-600">{period.agendas.toLocaleString('es-CO')}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{period.asistieron.toLocaleString('es-CO')}</td>
                        <td className="px-4 py-3 text-right font-semibold text-amber-600">
                          {period.sinRegistrar.toLocaleString('es-CO')}
                          {period.proximas > 0 && <span className="ml-1 text-[10px] text-slate-400">+{period.proximas} próxima{period.proximas === 1 ? '' : 's'}</span>}
                        </td>
                        <td className="px-4 py-3 text-right sm:px-5">
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-600">{formatPercent(period.porcentajeAsistencia)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
};
