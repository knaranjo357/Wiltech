import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, RefreshCw, Phone, X } from 'lucide-react';
import { ClientService } from '../services/clientService';
import { Client } from '../types/client';
import { getEtapaColor, getCategoriaColor, formatWhatsApp } from '../utils/clientHelpers';
import { ClientModal } from '../components/ClientModal';

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

export const AgendaPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customDate, setCustomDate] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [savingRow, setSavingRow] = useState<number | null>(null);

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

  /** === Guardado (mismo contrato que en ListView / EnviosPage) === */
  const onUpdate = async (payload: Partial<Client>): Promise<boolean> => {
    if (!payload.row_number) return false;

    // --- OPTIMISTA: parchea inmediatamente y guarda snapshot para rollback ---
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
      // Intenta con el servicio (no dependas del shape de la respuesta)
      if (typeof (ClientService as any).updateClient === 'function') {
        await (ClientService as any).updateClient(payload);
      } else {
        // Fallback HTTP si aplica en tu app
        await fetch('/api/clients/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      return true;
    } catch (e) {
      // --- ROLLBACK si falla ---
      setClients(prevClients);
      setViewClient(prevView);
      setError('No se pudo guardar los cambios');
      return false;
    } finally {
      setSavingRow(null);
    }
  };


  /** === Lista filtrada (fecha + nombre) === */
  const filteredClients = useMemo(() => {
    let filtered = [...clients];

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
      filtered = filtered.filter(c => normalize(String(c.nombre ?? ''))?.includes(q));
    }

    // Orden por hora ascendente
    filtered.sort((a, b) => {
      const ta = parseAgendaDate((a as any).fecha_agenda)?.getTime() ?? 0;
      const tb = parseAgendaDate((b as any).fecha_agenda)?.getTime() ?? 0;
      return ta - tb;
    });

    return filtered;
  }, [clients, dateFilter, customDate, nameFilter]);

  // Contadores para los botones
  const stats = {
    today: clients.filter((c) => isTodayLocal((c as any).fecha_agenda)).length,
    tomorrow: clients.filter((c) => isTomorrowLocal((c as any).fecha_agenda)).length,
    yesterday: clients.filter((c) => isYesterdayLocal((c as any).fecha_agenda)).length,
    future: clients.filter((c) => isFutureBeyondTomorrowLocal((c as any).fecha_agenda)).length,
  };

  const handleWhatsAppClick = (whatsapp: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const phoneNumber = (whatsapp || '').replace('@s.whatsapp.net', '');
    const url = `https://wa.me/${phoneNumber}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header de filtros (fecha + nombre) */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/40 p-6">
        <div className="flex flex-col gap-4">
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

          {/* Filtro por nombre */}
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
              {filteredClients.map((client) => (
                <div
                  key={client.row_number}
                  onClick={() => setViewClient(client)}
                  className="p-6 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 transition-all duration-300 cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`Abrir modal de ${client.nombre || 'cliente'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {client.nombre || 'Sin nombre'}
                      </h3>

                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-sm text-gray-600">
                          <strong>Modelo:</strong> {client.modelo || 'N/A'}
                        </span>
                        <span className="text-sm text-gray-600">
                          <strong>Ciudad:</strong> {client.ciudad || 'N/A'}
                        </span>
                      </div>

                      {client.intencion && (
                        <p className="text-sm text-gray-600 mt-1">
                          <strong>Intención:</strong> {client.intencion}
                        </p>
                      )}
                      {client.notas && (
                        <p className="text-sm text-gray-600 mt-1">
                          <strong>Notas:</strong> {client.notas}
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
                          {(client.estado_etapa || 'Sin_estado').replace(/_/g, ' ')}
                        </span>
                        {client.categoria_contacto && (
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm ${getCategoriaColor(client.categoria_contacto as any)}`}
                          >
                            {(client.categoria_contacto as string).replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {dateFilter === 'today' && 'No hay citas programadas para hoy'}
                {dateFilter === 'tomorrow' && 'No hay citas programadas para mañana'}
                {dateFilter === 'yesterday' && 'No hubo citas programadas ayer'}
                {dateFilter === 'future' && 'No hay citas programadas en fechas futuras'}
                {dateFilter === 'custom' && 'No hay citas para la fecha seleccionada'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal reutilizable con edición inline */}
      <ClientModal
        isOpen={!!viewClient}
        onClose={() => setViewClient(null)}
        client={viewClient}
        onUpdate={onUpdate}
      />
    </div>
  );
};
