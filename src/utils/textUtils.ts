// src/utils/textUtils.ts
// ─── Utilidades de texto centralizadas ───
// Estas funciones estaban duplicadas en 5+ archivos.
// Ahora viven aquí y se importan desde un solo lugar.

/** Normaliza texto: minúsculas, sin acentos, sin espacios sobrantes */
export const normalize = (s: string | null | undefined): string => {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
};

/** Marcadores de "vacío" que el backend puede enviar */
const EMPTY_MARKERS = new Set([
  '', '-', '—', 'null', 'undefined', 'n/a', 'na', 'no aplica', 'no',
]);

/** Chequea si un valor es funcionalmente inválido/vacío */
export const isInvalid = (v: unknown): boolean => {
  const c = String(v ?? '').toLowerCase().trim();
  return EMPTY_MARKERS.has(c);
};

/** Devuelve string seguro (vacío si es null/undefined/"No aplica"/etc.) */
export const safeText = (v: unknown): string => {
  if (isInvalid(v)) return '';
  return String(v).trim();
};

/** Formato de fecha compacto: "12 abr, 14:30" */
export const formatTimeDate = (val: string | number | undefined | null): string => {
  if (!val) return '—';
  const date = new Date(
    typeof val === 'number' && val < 10_000_000_000 ? val * 1000 : val
  );
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Coerción de booleano del bot: false / "false" → false, todo lo demás → true */
export const isBotOn = (v: unknown): boolean => {
  if (v === false) return false;
  if (typeof v === 'string' && v.toLowerCase() === 'false') return false;
  return true;
};

/** Maneja IDs grandes de FB/IG evitando notación científica */
export const safeBigIntStr = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') {
    return val.toLocaleString('fullwide', { useGrouping: false });
  }
  return String(val);
};

/** fmt() — valor o placeholder */
export const fmt = (v: unknown, placeholder = ''): string => {
  const s = (v ?? '').toString().trim();
  return !s || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined'
    ? placeholder
    : s;
};
