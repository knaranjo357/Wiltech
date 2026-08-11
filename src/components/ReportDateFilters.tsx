import React from 'react';
import { CalendarRange, ChevronDown, RotateCcw } from 'lucide-react';

export type ReportGrouping = 'day' | 'week' | 'month' | 'year';

export const REPORT_GROUPING_META: Record<
  ReportGrouping,
  { label: string; singular: string; plural: string }
> = {
  day: { label: 'Por día', singular: 'Día', plural: 'días' },
  week: { label: 'Por semana', singular: 'Semana', plural: 'semanas' },
  month: { label: 'Por mes', singular: 'Mes', plural: 'meses' },
  year: { label: 'Por año', singular: 'Año', plural: 'años' },
};

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const getWeekStart = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
};

export const getReportPeriod = (date: Date, grouping: ReportGrouping) => {
  if (grouping === 'day') {
    return {
      key: formatDateKey(date),
      label: date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }),
    };
  }

  if (grouping === 'week') {
    const weekStart = getWeekStart(date);
    return {
      key: formatDateKey(weekStart),
      label: `Semana del ${weekStart.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    };
  }

  if (grouping === 'year') {
    const year = String(date.getFullYear());
    return { key: year, label: year };
  }

  return {
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    label: date.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }),
  };
};

const parseInputDate = (value: string, endOfDay: boolean): Date | null => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
};

export const isDateWithinReportRange = (date: Date, from: string, to: string) => {
  const fromDate = parseInputDate(from, false);
  const toDate = parseInputDate(to, true);
  if (fromDate && date.getTime() < fromDate.getTime()) return false;
  if (toDate && date.getTime() > toDate.getTime()) return false;
  return true;
};

interface ReportDateFiltersProps {
  dateFrom: string;
  dateTo: string;
  grouping: ReportGrouping;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onGroupingChange: (value: ReportGrouping) => void;
  onReset: () => void;
}

export const ReportDateFilters: React.FC<ReportDateFiltersProps> = ({
  dateFrom,
  dateTo,
  grouping,
  onDateFromChange,
  onDateToChange,
  onGroupingChange,
  onReset,
}) => {
  const hasCustomFilters = Boolean(dateFrom || dateTo || grouping !== 'month');

  return (
    <div className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-slate-700">
        <CalendarRange className="h-4 w-4 text-blue-500" />
        <span className="text-[10px] font-black uppercase tracking-[0.16em]">Rango y agrupación</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Desde</span>
          <input
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
            max={dateTo || undefined}
            onChange={(event) => onDateFromChange(event.target.value)}
            type="date"
            value={dateFrom}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Hasta</span>
          <input
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
            min={dateFrom || undefined}
            onChange={(event) => onDateToChange(event.target.value)}
            type="date"
            value={dateTo}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Agrupar</span>
          <div className="relative">
            <select
              className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 pr-9 text-xs font-bold text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
              onChange={(event) => onGroupingChange(event.target.value as ReportGrouping)}
              value={grouping}
            >
              {(Object.keys(REPORT_GROUPING_META) as ReportGrouping[]).map((value) => (
                <option key={value} value={value}>{REPORT_GROUPING_META[value].label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </label>
        <button
          className="mt-auto flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-[10px] font-black uppercase tracking-wider text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 disabled:cursor-default disabled:opacity-40"
          disabled={!hasCustomFilters}
          onClick={onReset}
          type="button"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Limpiar
        </button>
      </div>
    </div>
  );
};
