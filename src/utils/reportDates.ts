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
