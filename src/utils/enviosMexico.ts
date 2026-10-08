import type { Client } from '../types/client';
import { normalize } from './textUtils';

export const NO_REGISTRADO = 'No registrado';
export const COSTO_ENTRADA_MXN = 350;

// Do not coerce identifiers, postal codes or unlock codes to numbers.
export function mexicoText(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  return /^(null|undefined)$/i.test(text) ? '' : text;
}
export const mexicoDisplay = (value: unknown): string => mexicoText(value) || NO_REGISTRADO;

export const MEXICO_GUIA_FIELDS = [
  'guia_nombre_completo', 'guia_telefono', 'guia_email', 'guia_direccion',
  'guia_ciudad', 'guia_departamento_estado',
] as const;

export function checkMexicoGuiaData(client: Partial<Client>) {
  const missingFields = MEXICO_GUIA_FIELDS.filter(field => !mexicoText(client[field]));
  return { isComplete: missingFields.length === 0, missingFields };
}

export const isMexicoEnvioGestionado = (client: Partial<Client>): boolean =>
  mexicoText(client.estado_etapa).toUpperCase() === 'ENVIO_GESTIONADO';

export const hasMexicoLogisticsData = (client: Partial<Client>): boolean =>
  MEXICO_GUIA_FIELDS.some(field => !!mexicoText(client[field])) ||
  !!mexicoText(client.guia_numero_ida) || !!mexicoText(client.guia_numero_retorno) ||
  !!mexicoText(client.estado_envio) || normalize(client.modo_recepcion) === 'envio' ||
  isMexicoEnvioGestionado(client);

export function mexicoShipmentStatus(client: Partial<Client>) {
  if (isMexicoEnvioGestionado(client)) return 'Envío gestionado';
  const ida = mexicoText(client.guia_numero_ida);
  const retorno = mexicoText(client.guia_numero_retorno);
  if (ida && retorno) return 'Guías ida + retorno';
  if (ida) return 'Guía ida';
  if (retorno) return 'Guía retorno';
  return checkMexicoGuiaData(client).isComplete ? 'Datos completos · sin guía' : 'Faltan datos';
}

const ADDRESS_LABELS = ['Calle', 'Núm. exterior', 'Núm. interior', 'Colonia', 'C.P.', 'Referencia'] as const;
export function parseMexicoAddress(value: unknown) {
  const original = mexicoText(value);
  const parts = new Map<string, string>();
  // Unknown, duplicate or unstructured fragments fall back to the entire original.
  for (const fragment of original.split('|')) {
    const colon = fragment.indexOf(':');
    if (colon < 0) return { original, fields: null };
    const label = ADDRESS_LABELS.find(label => normalize(label) === normalize(fragment.slice(0, colon)));
    if (!label || parts.has(label)) return { original, fields: null };
    parts.set(label, fragment.slice(colon + 1).trim());
  }
  return { original, fields: ADDRESS_LABELS.map(label => ({ label, value: mexicoDisplay(parts.get(label)) })) };
}

export function extractMexicoUnlockCode(value: unknown): string {
  const codes = mexicoText(value).split(/\r?\n/).flatMap(line => {
    const match = line.match(/^\s*C[oó]digo de desbloqueo del equipo\s*:\s*(.*?)\s*$/i);
    return match && mexicoText(match[1]) ? [match[1]] : [];
  });
  return codes.join('\n') || NO_REGISTRADO;
}

export function formatMXN(value: unknown): string {
  const text = mexicoText(value);
  if (!text) return NO_REGISTRADO;
  // Mexican decimal notation only; retain unrecognized recorded amounts verbatim.
  const numeric = text.replace(/^\$\s*/, '').replace(/\s*MXN$/i, '');
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(numeric)) return `${text} (MXN)`;
  const amount = Number(numeric.replace(/,/g, ''));
  if (!Number.isFinite(amount)) return `${text} (MXN)`;
  return `${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)} MXN`;
}
