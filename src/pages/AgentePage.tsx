import React, { useState, useEffect } from 'react';
import { Bot, Save, RefreshCw } from 'lucide-react';
import { AgenteService } from '../services/agenteService';
import { SystemMessage } from '../types/precios';

export const AgentePage: React.FC = () => {
  const [systemMessage, setSystemMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchSystemMessage = async () => {
    try {
      setLoading(true);
      const data = await AgenteService.getSystemMessage();
      if (data.length > 0) {
        setSystemMessage(data[0].system_message);
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
      await AgenteService.updateSystemMessage(systemMessage);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el mensaje');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchSystemMessage();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Bot className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Configuración del Agente</h2>
        <p className="text-gray-600">Modifica el mensaje del sistema para personalizar el comportamiento del agente</p>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Success alert */}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-green-600">Mensaje del sistema actualizado correctamente</p>
        </div>
      )}

      {/* Main editor */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/40 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-6 py-4 border-b border-gray-200/50">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Mensaje del Sistema</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={fetchSystemMessage}
                disabled={loading}
                className="px-4 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Recargar</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                <span className="text-gray-600">Cargando configuración...</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <textarea
                value={systemMessage}
                onChange={(e) => setSystemMessage(e.target.value)}
                className="w-full h-64 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm transition-all duration-300"
                placeholder="Introduce el mensaje del sistema para el agente..."
              />
              
              <div className="flex items-center justify-between pt-4">
                <div className="text-sm text-gray-500">
                  {systemMessage.length} caracteres
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving || !systemMessage.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center space-x-2"
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