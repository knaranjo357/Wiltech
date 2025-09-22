import React, { useEffect, useMemo, useState } from 'react';
import { Truck, RefreshCw, Phone } from 'lucide-react';
import { Client } from '../types/client';
import { ClientService } from '../services/clientService';
import { formatWhatsApp } from '../utils/clientHelpers';
import { ClientModal } from '../components/ClientModal';

const hasEnvioInfo = (c: Client): boolean => {
  // Prioriza existencia de cualquier campo de guía / envío
  return Boolean(
    (c.guia_nombre_completo && String(c.guia_nombre_completo).trim()) ||
      (c.guia_cedula_id && String(c.guia_cedula_id).trim()) ||
      (c.guia_telefono && String(c.guia_telefono).trim()) ||
      (c.guia_direccion && String(c.guia_direccion).trim()) ||
      (c.guia_ciudad && String(c.guia_ciudad).trim()) ||
      (c.guia_departamento_estado && String(c.guia_departamento_estado).trim()) ||
      (c.guia_email && String(c.guia_email).trim()) ||
      (c.guia_numero_ida && String(c.guia_numero_ida).trim()) ||
      (c.guia_numero_retorno && String(c.guia_numero_retorno).trim()) ||
      (c.asegurado && String(c.asegurado).trim()) ||
      (c.valor_seguro !== null && c.valor_seguro !== undefined && String(c.valor_seguro).trim())
  );
};

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

export const EnviosPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cityFilter, setCityFilter] = useState<string>('');
  const [sedeFilter, setSedeFilter] = useState<string>(''); // 👈 filtro por agenda_ciudad_sede
  const [search, setSearch] = useState<string>('');

  const [viewClient, setViewClient] = useState<Client | null>(null); // 👈 modal

  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ClientService.getClients();
      const arr = Array.isArray(data) ? (data as Client[]) : [];
      setClients(arr.filter(hasEnvioInfo)); // 👈 solo con info de envíos
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar envíos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // ciudades únicas (prioriza guia_ciudad; si no, ciudad)
  const cities = useMemo(() => {
    const s = new Set<string>();
    clients.forEach((c) => {
      const city = (c.guia_ciudad && String(c.guia_ciudad).trim()) || (c.ciudad && String(c.ciudad).trim()) || '';
      if (city) s.add(city);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [clients]);

  // sedes únicas (agenda_ciudad_sede)
  const sedes = useMemo(() => {
    const s = new Set<string>();
    clients.forEach((c) => {
      const sede = (c.agenda_ciudad_sede && String(c.agenda_ciudad_sede).trim()) || '';
      if (sede) s.add(sede);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [clients]);

  const filtered = useMemo(() => {
    let data = [...clients];

    if (cityFilter) {
      const nf = normalize(cityFilter);
      data = data.filter((c) => {
        const city = (c.guia_ciudad && String(c.guia_ciudad).trim()) || (c.ciudad && String(c.ciudad).trim()) || '';
        return normalize(city) === nf;
      });
    }

    if (sedeFilter) {
      const nf = normalize(sedeFilter);
      data = data.filter((c) => {
        const sede = (c.agenda_ciudad_sede && String(c.agenda_ciudad_sede).trim()) || '';
        return normalize(sede) === nf;
      });
    }

    if (search.trim()) {
      const q = normalize(search.trim());
      data = data.filter((c) => {
        const nombre = normalize(String(c.nombre || ''));
        const modelo = normalize(String(c.modelo || ''));
        const dir = normalize(String(c.guia_direccion || ''));
        const ida = normalize(String(c.guia_numero_ida || ''));
        const ret = normalize(String(c.guia_numero_retorno || ''));
        const ciudad = normalize(String(c.guia_ciudad || c.ciudad || ''));
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

    // Orden sugerido: por número de guía ida descendente (string compare numérico)
    data.sort((a, b) => {
      const aIda = String(a.guia_numero_ida || '');
      const bIda = String(b.guia_numero_ida || '');
      return bIda.localeCompare(aIda, 'es', { numeric: true, sensitivity: 'base' });
    });

    return data;
  }, [clients, cityFilter, sedeFilter, search]);

  const total = filtered.length;

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
              {total} registro{total !== 1 ? 's' : ''} con información de guía
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
              {sedes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-purple-500"
              title="Filtrar por ciudad (destino)"
            >
              <option value="">Todas las ciudades</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
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
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm">Recargar</span>
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
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">WhatsApp</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Sede</th> {/* agenda_ciudad_sede */}
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Ciudad</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Dirección</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Guía ida</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Guía retorno</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Asegurado</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Valor seguro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c, i) => {
                  const ciudad = (c.guia_ciudad && String(c.guia_ciudad).trim()) || String(c.ciudad || '');
                  const direccion = String(c.guia_direccion || '');
                  const ida = String(c.guia_numero_ida || '');
                  const ret = String(c.guia_numero_retorno || '');
                  const asegurado = String(c.asegurado || '');
                  const valorSeguro = c.valor_seguro !== undefined && c.valor_seguro !== null ? String(c.valor_seguro) : '';
                  const sede = String(c.agenda_ciudad_sede || '');

                  return (
                    <tr
                      key={`${c.row_number}-${i}`}
                      className="hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-blue-50/50 transition-colors cursor-pointer"
                      onClick={() => setViewClient(c)} // 👈 abre modal
                      tabIndex={0}
                      role="button"
                    >
                      <td className="px-4 py-4">
                        <div className="text-gray-900 font-medium">{c.nombre || 'Sin nombre'}</div>
                        <div className="text-xs text-gray-500">{c.modelo || ''}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="inline-flex items-center gap-1.5 text-green-700">
                          <Phone className="w-4 h-4" />
                          {formatWhatsApp(c.whatsapp)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-gray-900">{sede || '-'}</td>
                      <td className="px-4 py-4 text-gray-900">{ciudad || '-'}</td>
                      <td className="px-4 py-4 text-gray-900 break-words max-w-[280px]">{direccion || '-'}</td>
                      <td className="px-4 py-4 text-gray-900">{ida || '-'}</td>
                      <td className="px-4 py-4 text-gray-900">{ret || '-'}</td>
                      <td className="px-4 py-4 text-gray-900">{asegurado || '-'}</td>
                      <td className="px-4 py-4 text-gray-900">{valorSeguro || '-'}</td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                      No hay registros de envíos que coincidan con el filtro.
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
      />
    </div>
  );
};
