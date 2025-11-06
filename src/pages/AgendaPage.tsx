// src/pages/AgendaPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Clock, RefreshCw, Phone, X, CheckCircle, MapPin, ChevronRight } from 'lucide-react';
import { ClientService } from '../services/clientService';
import { Client } from '../types/client';
import { getEtapaColor, getCategoriaColor, formatWhatsApp } from '../utils/clientHelpers';
import { ClientModal } from '../components/ClientModal';

/** ================== (Opcional) Mapeo Source -> Sede ==================
 * Se usa solo como fallback cuando no viene agenda_ciudad_sede ni ciudad
 * (puedes ampliarlo si tienes otros sources)
 */
const SOURCE_TO_SEDE: Record<string, string> = {
  Wiltech: 'Bogotá',
  WiltechBga: 'Bucaramanga',
};

/** ================== Utils de texto ================== */
const safeText = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  const lower = s.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return '';
  return s;
};

/** ================== Utils de fecha (robustos) ================== */
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const parseAgendaDate = (raw?: string | null): Date | null => {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();

  // ISO completo o con TZ
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return new Date(iso);

  // YYYY-MM-DD HH:mm[:ss]
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const [, y, mo, d, hh, mm, ss] = m;
    return new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      ss ? Number(ss) : 0
    );
  }

  // YYYY-MM-DD
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d), 0, 0, 0);
  }

  // fallback reemplazando espacio por T
  if (s.includes(' ')) {
    const tryAlt = Date.parse(s.replace(' ', 'T'));
    if (!Number.isNaN(tryAlt)) return new Date(tryAlt);
  }

  return null;
};

const sameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const isTodayLocal = (s?: string | null) => {
  const d = parseAgendaDate(s);
  if (!d) return false;
  const now = new Date();
  return sameLocalDay(d, now);
};

const isTomorrowLocal = (s?: string | null) => {
  const d = parseAgendaDate(s);
  if (!d) return false;
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return sameLocalDay(d, t);
};

const isYesterdayLocal = (s?: string | null) => {
  const d = parseAgendaDate(s);
  if (!d) return false;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return sameLocalDay(d, y);
};

// Fechas futuras que no son hoy/mañana/ayer (>= pasado mañana 00:00)
const isFutureBeyondTomorrowLocal = (s?: string | null) => {
  const d = parseAgendaDate(s);
  if (!d) return false;
  const boundary = new Date();
  boundary.setHours(0, 0, 0, 0);
  boundary.setDate(boundary.getDate() + 2); // pasado mañana 00:00
  return d.getTime() >= boundary.getTime();
};

const displayDate = (s?: string | null) => {
  const d = parseAgendaDate(s);
  if (!d) return 'Fecha inválida';
  return `${d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** ============================================================= */

/** ================== Normalizador texto ================== */
const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();

type DateFilter = 'today' | 'tomorrow' | 'yesterday' | 'custom' | 'future';

/** ================== Helpers de sede ================== */
const getClientSede = (c: Client): string => {
  const byAgenda = safeText((c as any).agenda_ciudad_sede);
  if (byAgenda) return byAgenda;
  const src = safeText((c as any).source);
  if (src && SOURCE_TO_SEDE[src]) return SOURCE_TO_SEDE[src];
  const byCity = safeText(c.ciudad);
  return byCity;
};

/** ================== Modal para elegir Sede (DINÁMICO) ================== */
const SedeModal: React.FC<{
  isOpen: boolean;
  options: string[];
  defaultSede?: string;
  onSelect: (sede: string | 'Todas') => void;
}> = ({ isOpen, options, defaultSede, onSelect }) => {
  const [remember, setRemember] = useState(true);
  const initial = defaultSede && (defaultSede === 'Todas' || options.includes(defaultSede))
    ? defaultSede
    : (options[0] ?? 'Todas');

  const [sel, setSel] = useState<string | 'Todas'>(initial || 'Todas');

  useEffect(() => {
    // Si cambian las options (primera carga), re-evaluamos selección por defecto
    const next = defaultSede && (defaultSede === 'Todas' || options.includes(defaultSede))
      ? defaultSede
      : (options[0] ?? 'Todas');
    setSel(next || 'Todas');
  }, [options, defaultSede]);

  if (!isOpen) return null;

  const persist = (value: string | 'Todas') => {
    try {
      if (remember) {
        localStorage.setItem('agenda:selectedSede', value);
      } else {
        localStorage.removeItem('agenda:selectedSede');
      }
    } catch {}
  };

  const confirm = () => {
    persist(sel);
    onSelect(sel);
  };

  return (
    <div className="fixed inset-0 z-[140] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            ¿De qué sede quieres ver la agenda?
          </h3>
          <p className="text-white/80 text-sm mt-1">
            Puedes cambiar esta selección en cualquier momento.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {options.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {options.map((s) => {
                const active = sel === s;
                return (
                  <button
                    key={s}
                    onClick={() => setSel(s)}
                    className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border text-left transition
                      ${active ? 'border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50' : 'border-neutral-200 hover:bg-neutral-50'}`}
                  >
                    <span className="font-medium">{s}</span>
                    {active && <ChevronRight className="w-4 h-4 text-indigo-600" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-neutral-600">No se detectaron sedes aún.</div>
          )}

          <div className="flex items-center justify-between pt-2">
            <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                className="rounded border-neutral-300"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Recordar mi selección
            </label>
            <button
              onClick={confirm}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              disabled={options.length === 0}
            >
              Confirmar
            </button>
          </div>

          <div className="pt-2 border-t border-neutral-200">
            <button
              onClick={() => { persist('Todas'); onSelect('Todas'); }}
              className="text-sm text-neutral-600 hover:text-neutral-900 underline"
            >
              Ver todas las sedes (sin filtrar)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/** ================== Página ================== */
export const AgendaPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customDate, setCustomDate] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [savingRow, setSavingRow] = useState<number | null>(null);

  // Sede seleccionada (dinámica)
  const [selectedSede, setSelectedSede] = useState<string | 'Todas' | ''>('');
  const [showSedeModal, setShowSedeModal] = useState<boolean>(false);

  // Para controlar inicialización después de tener sedes
  const initRef = useRef(false);

  /** === Carga inicial === */
  const fetchClients = async () => {
    try {
      setLoading(true);
      const data = await ClientService.getClients();

      // Mantener SOLO los que tienen fecha válida (no filtrar por estado)
      const withValidDate = (Array.isArray(data) ? data : []).filter((c) =>
        Boolean(parseAgendaDate((c as any).fecha_agenda))
      );

      setClients(withValidDate);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la agenda');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  /** === Detectar sedes dinámicamente a partir de los clientes === */
  const sedes = useMemo(() => {
    const set = new Set<string>();
    for (const c of clients) {
      const s = safeText(getClientSede(c));
      if (s && s !== 'N/A' && s !== '-' && s !== '—') {
        set.add(s);
      }
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );
  }, [clients]);

  /** === Inicializar selección de sede cuando ya hay sedes detectadas === */
  useEffect(() => {
    if (initRef.current) return;
    if (loading) return;            // espera a que termine la carga
    if (clients.length === 0) {     // si no hay clientes, no mostramos modal
      initRef.current = true;
      setSelectedSede('Todas');
      setShowSedeModal(false);
      return;
    }

    const saved = (() => {
      try { return localStorage.getItem('agenda:selectedSede') || ''; } catch { return ''; }
    })();

    if (saved && (saved === 'Todas' || sedes.includes(saved))) {
      setSelectedSede(saved as string);
      setShowSedeModal(false);
    } else {
      if (sedes.length <= 1) {
        setSelectedSede(sedes[0] ?? 'Todas');
        setShowSedeModal(false);
      } else {
        setShowSedeModal(true);
      }
    }

    initRef.current = true;
  }, [sedes, clients, loading]);

  /** === Sincronización con otras vistas/pestañas === */
  useEffect(() => {
    const onExternalUpdate = (ev: Event) => {
      const detail = (ev as CustomEvent<Partial<Client>>).detail;
      if (!detail || !('row_number' in detail)) return;

      setClients(prev => prev.map(c => c.row_number === detail.row_number ? ({ ...c, ...detail } as Client) : c));
      setViewClient(v => (v && detail && v.row_number === detail.row_number ? ({ ...v, ...detail } as Client) : v));
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

  /** === Guardado (mismo contrato que en otras vistas) === */
  const onUpdate = async (payload: Partial<Client>): Promise<boolean> => {
    if (!payload.row_number) return false;

    // OPTIMISTA + ROLLBACK
    setSavingRow(payload.row_number);
    const prevClients = clients;
    const prevView = viewClient;

    setClients(prev =>
      prev.map(c => c.row_number === payload.row_number ? ({ ...c, ...payload } as Client) : c)
    );
    setViewClient(v =>
      (v && v.row_number === payload.row_number) ? ({ ...v, ...payload } as Client) : v
    );

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
      // ROLLBACK
      setClients(prevClients);
      setViewClient(prevView);
      setError('No se pudo guardar los cambios');
      return false;
    } finally {
      setSavingRow(null);
    }
  };

  /** === Lista filtrada (sede + fecha + nombre) === */
  const filteredClients = useMemo(() => {
    let filtered = [...clients];

    // Filtro por sede (si hay selección y no es "Todas")
    if (selectedSede && selectedSede !== 'Todas') {
      const target = normalize(String(selectedSede));
      filtered = filtered.filter((c) => normalize(getClientSede(c)) === target);
    }

    // Filtro por fecha
    switch (dateFilter) {
      case 'today':
        filtered = filtered.filter((c) => isTodayLocal((c as any).fecha_agenda));
        break;
      case 'tomorrow':
        filtered = filtered.filter((c) => isTomorrowLocal((c as any).fecha_agenda));
        break;
      case 'yesterday':
        filtered = filtered.filter((c) => isYesterdayLocal((c as any).fecha_agenda));
        break;
      case 'future':
        filtered = filtered.filter((c) => isFutureBeyondTomorrowLocal((c as any).fecha_agenda));
        break;
      case 'custom':
        if (customDate) {
          const [y, m, d] = customDate.split('-').map(Number);
          const sel = new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0);
          filtered = filtered.filter((c) => {
            const cd = parseAgendaDate((c as any).fecha_agenda);
            return cd ? sameLocalDay(cd, sel) : false;
          });
        } else {
          filtered = [];
        }
        break;
    }

    // Filtro por nombre (normalizado)
    const q = normalize(nameFilter);
    if (q) {
      filtered = filtered.filter(c => normalize(safeText(c.nombre)).includes(q));
    }

    // Orden por hora ascendente
    filtered.sort((a, b) => {
      const ta = parseAgendaDate((a as any).fecha_agenda)?.getTime() ?? 0;
      const tb = parseAgendaDate((b as any).fecha_agenda)?.getTime() ?? 0;
      return ta - tb;
    });

    return filtered;
  }, [clients, selectedSede, dateFilter, customDate, nameFilter]);

  // Contadores para los botones
  const stats = {
    today: clients.filter((c) => isTodayLocal((c as any).fecha_agenda)).length,
    tomorrow: clients.filter((c) => isTomorrowLocal((c as any).fecha_agenda)).length,
    yesterday: clients.filter((c) => isYesterdayLocal((c as any).fecha_agenda)).length,
    future: clients.filter((c) => isFutureBeyondTomorrowLocal((c as any).fecha_agenda)).length,
  };

  const handleWhatsAppClick = (whatsapp: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const phoneNumber = safeText(whatsapp).replace('@s.whatsapp.net', '');
    const url = `https://wa.me/${phoneNumber}`;
    window.open(url, '_blank');
  };

  /** ===== Render ===== */
  return (
    <div className="space-y-6">
      {/* Modal de selección de sede al inicio (dinámico) */}
      <SedeModal
        isOpen={showSedeModal}
        options={sedes}
        defaultSede={(selectedSede as string) || undefined}
        onSelect={(s) => { setSelectedSede(s); setShowSedeModal(false); }}
      />

      {/* Header de filtros (sede + fecha + nombre) */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/40 p-6">
        <div className="flex flex-col gap-4">
          {/* Sede actual + botón cambiar */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-sm">
              <MapPin className="w-4 h-4" />
              <span className="font-medium">
                Sede: {selectedSede ? selectedSede : '— seleccionar —'}
              </span>
            </span>
            <button
              onClick={() => setShowSedeModal(true)}
              className="text-sm px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
              title="Cambiar sede"
              disabled={sedes.length === 0}
            >
              Cambiar sede
            </button>
          </div>

          {/* Filtros por fecha */}
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            <div className="flex gap-2 flex-wrap flex-1">
              <button
                onClick={() => setDateFilter('today')}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 ${
                  dateFilter === 'today'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg scale-105'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm'
                }`}
              >
                📅 Hoy ({stats.today})
              </button>
              <button
                onClick={() => setDateFilter('tomorrow')}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 ${
                  dateFilter === 'tomorrow'
                    ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg scale-105'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm'
                }`}
              >
                ⏰ Mañana ({stats.tomorrow})
              </button>
              <button
                onClick={() => setDateFilter('yesterday')}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 ${
                  dateFilter === 'yesterday'
                    ? 'bg-gradient-to-r from-orange-600 to-orange-700 text-white shadow-lg scale-105'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm'
                }`}
              >
                📋 Ayer ({stats.yesterday})
              </button>
              <button
                onClick={() => setDateFilter('future')}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 ${
                  dateFilter === 'future'
                    ? 'bg-gradient-to-r from-fuchsia-600 to-fuchsia-700 text-white shadow-lg scale-105'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm'
                }`}
              >
                🔮 Futuras ({stats.future})
              </button>
            </div>

            <div className="flex items-center space-x-3 bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded-xl border border-purple-200">
              <Calendar className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-700">Fecha específica:</span>
              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  setDateFilter('custom');
                }}
                className="px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-300 bg-white"
              />
            </div>
          </div>

          {/* Filtro por nombre + recargar */}
          <div className="flex items-center gap-2">
            <div className="relative w-full max-w-md">
              <input
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="Filtrar por nombre…"
                className="w-full pl-3 pr-9 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              {nameFilter && (
                <button
                  title="Limpiar"
                  onClick={() => setNameFilter('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-gray-100"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              )}
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
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
            <span className="text-gray-600">Cargando agenda...</span>
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Lista */}
      {!loading && !error && (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/40 overflow-hidden">
          {filteredClients.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {filteredClients.map((client) => {
                const attended = (client as any).asistio_agenda === true;
                const nombre = safeText(client.nombre) || 'Sin nombre';
                const modelo = safeText(client.modelo) || 'N/A';
                const ciudad = safeText(client.ciudad) || 'N/A';
                const intencion = safeText(client.intencion);
                const notas = safeText(client.notas);

                return (
                  <div
                    key={client.row_number}
                    onClick={() => setViewClient(client)}
                    className={`p-6 transition-all duration-300 cursor-pointer
                      ${attended
                        ? 'bg-emerald-50 hover:bg-emerald-100/70 border-l-4 border-emerald-500'
                        : 'hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50'}
                    `}
                    role="button"
                    tabIndex={0}
                    aria-label={`Abrir modal de ${nombre}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          {nombre}
                          {attended && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                              <CheckCircle className="w-3.5 h-3.5" />
                              Asistió
                            </span>
                          )}
                        </h3>

                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-sm text-gray-600">
                            <strong>Modelo:</strong> {modelo}
                          </span>
                          <span className="text-sm text-gray-600">
                            <strong>Ciudad:</strong> {ciudad}
                          </span>
                          {/* Mostrar sede deducida */}
                          <span className="text-sm text-gray-600">
                            <strong>Sede:</strong> {getClientSede(client) || '—'}
                          </span>
                        </div>

                        {intencion && (
                          <p className="text-sm text-gray-600 mt-1">
                            <strong>Intención:</strong> {intencion}
                          </p>
                        )}
                        {notas && (
                          <p className="text-sm text-gray-600 mt-1">
                            <strong>Notas:</strong> {notas}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="flex items-center text-purple-600 mb-2 justify-end">
                          <Clock className="w-4 h-4 mr-2" />
                          <span className="font-medium">
                            {displayDate((client as any).fecha_agenda)}
                          </span>
                        </div>

                        <button
                          onClick={(e) => handleWhatsAppClick(client.whatsapp as any, e)}
                          className="flex items-center text-green-600 hover:text-green-700 font-medium transition-colors duration-300 group mb-2 ml-auto"
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          <span className="text-sm">{formatWhatsApp(client.whatsapp as any)}</span>
                        </button>

                        <div className="flex items-center gap-2 justify-end">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border-2 shadow-sm ${getEtapaColor(client.estado_etapa as any)}`}
                          >
                            {(safeText(client.estado_etapa) || 'Sin estado').replace(/_/g, ' ')}
                          </span>
                          {client.categoria_contacto && (
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm ${getCategoriaColor(client.categoria_contacto as any)}`}
                            >
                              {safeText(client.categoria_contacto).replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {selectedSede && selectedSede !== 'Todas' ? (
                  <>
                    {dateFilter === 'today' && `No hay citas programadas para hoy en ${selectedSede}`}
                    {dateFilter === 'tomorrow' && `No hay citas programadas para mañana en ${selectedSede}`}
                    {dateFilter === 'yesterday' && `No hubo citas programadas ayer en ${selectedSede}`}
                    {dateFilter === 'future' && `No hay citas programadas en fechas futuras en ${selectedSede}`}
                    {dateFilter === 'custom' && `No hay citas para la fecha seleccionada en ${selectedSede}`}
                  </>
                ) : (
                  <>
                    {dateFilter === 'today' && 'No hay citas programadas para hoy'}
                    {dateFilter === 'tomorrow' && 'No hay citas programadas para mañana'}
                    {dateFilter === 'yesterday' && 'No hubo citas programadas ayer'}
                    {dateFilter === 'future' && 'No hay citas programadas en fechas futuras'}
                    {dateFilter === 'custom' && 'No hay citas para la fecha seleccionada'}
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal de cliente */}
      <ClientModal
        isOpen={!!viewClient}
        onClose={() => setViewClient(null)}
        client={viewClient}
        onUpdate={onUpdate}
      />
    </div>
  );
};
