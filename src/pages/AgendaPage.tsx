import React, { useState, useEffect } from 'react';
import { Calendar, Clock, X } from 'lucide-react';
import { ClientService } from '../services/clientService';
import { Client } from '../types/client';
import { getEtapaColor, getCategoriaColor, formatWhatsApp } from '../utils/clientHelpers';

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

type DateFilter = 'today' | 'tomorrow' | 'yesterday' | 'custom';

export const AgendaPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customDate, setCustomDate] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

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

  // Filtrado por fecha + orden por hora
  useEffect(() => {
    let filtered = clients;

    switch (dateFilter) {
      case 'today':
        filtered = clients.filter((c) => isTodayLocal((c as any).fecha_agenda));
        break;
      case 'tomorrow':
        filtered = clients.filter((c) =>
          isTomorrowLocal((c as any).fecha_agenda)
        );
        break;
      case 'yesterday':
        filtered = clients.filter((c) =>
          isYesterdayLocal((c as any).fecha_agenda)
        );
        break;
      case 'custom':
        if (customDate) {
          const [y, m, d] = customDate.split('-').map(Number);
          const sel = new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0);
          filtered = clients.filter((c) => {
            const cd = parseAgendaDate((c as any).fecha_agenda);
            return cd ? sameLocalDay(cd, sel) : false;
          });
        } else {
          filtered = [];
        }
        break;
    }

    filtered.sort((a, b) => {
      const ta = parseAgendaDate((a as any).fecha_agenda)?.getTime() ?? 0;
      const tb = parseAgendaDate((b as any).fecha_agenda)?.getTime() ?? 0;
      return ta - tb;
    });

    setFilteredClients(filtered);
  }, [clients, dateFilter, customDate]);

  // Contadores para los botones
  const stats = {
    today: clients.filter((c) => isTodayLocal((c as any).fecha_agenda)).length,
    tomorrow: clients.filter((c) => isTomorrowLocal((c as any).fecha_agenda))
      .length,
    yesterday: clients.filter((c) => isYesterdayLocal((c as any).fecha_agenda))
      .length,
  };

  const handleWhatsAppClick = (whatsapp: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const phoneNumber = (whatsapp || '').replace('@s.whatsapp.net', '');
    const url = `https://wa.me/${phoneNumber}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Filtros por fecha */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/40 p-6">
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
                  onClick={() => setSelectedClient(client)}
                  className="p-6 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 transition-all duration-300 cursor-pointer"
                  role="button"
                  tabIndex={0}
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
                        <span className="text-sm">
                          {formatWhatsApp(client.whatsapp as any)}
                        </span>
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
                {dateFilter === 'custom' && 'No hay citas para la fecha seleccionada'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal de detalle */}
      <AgendaClientModal
        client={selectedClient}
        onClose={() => setSelectedClient(null)}
        onOpenWhatsApp={(wa) => handleWhatsAppClick(wa)}
      />
    </div>
  );
};

/** ================== Modal ================== */
const AgendaClientModal: React.FC<{
  client: Client | null;
  onClose: () => void;
  onOpenWhatsApp: (whatsapp: string) => void;
}> = ({ client, onClose, onOpenWhatsApp }) => {
  if (!client) return null;

  const field = (val?: string | null) =>
    val && String(val).trim() ? String(val) : '—';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {field(client.nombre)}
            </h3>
            <p className="text-sm text-gray-600">
              {field(client.ciudad)} • {field(client.modelo)}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/70 transition"
            aria-label="Cerrar"
            title="Cerrar"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Chips */}
          <div className="flex flex-wrap gap-2">
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

          {/* Agenda */}
          <section>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Agenda</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-600" />
                <span className="text-gray-600">Fecha y hora:</span>
                <span className="font-medium text-gray-900">
                  {displayDate((client as any).fecha_agenda)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Recepción:</span>
                <span className="font-medium text-gray-900">
                  {field(client.modo_recepcion)}
                </span>
              </div>
            </div>
          </section>

          {/* Contacto */}
          <section>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Contacto</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">WhatsApp:</span>
                <button
                  onClick={() => onOpenWhatsApp(client.whatsapp as any)}
                  className="font-medium text-green-700 hover:text-green-800 underline underline-offset-2"
                  title="Abrir chat"
                >
                  {formatWhatsApp(client.whatsapp as any)}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Ciudad:</span>
                <span className="font-medium text-gray-900">{field(client.ciudad)}</span>
              </div>
            </div>
          </section>

          {/* Detalles */}
          <section>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Detalles</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <KV label="Intención" value={client.intencion} />
              <KV label="Modelo" value={client.modelo} />
              <KV label="Estado precios" value={client.buscar_precios_status} />
              <KV label="Servicios adicionales" value={client.servicios_adicionales} />
              <KV label="Descuento multi-reparación" value={client.descuento_multi_reparacion} />
              <KV label="Asignado a" value={client.asignado_a} />
              <div className="md:col-span-2">
                <KV label="Descripción / Detalles" value={client.detalles} />
              </div>
              <div className="md:col-span-2">
                <KV label="Notas" value={client.notas} />
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={() => onOpenWhatsApp(client.whatsapp as any)}
            className="px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 transition"
          >
            Abrir WhatsApp
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

const KV: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <div className="flex gap-2">
    <span className="text-gray-600 min-w-40">{label}:</span>
    <span className="font-medium text-gray-900">{value && String(value).trim() ? value : '—'}</span>
  </div>
);
