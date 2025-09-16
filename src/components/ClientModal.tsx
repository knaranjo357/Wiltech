import React from 'react';
import { X, Phone, Calendar, MapPin, User, Smartphone, FileText, Settings, DollarSign, UserCheck } from 'lucide-react';
import { Client } from '../types/client';
import { formatDate, formatWhatsApp, getEtapaColor, getCategoriaColor } from '../utils/clientHelpers';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
}

export const ClientModal: React.FC<ClientModalProps> = ({ isOpen, onClose, client }) => {
  if (!isOpen || !client) return null;

  const infoSections = [
    {
      title: 'Información Personal',
      icon: User,
      fields: [
        { label: 'Nombre', value: client.nombre, icon: User },
        { label: 'WhatsApp', value: formatWhatsApp(client.whatsapp), icon: Phone },
        { label: 'Ciudad', value: client.ciudad, icon: MapPin },
      ]
    },
    {
      title: 'Dispositivo y Servicio',
      icon: Smartphone,
      fields: [
        { label: 'Modelo', value: client.modelo, icon: Smartphone },
        { label: 'Intención', value: client.intencion, icon: Settings },
        { label: 'Detalles', value: client.detalles, icon: FileText },
        { label: 'Modo de Recepción', value: client.modo_recepcion, icon: MapPin },
      ]
    },
    {
      title: 'Estado y Seguimiento',
      icon: Calendar,
      fields: [
        { label: 'Etapa', value: client.estado_etapa, icon: Settings, isEtapa: true },
        { label: 'Categoría', value: client.categoria_contacto, icon: UserCheck, isCategoria: true },
        { label: 'Fecha Agenda', value: client.fecha_agenda ? formatDate(client.fecha_agenda) : '', icon: Calendar },
        { label: 'Asignado a', value: client.asignado_a, icon: User },
      ]
    },
    {
      title: 'Información Adicional',
      icon: FileText,
      fields: [
        { label: 'Precios Status', value: client.buscar_precios_status, icon: DollarSign },
        { label: 'Servicios Adicionales', value: client.servicios_adicionales, icon: Settings },
        { label: 'Descuento Multi-reparación', value: client.descuento_multi_reparacion, icon: DollarSign },
        { label: 'Notas', value: client.notas, icon: FileText },
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/40 max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{client.nombre}</h2>
              <p className="text-blue-100">{client.modelo}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-xl transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {infoSections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100">
                <div className="flex items-center mb-4">
                  <section.icon className="w-5 h-5 text-blue-600 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-800">{section.title}</h3>
                </div>
                <div className="space-y-4">
                  {section.fields.map((field, fieldIndex) => (
                    <div key={fieldIndex} className="flex items-start space-x-3">
                      <field.icon className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-600 mb-1">{field.label}</p>
                        {field.isEtapa ? (
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getEtapaColor(field.value as any)}`}>
                            {field.value?.replace('_', ' ')}
                          </span>
                        ) : field.isCategoria ? (
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${getCategoriaColor(field.value as any)}`}>
                            {field.value?.replace('_', ' ')}
                          </span>
                        ) : (
                          <p className="text-sm text-gray-900 break-words">
                            {field.value || 'No especificado'}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};