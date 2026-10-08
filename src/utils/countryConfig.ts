export const COUNTRY_MODULES = [
  { id: 'agenda', page: 'agenda', label: 'Agenda' },
  { id: 'crm', page: 'crm', label: 'CRM' },
  { id: 'precios', page: 'precios', label: 'Catálogo de precios' },
  { id: 'whatsapp', page: 'whatsapp', label: 'WhatsApp' },
  { id: 'conversaciones', page: 'conversaciones', label: 'Conversaciones' },
  { id: 'web1', page: 'web1', label: 'Conversaciones web' },
  { id: 'asistencia', page: 'asistencia', label: 'Asistencia' },
  { id: 'envios-colombia', page: 'envios', label: 'Envíos Colombia' },
  { id: 'envios-mexico', page: 'envios', label: 'Envíos México' },
  { id: 'resultados', page: 'resultados', label: 'Resultados' },
  { id: 'reparaciones', page: 'reparaciones', label: 'Reparaciones' },
  { id: 'diagnosticador', page: 'diagnosticador', label: 'Diagnosticador' },
  { id: 'agente', page: 'agente', label: 'Agente IA' },
  { id: 'diagnosticador_admin', page: 'diagnosticador_admin', label: 'AI Diagnosticador' },
  { id: 'usuarios', page: 'usuarios', label: 'Usuarios' },
] as const;

export const WHATSAPP_LINE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;
export type WhatsappLineId = typeof WHATSAPP_LINE_IDS[number];

export function normalizeWhatsappLines(value: unknown): WhatsappLineId[] {
  if (!Array.isArray(value) || value.some(id => !Number.isInteger(id) || !WHATSAPP_LINE_IDS.includes(id))) {
    throw new Error('Las líneas de WhatsApp deben ser una lista de números del 1 al 15.');
  }
  return [...new Set(value as WhatsappLineId[])].sort((a, b) => a - b);
}

export function selectWhatsappLine(lines: readonly WhatsappLineId[], saved: string | null, preferred: WhatsappLineId = 1): WhatsappLineId | null {
  const candidate = Number(saved);
  return lines.find(id => id === candidate) ?? (lines.includes(preferred) ? preferred : lines[0] ?? null);
}

export interface CountryConfig {
  version: number;
  modulos: Record<string, boolean>;
  ciudades: string[];
  chat_webhook_url: string;
  whatsapp_lineas: WhatsappLineId[];
  [key: string]: unknown;
}
export const cityKey = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
export function cleanCities(cities: string[]): string[] {
  const unique = new Map<string, string>();
  cities.forEach(city => { const text = city.trim().replace(/\s+/g, ' '); if (text && !unique.has(cityKey(text))) unique.set(cityKey(text), text); });
  return [...unique.values()];
}
export const normalizeCity = (value: string, cities: string[]) => cities.find(city => cityKey(city) === cityKey(value)) ?? value.trim();

const DEFAULT_CHAT_URLS: Record<string, string> = {
  mexico: 'https://n8n.alliasoft.com/webhook/76edb881-62e9-403d-9b28-dcf419578e1e/chat',
  colombia: 'https://n8n.alliasoft.com/webhook/05f7a0cc-521d-464f-8072-663d257bc021/chat',
};

export function normalizeChatWebhookUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('La URL del chat debe ser un texto.');
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error();
    return url.href;
  } catch {
    throw new Error('Introduce una URL completa del chat que comience por https:// o http://, sin credenciales.');
  }
}

export function parseCountryConfig(raw: unknown, country: string): CountryConfig {
  if (typeof raw === 'string') raw = raw.trim() ? JSON.parse(raw) : null;
  if (raw !== null && raw !== undefined && (typeof raw !== 'object' || Array.isArray(raw))) throw new Error('La configuración del país debe ser un objeto JSON.');
  const data = (raw ?? {}) as Record<string, unknown>;
  const configured = data.modulos !== undefined;
  if (configured && (!data.modulos || typeof data.modulos !== 'object' || Array.isArray(data.modulos))) throw new Error('La lista de módulos es inválida.');
  const modules = configured ? data.modulos as Record<string, unknown> : {};
  if (Object.values(modules).some(value => typeof value !== 'boolean')) throw new Error('Los módulos deben usar true o false.');
  if (data.ciudades !== undefined && (!Array.isArray(data.ciudades) || data.ciudades.some(city => typeof city !== 'string'))) throw new Error('Las ciudades deben ser una lista de nombres.');
  const defaults = country === 'Colombia' ? ['Barrancabermeja', 'Barranquilla', 'Bogotá', 'Bucaramanga', 'Medellín'] : [];
  return {
    ...data, version: 1,
    modulos: { ...modules, ...Object.fromEntries(COUNTRY_MODULES.map(module => {
      if (module.id === 'envios-mexico') return [module.id, cityKey(country) === 'mexico' && (configured ? modules[module.id] === true : true)];
      // Mexico uses its own manual DHL workflow, even with a legacy Colombia flag.
      if (module.id === 'envios-colombia' && cityKey(country) === 'mexico') return [module.id, false];
      return [module.id, configured ? modules[module.id] === true : module.id !== 'envios-colombia' || country === 'Colombia'];
    })) } as Record<string, boolean>,
    ciudades: cleanCities((data.ciudades as string[] | undefined) ?? defaults),
    chat_webhook_url: normalizeChatWebhookUrl(data.chat_webhook_url ?? DEFAULT_CHAT_URLS[cityKey(country)] ?? ''),
    whatsapp_lineas: normalizeWhatsappLines(data.whatsapp_lineas ?? (cityKey(country) === 'mexico' ? [1, 2, 3, 4] : [...WHATSAPP_LINE_IDS])),
  };
}

export function canAccessCountryPage(page: string, roles: string | undefined, config: CountryConfig): boolean {
  const permissions = (roles ?? '').split(',').map(role => role.trim().toLowerCase());
  if (page === 'paises') return permissions.includes('root');
  const enabled = COUNTRY_MODULES.some(module => module.page === page && config.modulos[module.id] === true);
  if (!enabled) return false;
  return permissions.includes('root') || permissions.includes('admin') || permissions.includes(page)
    || (page === 'conversaciones' && permissions.includes('web1'))
    || (page === 'reparaciones' && permissions.includes('diagnosticador'));
}

export function canAssignCountryRole(role: string, isRoot: boolean, config: CountryConfig): boolean {
  if (isRoot) return true;
  const normalized = role.trim().toLowerCase();
  if (normalized === 'admin') return true;
  return COUNTRY_MODULES.some(module => module.page === normalized && config.modulos[module.id] === true);
}
