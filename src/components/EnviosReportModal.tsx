import React, { useEffect, useMemo } from 'react';
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
import { isEnvioGestionadoServientrega, safeText } from '../utils/clientHelpers';

type MonthlyShipment = {
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
  `${value.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%`;

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

const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const getMonthLabel = (date: Date) =>
  date.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });

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

interface EnviosReportModalProps {
  clients: Client[];
  isOpen: boolean;
  onClose: () => void;
}

export const EnviosReportModal: React.FC<EnviosReportModalProps> = ({ clients, isOpen, onClose }) => {
  const summary = useMemo(() => {
    const total = clients.length;
    const managedByPlatform = clients.filter(isEnvioGestionadoServientrega).length;
    const notManagedByPlatform = total - managedByPlatform;
    const managementRate = total ? (managedByPlatform / total) * 100 : 0;

    return { total, managedByPlatform, notManagedByPlatform, managementRate };
  }, [clients]);

  const monthlyData = useMemo<MonthlyShipment[]>(() => {
    const buckets = new Map<string, Omit<MonthlyShipment, 'porcentajeGestionado'>>();

    clients.forEach((client) => {
      const createdAt = parseReportDate(client.created);
      if (!createdAt) return;

      const key = getMonthKey(createdAt);
      const current = buckets.get(key) ?? {
        key,
        label: getMonthLabel(createdAt),
        envios: 0,
        gestionadosPlataforma: 0,
      };

      current.envios += 1;
      if (isEnvioGestionadoServientrega(client)) current.gestionadosPlataforma += 1;
      buckets.set(key, current);
    });

    return Array.from(buckets.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-12)
      .map((month) => ({
        ...month,
        porcentajeGestionado: month.envios
          ? (month.gestionadosPlataforma / month.envios) * 100
          : 0,
      }));
  }, [clients]);

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
        aria-label="Reporte de envíos"
        aria-modal="true"
        className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] bg-slate-50 shadow-2xl ring-1 ring-black/10"
        role="dialog"
      >
        <header className="relative shrink-0 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-800 to-indigo-950 px-5 pb-7 pt-5 sm:px-7">
          <div className="absolute -right-8 -top-10 h-44 w-44 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-20 w-56 rounded-full bg-purple-400/10 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white shadow-lg shadow-black/20">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">Control logístico</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">Reporte de envíos</h2>
                <p className="mt-1 text-xs font-medium text-slate-300">Actividad registrada y gestiones realizadas desde la plataforma.</p>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              detail="Registros que hoy pertenecen al flujo de logística."
              icon={Truck}
              iconClassName="bg-slate-100 text-slate-700"
              label="Envíos registrados"
              value={summary.total.toLocaleString('es-CO')}
            />
            <MetricCard
              detail="Con estado ENVIO_GESTIONADO_SERVIENTREGA."
              icon={CheckCircle2}
              iconClassName="bg-emerald-50 text-emerald-600"
              label="Gestionados plataforma"
              value={summary.managedByPlatform.toLocaleString('es-CO')}
            />
            <MetricCard
              detail="Proporción de envíos gestionados desde la plataforma."
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
              value={summary.notManagedByPlatform.toLocaleString('es-CO')}
            />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-slate-800">
                    <CalendarDays className="h-4 w-4 text-indigo-500" />
                    <h3 className="text-sm font-black">Evolución mensual</h3>
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-slate-500">Últimos 12 meses con actividad, agrupados por fecha de creación.</p>
                </div>
                <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {monthlyData.length} meses
                </span>
              </div>

              {monthlyData.length ? (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer height="100%" width="100%">
                    <BarChart data={monthlyData} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
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
                      <Bar dataKey="envios" fill="#334155" name="Envíos registrados" radius={[7, 7, 0, 0]} />
                      <Bar dataKey="gestionadosPlataforma" fill="#10b981" name="Gestionados plataforma" radius={[7, 7, 0, 0]} />
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

            <aside className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-500">Indicador principal</p>
              <p className="mt-1 text-4xl font-black tracking-tight text-slate-900">{formatPercent(summary.managementRate)}</p>
              <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600">de los envíos registrados ya fueron gestionados desde la plataforma.</p>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-indigo-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.min(Math.max(summary.managementRate, 0), 100)}%` }}
                />
              </div>
              <p className="mt-3 text-[10px] font-bold text-slate-400">El indicador usa únicamente el estado de Servientrega solicitado.</p>
            </aside>
          </div>

          {monthlyData.length > 0 && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Detalle por mes</h3>
                  <p className="mt-1 text-[11px] font-medium text-slate-500">La gestión se identifica con el estado de plataforma.</p>
                </div>
              </div>
              <div className="custom-scrollbar max-h-[260px] overflow-auto">
                <table className="min-w-[650px] w-full text-left">
                  <thead className="sticky top-0 bg-slate-50/95 text-[10px] font-black uppercase tracking-wider text-slate-400 backdrop-blur">
                    <tr>
                      <th className="px-4 py-3 sm:px-5">Mes</th>
                      <th className="px-4 py-3 text-right">Envíos</th>
                      <th className="px-4 py-3 text-right">Gestionados</th>
                      <th className="px-4 py-3 text-right sm:px-5">Tasa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {[...monthlyData].reverse().map((month) => (
                      <tr className="transition-colors hover:bg-slate-50/70" key={month.key}>
                        <td className="px-4 py-3 font-bold capitalize text-slate-700 sm:px-5">{month.label}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-600">{month.envios.toLocaleString('es-CO')}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{month.gestionadosPlataforma.toLocaleString('es-CO')}</td>
                        <td className="px-4 py-3 text-right sm:px-5">
                          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-600">{formatPercent(month.porcentajeGestionado)}</span>
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
