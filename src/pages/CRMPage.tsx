import React, { useEffect, useState } from 'react';
import { Users, RefreshCw } from 'lucide-react';
import { ClientService } from '../services/clientService';
import { Client } from '../types/client';
import { ListView } from '../components/ListView';

export const CRMPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** ===== Data ===== */
  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ClientService.getClients();
      setClients(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  /** ===== Update (optimista con rollback por recarga) ===== */
  const updateClient = async (updatedClient: Partial<Client>) => {
    try {
      const hasKey =
        typeof updatedClient.row_number !== 'undefined' &&
        updatedClient.row_number !== null;

      if (hasKey) {
        setClients(prev =>
          prev.map(c =>
            c.row_number === updatedClient.row_number ? { ...c, ...updatedClient } : c
          )
        );
      }

      await ClientService.updateClient(updatedClient);

      if (!hasKey) {
        await fetchClients();
      }
      return true;
    } catch (err) {
      await fetchClients(); // rollback simple desde servidor
      setError(err instanceof Error ? err.message : 'Error al actualizar');
      return false;
    }
  };

  const total = clients.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/40 p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">CRM</h2>
            <p className="text-sm text-gray-500">{total} cliente{total !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
            <span className="text-gray-600">Cargando clientes...</span>
          </div>
        </div>
      )}

      {/* Error */}
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

      {/* Lista / Vacío */}
      {!loading && !error && (
        <>
          {clients.length > 0 ? (
            <ListView clients={clients} onUpdate={updateClient} />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Aún no hay clientes para mostrar.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
