// pages/AgentePage.tsx
import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, MapPin } from 'lucide-react';
import { AgenteService, AgentSource } from '../services/agenteService';

const SOURCE_LABEL: Record<AgentSource, string> = {
  Wiltech: 'Bogotá',
  WiltechBga: 'Bucaramanga',
};

export const AgentePage: React.FC = () => {
  const [systemMessage, setSystemMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [source, setSource] = useState<AgentSource>(() => {
    try {
      const saved = localStorage.getItem('agente:selectedSource') as AgentSource | null;
      return saved === 'WiltechBga' ? 'WiltechBga' : 'Wiltech';
    } catch {
      return 'Wiltech';
    }
  });

  const persistSource = (s: AgentSource) => {
    try { localStorage.setItem('agente:selectedSource', s); } catch {}
  };

  const fetchSystemMessage = async (s: AgentSource = source) => {
    try {
      setLoading(true);
      const data = await AgenteService.getSystemMessage(s);
      if (Array.isArray(data) && data.length > 0) {
        setSystemMessage(data[0].system_message);
      } else {
        setSystemMessage('');
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el mensaje');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await AgenteService.updateSystemMessage(systemMessage, source);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el mensaje');
    } finally {
      setSaving(false);
    }
  };

  // Cargar al inicio y cuando cambie la sede/source
  useEffect(() => {
    fetchSystemMessage(source);
  }, [source]);

  return (
    // Contenedor a pantalla completa (ancho y alto)
    <div className="w-full h-[100dvh] p-4">
      {/* Alertas */}
      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-600">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-green-600">Mensaje del sistema actualizado correctamente</p>
        </div>
      )}

      {/* Card principal */}
      <div className="h-[calc(100%-0rem)] bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/40 flex flex-col overflow-hidden">
        {/* Barra superior */}
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-4 py-3 border-b border-gray-200/50">
          <div className="flex items-center justify-between gap-3">
            {/* Selector de sede/source */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm">
                <MapPin className="w-4 h-4" />
                <span className="font-medium">Sede:</span>
                <span className="font-semibold">{SOURCE_LABEL[source]}</span>
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setSource('Wiltech'); persistSource('Wiltech'); }}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition
                    ${source === 'Wiltech'
                      ? 'bg-white border-blue-500 ring-2 ring-blue-200'
                      : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                >
                  Bogotá
                </button>
                <button
                  onClick={() => { setSource('WiltechBga'); persistSource('WiltechBga'); }}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition
                    ${source === 'WiltechBga'
                      ? 'bg-white border-blue-500 ring-2 ring-blue-200'
                      : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                >
                  Bucaramanga
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchSystemMessage(source)}
                disabled={loading}
                className="px-3 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                aria-label="Recargar"
                title="Recargar"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Recargar</span>
              </button>
            </div>
          </div>
        </div>

        {/* Zona de edición */}
        <div className="flex-1 min-h-0 p-4">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                <span className="text-gray-600">Cargando configuración...</span>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <textarea
                value={systemMessage}
                onChange={(e) => setSystemMessage(e.target.value)}
                className="flex-1 min-h-0 w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm transition-all"
                placeholder={`Introduce el mensaje del sistema para el agente (${SOURCE_LABEL[source]})...`}
              />

              {/* Barra inferior */}
              <div className="flex items-center justify-between pt-4">
                <div className="text-sm text-gray-500">
                  {systemMessage.length} caracteres
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving || !systemMessage.trim()}
                  className="px-5 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 flex items-center gap-2"
                  title={`Guardar para ${SOURCE_LABEL[source]}`}
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Guardar Cambios</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
