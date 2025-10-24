import React, { useEffect, useMemo, useState } from 'react';
import { Truck, RefreshCw, Phone, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Client } from '../types/client';
import { ClientService } from '../services/clientService';
import { formatWhatsApp, formatDate, deriveEnvioUI, ENVIO_LABELS } from '../utils/clientHelpers';
import type { EnvioUIKey } from '../utils/clientHelpers';
import { ClientModal } from '../components/ClientModal';

/** ================== Normalizadores & validaciones ================== */
const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const canon = (v: unknown) =>
  String(v ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

const isInvalidNoAplica = (v: unknown) => {
  const c = canon(v);
  return c === '' || c === 'no aplica' || c === 'no';
};

/** Oculta null/undefined/"null"/"undefined"/"No aplica" */
const fmt = (v: unknown, placeholder = ''): string => {
  const s = (v ?? '').toString().trim();
  if (!s) return placeholder;
  const lower = s.toLowerCase();
  if (lower === 'null' || lower === 'undefined' || isInvalidNoAplica(s)) return placeholder;
  return s;
};

/** Parse seguro de fecha (admite "YYYY-MM-DD HH:mm" o ISO) */
const parseDateSafe = (v: unknown): number => {
  if (!v) return 0;
  const raw = String(v).trim();
  if (!raw) return 0;
  const iso =
    raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') + (raw.length === 16 ? ':00' : '') : raw;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? 0 : time;
};

/**
 * Mostrar SOLO registros que tengan:
 * - SEDE (agenda_ciudad_sede)
 * - CIUDAD (guia_ciudad)
 * - DIRECCIÓN (guia_direccion)
 * Y ninguno sea "No aplica"/"no".
 */
const hasSedeCiudadDireccionValid = (c: Client): boolean => {
  const sede = c?.agenda_ciudad_sede != null ? String(c.agenda_ciudad_sede).trim() : '';
  const ciudad = c?.guia_ciudad != null ? String(c.guia_ciudad).trim() : '';
  const direccion = c?.guia_direccion != null ? String(c.guia_direccion).trim() : '';
  if (!sede || !ciudad || !direccion) return false;
  if (isInvalidNoAplica(sede) || isInvalidNoAplica(ciudad) || isInvalidNoAplica(direccion)) return false;
  return true;
};

/** ================== Estado de envío: usar helper canónico ================== */
/** Orden lógico para ordenar por estado (de más “pendiente” a más “resuelto”) */
const STATE_ORDER: EnvioUIKey[] = [
  'faltan_datos',
  'datos_completos',
  'ida',
  'retorno',
  'ida_y_retorno',
  'envio_gestionado',
  'no_aplica',
];

/** Colores de fila (badge ya viene con clases desde deriveEnvioUI → ENVIO_CLASSES) */
const ROW_CLASSES: Record<EnvioUIKey, string> = {
  faltan_datos: 'bg-orange-50 ring-1 ring-orange-200 hover:bg-orange-100/70',
  datos_completos: 'bg-yellow-50 ring-1 ring-yellow-200 hover:bg-yellow-100/70',
  ida: 'bg-sky-50 ring-1 ring-sky-200 hover:bg-sky-100/70',
  retorno: 'bg-indigo-50 ring-1 ring-indigo-200 hover:bg-indigo-100/70',
  ida_y_retorno: 'bg-emerald-50 ring-1 ring-emerald-200 hover:bg-emerald-100/70',
  envio_gestionado: 'bg-emerald-50 ring-1 ring-emerald-200 hover:bg-emerald-100/70',
  no_aplica: 'bg-slate-50 ring-1 ring-slate-200 hover:bg-slate-100/70',
};

type SortKey =
  | 'cliente'
  | 'whatsapp'
  | 'sede'
  | 'ciudad'
  | 'direccion'
  | 'ida'
  | 'ret'
  | 'asegurado'
  | 'valorSeguro'
  | 'estadoEnvio'
  | 'created';

type SortOrder = 'asc' | 'desc';

export const EnviosPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cityFilter, setCityFilter] = useState<string>('');
  const [sedeFilter, setSedeFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [stateFilter, setStateFilter] = useState<'' | EnvioUIKey>('');

  const [viewClient, setViewClient] = useState<Client | null>(null);

  // Orden por defecto
  const [sort, setSort] = useState<{ key: SortKey; order: SortOrder }>({
    key: 'created',
    order: 'desc',
  });

  /** === Carga inicial === */
  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ClientService.getClients();
      const arr = Array.isArray(data) ? (data as Client[]) : [];
      setClients(arr.filter(hasSedeCiudadDireccionValid));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar envíos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  /** === Sincronización con otras vistas/pestañas === */
  useEffect(() => {
    const onExternalUpdate = (ev: Event) => {
      const detail = (ev as CustomEvent<Partial<Client>>).detail;
      if (!detail || !('row_number' in detail)) return;

      setClients(prev => {
        const next = prev.map(c =>
          c.row_number === detail.row_number ? ({ ...c, ...detail } as Client) : c
        );
        return next.filter(hasSedeCiudadDireccionValid);
      });

      setViewClient(v => {
        if (!v || !detail || v.row_number !== detail.row_number) return v;
        const merged = { ...v, ...detail } as Client;
        return hasSedeCiudadDireccionValid(merged) ? merged : null;
      });
    };

    window.addEventListener('client:updated', onExternalUpdate as any);

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'crm:client-updated' && e.newValue) {
        fetchClients();
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('client:updated', onExternalUpdate as any);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  /** === Estado de guardado por fila === */
  const [savingRow, setSavingRow] = useState<number | null>(null);

  /** === onUpdate usado por el modal === */
  const onUpdate = async (payload: Partial<Client>): Promise<boolean> => {
    if (!payload.row_number) return false;

    setSavingRow(payload.row_number);
    const prevClients = clients;
    const prevView = viewClient;

    const patchedClients = prevClients
      .map(c => (c.row_number === payload.row_number ? ({ ...c, ...payload } as Client) : c))
      .filter(hasSedeCiudadDireccionValid);
    setClients(patchedClients);

    setViewClient(v => {
      if (!v || v.row_number !== payload.row_number) return v;
      const merged = { ...v, ...payload } as Client;
      return hasSedeCiudadDireccionValid(merged) ? merged : null;
    });

    try {
      if (typeof (ClientService as any).updateClient === 'function') {
        await (ClientService as any).updateClient(payload);
      } else {
        await fetch('/api/clients/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      return true;
    } catch (e) {
      setClients(prevClients);
      setViewClient(prevView);
      setError('No se pudo guardar los cambios');
      return false;
    } finally {
      setSavingRow(null);
    }
  };

  /** === Ciudades & Sedes únicas === */
  const cities = useMemo(() => {
    const s = new Set<string>();
    clients.forEach(c => {
      const city = (c.guia_ciudad && String(c.guia_ciudad).trim()) || '';
      if (city && !isInvalidNoAplica(city)) s.add(city);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [clients]);

  const sedes = useMemo(() => {
    const s = new Set<string>();
    clients.forEach(c => {
      const sede = (c.agenda_ciudad_sede && String(c.agenda_ciudad_sede).trim()) || '';
      if (sede && !isInvalidNoAplica(sede)) s.add(sede);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [clients]);

  /** === Filtrado === */
  const filtered = useMemo(() => {
    let data = [...clients];

    if (cityFilter) {
      const nf = normalize(cityFilter);
      data = data.filter(c => normalize(String(c.guia_ciudad || '')) === nf);
    }

    if (sedeFilter) {
      const nf = normalize(sedeFilter);
      data = data.filter(c => normalize(String(c.agenda_ciudad_sede || '')) === nf);
    }

    if (stateFilter) {
      data = data.filter(c => deriveEnvioUI(c).key === stateFilter);
    }

    if (search.trim()) {
      const q = normalize(search.trim());
      data = data.filter(c => {
        const nombre = normalize(String(c.nombre || ''));
        const modelo = normalize(String(c.modelo || ''));
        const dir = normalize(String(c.guia_direccion || ''));
        const ida = normalize(String(c.guia_numero_ida || ''));
        const ret = normalize(String(c.guia_numero_retorno || ''));
        const ciudad = normalize(String(c.guia_ciudad || ''));
        const sede = normalize(String(c.agenda_ciudad_sede || ''));
        const tel = String(c.whatsapp || '').replace('@s.whatsapp.net', '');
        return (
          nombre.includes(q) ||
          modelo.includes(q) ||
          dir.includes(q) ||
          ida.includes(q) ||
          ret.includes(q) ||
          ciudad.includes(q) ||
          sede.includes(q) ||
          tel.includes(q)
        );
      });
    }

    return data;
  }, [clients, cityFilter, sedeFilter, stateFilter, search]);

  /** === Ordenamiento === */
  const sorted = useMemo(() => {
    const getKeyValue = (c: Client, key: SortKey): string | number => {
      switch (key) {
        case 'cliente':
          return fmt(c.nombre) || '';
        case 'whatsapp':
          return String(c.whatsapp || '').replace('@s.whatsapp.net', '');
        case 'sede':
          return fmt(c.agenda_ciudad_sede) || '';
        case 'ciudad':
          return fmt(c.guia_ciudad) || '';
        case 'direccion':
          return fmt(c.guia_direccion) || '';
        case 'ida':
          return fmt(c.guia_numero_ida) || '';
        case 'ret':
          return fmt(c.guia_numero_retorno) || '';
        case 'asegurado':
          return fmt(c.asegurado) || '';
        case 'valorSeguro': {
          const v = fmt(c.valor_seguro) || '';
          const n = Number(v.toString().replace(/[^\d.-]/g, ''));
          return Number.isFinite(n) ? n : -Infinity;
        }
        case 'estadoEnvio': {
          const st = deriveEnvioUI(c).key;
          return STATE_ORDER.indexOf(st);
        }
        case 'created':
          return parseDateSafe(c.created);
        default:
          return '';
      }
    };

    const dir = sort.order === 'asc' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      const va = getKeyValue(a, sort.key);
      const vb = getKeyValue(b, sort.key);

      if (typeof va === 'number' || typeof vb === 'number') {
        const na = typeof va === 'number' ? va : 0;
        const nb = typeof vb === 'number' ? vb : 0;
        return (na - nb) * dir;
      }
      return String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' }) * dir;
    });
  }, [filtered, sort]);

  const total = sorted.length;

  /** === UI helpers de orden === */
  const headerBtn =
    'group inline-flex items-center gap-1 select-none hover:text-purple-700 transition cursor-pointer';

  const sortIcon = (key: SortKey) => {
    if (sort.key !== key) return <ArrowUpDown className="w-4 h-4 opacity-60 group-hover:opacity-100" />;
    return sort.order === 'asc'
      ? <ArrowUp className="w-4 h-4" />
      : <ArrowDown className="w-4 h-4" />;
  };

  const onSort = (key: SortKey) => {
    setSort(prev => (prev.key === key ? { key, order: prev.order === 'asc' ? 'desc' : 'asc' } : { key, order: 'asc' }));
  };

  /** === Render === */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/40 p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center">
            <Truck className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Gestión de Envíos</h2>
            <p className="text-sm text-gray-500">
              {total} registro{total !== 1 ? 's' : ''} con SEDE, CIUDAD y DIRECCIÓN válidos
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex gap-2 flex-wrap">
            <select
              value={sedeFilter}
              onChange={(e) => setSedeFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-purple-500"
              title="Filtrar por sede (agenda_ciudad_sede)"
            >
              <option value="">Todas las sedes</option>
              {sedes.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-purple-500"
              title="Filtrar por ciudad (guía)"
            >
              <option value="">Todas las ciudades</option>
              {cities.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Filtro por estado de envío (claves del helper) */}
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value as EnvioUIKey | '')}
              className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-purple-500"
              title="Filtrar por estado de envío"
            >
              <option value="">Todos los estados</option>
              {STATE_ORDER.map(k => (
                <option key={k} value={k}>{ENVIO_LABELS[k]}</option>
              ))}
            </select>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, guía, dirección, modelo, WhatsApp…"
              className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-purple-500 w-64"
            />
          </div>

          <button
            onClick={fetchClients}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.99] transition"
            aria-label="Recargar"
            disabled={loading || savingRow !== null}
            title={savingRow !== null ? 'Guardando cambios…' : 'Recargar'}
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm">{savingRow !== null ? 'Guardando…' : 'Recargar'}</span>
          </button>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border-4 border-purple-600/30 border-t-purple-600 rounded-full animate-spin" />
            <span className="text-gray-600">Cargando envíos…</span>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-red-400 mt-2" />
            <div className="flex-1">
              <p className="text-red-700 font-medium">Hubo un problema</p>
              <p className="text-red-700/90 text-sm">{error}</p>
              <button
                onClick={fetchClients}
                className="mt-3 inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-red-200 bg-white hover:bg-red-50 transition"
              >
                <RefreshCw className="w-4 h-4" />
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      {!loading && !error && (
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-white/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-purple-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    <button className={headerBtn} onClick={() => onSort('cliente')}>
                      Cliente {sortIcon('cliente')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    <button className={headerBtn} onClick={() => onSort('whatsapp')}>
                      WhatsApp {sortIcon('whatsapp')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    <button className={headerBtn} onClick={() => onSort('sede')}>
                      Sede {sortIcon('sede')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    <button className={headerBtn} onClick={() => onSort('ciudad')}>
                      Ciudad {sortIcon('ciudad')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    <button className={headerBtn} onClick={() => onSort('direccion')}>
                      Dirección {sortIcon('direccion')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    <button className={headerBtn} onClick={() => onSort('ida')}>
                      Guía ida {sortIcon('ida')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    <button className={headerBtn} onClick={() => onSort('ret')}>
                      Guía retorno {sortIcon('ret')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    <button className={headerBtn} onClick={() => onSort('asegurado')}>
                      Asegurado {sortIcon('asegurado')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    <button className={headerBtn} onClick={() => onSort('valorSeguro')}>
                      Valor seguro {sortIcon('valorSeguro')}
                    </button>
                  </th>
                  {/* Nueva columna: Estado envío */}
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    <button className={headerBtn} onClick={() => onSort('estadoEnvio')}>
                      Estado envío {sortIcon('estadoEnvio')}
                    </button>
                  </th>
                  {/* Fecha registro */}
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    <button className={headerBtn} onClick={() => onSort('created')}>
                      Fecha registro {sortIcon('created')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((c, i) => {
                  const nombre = fmt(c.nombre, 'Sin nombre');
                  const modelo = fmt(c.modelo);
                  const sede = fmt(c.agenda_ciudad_sede, '-');
                  const ciudad = fmt(c.guia_ciudad, '-');
                  const direccion = fmt(c.guia_direccion, '-');
                  const ida = fmt(c.guia_numero_ida, '-');
                  const ret = fmt(c.guia_numero_retorno, '-');
                  const asegurado = fmt(c.asegurado, '-');
                  const valorSeguro = fmt(c.valor_seguro, '-');
                  const createdRaw = c.created ? String(c.created) : '';
                  const createdHuman = createdRaw ? formatDate(createdRaw) : '-';

                  const envio = deriveEnvioUI(c); // ← unificado
                  const rowClass = ROW_CLASSES[envio.key];

                  return (
                    <tr
                      key={`${c.row_number}-${i}`}
                      className={`transition-colors cursor-pointer ${rowClass}`}
                      onClick={() => setViewClient(c)}
                      tabIndex={0}
                      role="button"
                      aria-label={`Abrir modal de ${nombre || 'cliente'}`}
                      data-estado-envio={envio.key}
                    >
                      <td className="px-4 py-4">
                        <div className="text-gray-900 font-medium">{nombre}</div>
                        {modelo && <div className="text-xs text-gray-500">{modelo}</div>}
                      </td>
                      <td className="px-4 py-4">
                        <div className="inline-flex items-center gap-1.5 text-green-700">
                          <Phone className="w-4 h-4" />
                          {formatWhatsApp(c.whatsapp)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-gray-900">{sede}</td>
                      <td className="px-4 py-4 text-gray-900">{ciudad}</td>
                      <td className="px-4 py-4 text-gray-900 break-words max-w-[280px]">{direccion}</td>
                      <td className="px-4 py-4 text-gray-900">{ida}</td>
                      <td className="px-4 py-4 text-gray-900">{ret}</td>
                      <td className="px-4 py-4 text-gray-900">{asegurado}</td>
                      <td className="px-4 py-4 text-gray-900">{valorSeguro}</td>

                      {/* Estado envío (badge del helper: clases + label) */}
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${envio.classes}`}>
                          {ENVIO_LABELS[envio.key]}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-gray-900">{createdHuman}</td>
                    </tr>
                  );
                })}

                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-gray-500">
                      No hay registros que cumplan con SEDE, CIUDAD y DIRECCIÓN (sin “No aplica”).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <ClientModal
        isOpen={!!viewClient}
        onClose={() => setViewClient(null)}
        client={viewClient}
        onUpdate={onUpdate}
      />
    </div>
  );
};
