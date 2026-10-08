import type { Client } from '../types/client';

export type ChatRow = {
  row_number: number;
  nombre: string;
  whatsapp: string;
  asignado_a: string;
  modelo: string | null;
  ciudad: string | null;
  source: string | null;
  created: number;
  last_msg: number;
  consentimiento_contacto: boolean | null;
  subscriber_id: number | null;
};

export interface ExtendedClient extends Omit<Client, 'created' | 'last_msg' | 'consentimiento_contacto' | 'modelo' | 'ciudad' | 'source' | 'guia_ciudad' | 'asignado_a' | 'subscriber_id'> {
  modelo?: string | null;
  ciudad?: string | null;
  guia_ciudad?: string | null;
  source?: string | null;
  asignado_a?: string | null;
  created?: string | number | Date | null;
  last_msg?: string | number | Date | null;
  consentimiento_contacto?: boolean | '' | null;
  subscriber_id?: number | null;
}




/** ================== Utilidades ================== */
const TARGET_SOURCE = 'web1';

export const normalizeText = (v: unknown) =>
  String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export const parseDateToTimestamp = (v: unknown): number => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  const str = String(v).trim();
  if (!str) return 0;

  const safeStr = str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str;
  const time = Date.parse(safeStr);
  return Number.isNaN(time) ? 0 : time;
};

export const normalizeConsent = (val: boolean | '' | null | undefined): boolean | null => {
  if (val === '' || val === undefined || val === null) return null;
  return val === true;
};

export const fmt = (v: unknown, placeholder = ''): string => {
  const s = (v ?? '').toString().trim();
  return (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') ? placeholder : s;
};

/** Deduplicación y conversión basada en ASIGNADO_A */
export function dedupeByAsignadoA(clients: ExtendedClient[]): ChatRow[] {
  const map = new Map<string, ChatRow>();

  for (const c of clients) {
    const currentSource = normalizeText(c.source);
    if (currentSource !== TARGET_SOURCE) continue;

    const rawId = c.asignado_a ? String(c.asignado_a).trim() : '';
    const uniqueId = rawId || `row_${c.row_number}`;

    const createdTs = parseDateToTimestamp(c.created);
    const lastMsgTs = parseDateToTimestamp(c.last_msg);

    const candidate: ChatRow = {
      row_number: c.row_number,
      nombre: fmt(c.nombre, 'Visitante Web'),
      whatsapp: c.whatsapp ? String(c.whatsapp).trim() : '',
      asignado_a: rawId,
      modelo: c.modelo || null,
      ciudad: c.ciudad || c.guia_ciudad || null,
      source: c.source || TARGET_SOURCE,
      created: createdTs,
      last_msg: lastMsgTs,
      consentimiento_contacto: normalizeConsent(c.consentimiento_contacto),
      subscriber_id: c.subscriber_id ? Number(c.subscriber_id) : null,
    };

    const current = map.get(uniqueId);
    if (!current || candidate.created > current.created) {
      map.set(uniqueId, candidate);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.created - a.created);
}
