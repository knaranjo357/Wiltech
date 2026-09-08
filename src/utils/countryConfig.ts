export const COUNTRY_MODULES = [
  { id: 'agenda', page: 'agenda', label: 'Agenda' },
  { id: 'crm', page: 'crm', label: 'CRM' },
  { id: 'precios', page: 'precios', label: 'Catálogo de precios' },
  { id: 'whatsapp', page: 'whatsapp', label: 'WhatsApp' },
  { id: 'conversaciones', page: 'conversaciones', label: 'Conversaciones' },
  { id: 'web1', page: 'web1', label: 'Conversaciones web' },
  { id: 'asistencia', page: 'asistencia', label: 'Asistencia' },
  { id: 'envios-colombia', page: 'envios', label: 'Envíos Colombia' },
  { id: 'resultados', page: 'resultados', label: 'Resultados' },
  { id: 'reparaciones', page: 'reparaciones', label: 'Reparaciones' },
  { id: 'diagnosticador', page: 'diagnosticador', label: 'Diagnosticador' },
  { id: 'agente', page: 'agente', label: 'Agente IA' },
  { id: 'diagnosticador_admin', page: 'diagnosticador_admin', label: 'AI Diagnosticador' },
  { id: 'usuarios', page: 'usuarios', label: 'Usuarios' },
] as const;

export interface CountryConfig {
  version: number;
  modulos: Record<string, boolean>;
  ciudades: string[];
  [key: string]: unknown;
}
export const cityKey = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
export function cleanCities(cities: string[]): string[] {
  const unique = new Map<string, string>();
  cities.forEach(city => { const text = city.trim().replace(/\s+/g, ' '); if (text && !unique.has(cityKey(text))) unique.set(cityKey(text), text); });
  return [...unique.values()];
}
export const normalizeCity = (value: string, cities: string[]) => cities.find(city => cityKey(city) === cityKey(value)) ?? value.trim();

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
    modulos: { ...modules, ...Object.fromEntries(COUNTRY_MODULES.map(module => [module.id, configured ? modules[module.id] === true : module.id !== 'envios-colombia' || country === 'Colombia'])) } as Record<string, boolean>,
    ciudades: cleanCities((data.ciudades as string[] | undefined) ?? defaults),
  };
}

export function canAccessCountryPage(page: string, roles: string | undefined, config: CountryConfig): boolean {
  const permissions = (roles ?? '').split(',').map(role => role.trim().toLowerCase());
  if (page === 'paises') return permissions.includes('root');
  const module = COUNTRY_MODULES.find(module => module.page === page);
  if (!module || config.modulos[module.id] !== true) return false;
  return permissions.includes('root') || permissions.includes('admin') || permissions.includes(page)
    || (page === 'conversaciones' && permissions.includes('web1'))
    || (page === 'reparaciones' && permissions.includes('diagnosticador'));
}

export function canAssignCountryRole(role: string, isRoot: boolean, config: CountryConfig): boolean {
  if (isRoot) return true;
  const normalized = role.trim().toLowerCase();
  if (normalized === 'admin') return true;
  const module = COUNTRY_MODULES.find(module => module.page === normalized);
  return !!module && config.modulos[module.id] === true;
}
