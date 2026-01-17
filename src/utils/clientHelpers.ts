// src/utils/clientHelpers.ts
import { Client, EstadoEtapa, CategoriaContacto } from '../types/client';

/* ======================= Colores de etapa y categoría ======================= */

export const getEtapaColor = (etapa: EstadoEtapa): string => {
  const colors: Record<EstadoEtapa, string> = {
    Nuevo: 'bg-blue-100 text-blue-800 border-blue-200',
    Cotizando: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    Agendado: 'bg-purple-100 text-purple-800 border-purple-200',
    En_taller: 'bg-orange-100 text-orange-800 border-orange-200',
    Entregado: 'bg-green-100 text-green-800 border-green-200',
    Cerrado: 'bg-gray-100 text-gray-800 border-gray-200',
    Hater: 'bg-red-100 text-red-800 border-red-200',
    Fan: 'bg-pink-100 text-pink-800 border-pink-200',
    Espia: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  };
  return colors[etapa] || colors.Nuevo;
};

export const getCategoriaColor = (categoria: CategoriaContacto): string => {
  const colors: Record<CategoriaContacto, string> = {
    Prospecto_frio: 'bg-slate-100 text-slate-700',
    Prospecto_tibio: 'bg-amber-100 text-amber-700',
    Prospecto_caliente: 'bg-red-100 text-red-700',
    Cliente_nuevo: 'bg-emerald-100 text-emerald-700',
    Soporte_postventa: 'bg-cyan-100 text-cyan-700',
    No_alineado: 'bg-gray-100 text-gray-700',
    Hater: 'bg-red-100 text-red-700',
    Fan: 'bg-pink-100 text-pink-700',
    Espia: 'bg-violet-100 text-violet-700',
  };
  return colors[categoria] || colors.Prospecto_frio;
};

/* ======================= Fechas y WhatsApp ======================= */

export const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  let date: Date;
  // Manejo básico de formato fecha hora
  if (dateString.includes(' ')) {
    const [datePart, timePart] = dateString.split(' ');
    date = new Date(`${datePart}T${timePart}:00`);
  } else {
    date = new Date(dateString);
  }
  if (isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Formatea el número de WhatsApp para visualización.
 * BLINDADO: Acepta null/undefined/number sin crashear.
 */
export const formatWhatsApp = (whatsapp: string | number | null | undefined): string => {
  if (!whatsapp) return '—';
  
  // Convertimos a string explícitamente y limpiamos
  return String(whatsapp)
    .replace('@s.whatsapp.net', '')
    .replace('57', '+57 ');
};

export const isToday = (dateString: string): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString.replace(' ', 'T'));
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

export const isTomorrow = (dateString: string): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString.replace(' ', 'T'));
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return date.toDateString() === tomorrow.toDateString();
};

export const isYesterday = (dateString: string): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString.replace(' ', 'T'));
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString();
};

/* ======================= Helpers internos ======================= */

const EMPTY_MARKERS = new Set(['', '-', '—', 'null', 'undefined', 'n/a', 'na']);

// Normaliza valores para verificar si están vacíos
const norm = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  return EMPTY_MARKERS.has(s.toLowerCase()) ? '' : s;
};

// Verifica si un valor ha sido provisto
const provided = (v: unknown) => norm(v) !== '';

/* ======================= Estado de envío (Logística) ======================= */

// Campos requeridos para poder crear la guía
export const REQUIRED_GUIA_FIELDS: Array<keyof Client> = [
  'guia_nombre_completo',
  'guia_cedula_id',
  'guia_telefono',
  'guia_direccion',
  'guia_ciudad',
  'guia_departamento_estado',
];

export type EnvioUIKey =
  | 'faltan_datos'
  | 'datos_completos'
  | 'ida'
  | 'retorno'
  | 'ida_y_retorno'
  | 'envio_gestionado'
  | 'no_aplica';

export const ENVIO_LABELS: Record<EnvioUIKey, string> = {
  faltan_datos: 'Faltan datos',
  datos_completos: 'Datos completos · sin guía',
  ida: 'Guía ida',
  retorno: 'Guía retorno',
  ida_y_retorno: 'Guías ida + retorno',
  envio_gestionado: 'Envío gestionado',
  no_aplica: 'No aplica',
};

export const ENVIO_CLASSES: Record<EnvioUIKey, string> = {
  faltan_datos: 'bg-rose-100 text-rose-700 border-rose-200',
  datos_completos: 'bg-amber-100 text-amber-700 border-amber-200',
  ida: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  retorno: 'bg-sky-100 text-sky-700 border-sky-200',
  ida_y_retorno: 'bg-teal-100 text-teal-700 border-teal-200',
  envio_gestionado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  no_aplica: 'bg-slate-100 text-slate-700 border-slate-200',
};

const GREEN_STATES: EnvioUIKey[] = ['ida', 'retorno', 'ida_y_retorno', 'envio_gestionado'];

/** Función canónica: de un cliente → estado de envío UI */
export const deriveEnvioUI = (c: Partial<Client>): {
  key: EnvioUIKey;
  label: string;
  classes: string;
  isGreen: boolean;
} => {
  const estado = norm((c as any).estado_etapa).toLowerCase(); // Usamos estado_etapa o estado_envio según tu DB
  
  // Prioridad 1: Gestionado explícito
  if (estado === 'envio_gestionado') {
    return { key: 'envio_gestionado', label: ENVIO_LABELS.envio_gestionado, classes: ENVIO_CLASSES.envio_gestionado, isGreen: true };
  }
  
  const flagNoAplica = norm((c as any).estado_envio).toLowerCase() === 'no_aplica';
  
  const ida = provided(c.guia_numero_ida);
  const ret = provided(c.guia_numero_retorno);

  if (ida && ret) {
    return { key: 'ida_y_retorno', label: ENVIO_LABELS.ida_y_retorno, classes: ENVIO_CLASSES.ida_y_retorno, isGreen: true };
  }
  if (ida) {
    return { key: 'ida', label: ENVIO_LABELS.ida, classes: ENVIO_CLASSES.ida, isGreen: true };
  }
  if (ret) {
    return { key: 'retorno', label: ENVIO_LABELS.retorno, classes: ENVIO_CLASSES.retorno, isGreen: true };
  }
  
  if (flagNoAplica) {
    return { key: 'no_aplica', label: ENVIO_LABELS.no_aplica, classes: ENVIO_CLASSES.no_aplica, isGreen: false };
  }

  const tieneTodo = REQUIRED_GUIA_FIELDS.every(k => provided((c as any)[k]));
  if (tieneTodo) {
    return { key: 'datos_completos', label: ENVIO_LABELS.datos_completos, classes: ENVIO_CLASSES.datos_completos, isGreen: false };
  }
  return { key: 'faltan_datos', label: ENVIO_LABELS.faltan_datos, classes: ENVIO_CLASSES.faltan_datos, isGreen: false };
};

/** Compatibilidad con llamadas antiguas que pasaban 3 args */
export const getEnvioStatus = (
  estado_envio?: string | null,
  guia_ida?: unknown,
  guia_retorno?: unknown
) => deriveEnvioUI({ estado_envio: estado_envio as any, guia_numero_ida: guia_ida as any, guia_numero_retorno: guia_retorno as any });

export const shouldGreenRow = (c: Client): boolean => GREEN_STATES.includes(deriveEnvioUI(c).key);

/** Filtro por estado de envío */
export const matchEnvioFilter = (c: Client, filter: '' | EnvioUIKey) => {
  if (!filter) return true;
  return deriveEnvioUI(c).key === filter;
};

/* ======================= Filtro general de clientes ======================= */

export const filterClients = (
  clients: Client[],
  filters: {
    search: string;
    categoria: CategoriaContacto | '';
    etapa: EstadoEtapa | '';
    dateFrom: string;
    dateTo: string;
    envio?: '' | EnvioUIKey;
  }
): Client[] => {
  return clients.filter((client) => {
    const search = (filters.search || '').toLowerCase();
    const safe = (v?: string | null) => (v ? v.toLowerCase() : '');

    const searchMatch =
      search === '' ||
      safe(client.nombre).includes(search) ||
      safe(client.modelo).includes(search) ||
      (client.whatsapp || '').includes(filters.search) ||
      safe(client.notas).includes(search);

    const categoriaMatch = !filters.categoria || client.categoria_contacto === filters.categoria;
    const etapaMatch = !filters.etapa || client.estado_etapa === filters.etapa;

    const dateMatch = (() => {
      if (!filters.dateFrom && !filters.dateTo) return true;
      if (!client.fecha_agenda) return false;

      const ds = client.fecha_agenda.includes(' ')
        ? client.fecha_agenda.replace(' ', 'T') + ':00'
        : client.fecha_agenda;

      const clientDate = new Date(ds);
      if (isNaN(clientDate.getTime())) return false;

      const fromMatch = !filters.dateFrom || clientDate >= new Date(filters.dateFrom);
      const toMatch = !filters.dateTo || clientDate <= new Date(filters.dateTo);
      return fromMatch && toMatch;
    })();

    const envioMatch = matchEnvioFilter(client, filters.envio ?? '');

    return searchMatch && categoriaMatch && etapaMatch && dateMatch && envioMatch;
  });
};