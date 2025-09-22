import React, { useEffect, useMemo, useRef } from 'react';
import {
  X,
  Phone,
  Calendar,
  MapPin,
  User,
  Smartphone,
  FileText,
  Settings,
  DollarSign,
  UserCheck,
  Copy,
  MessageCircle,
  ShieldCheck,
  PackageSearch,
  ClipboardList,
  Building2,
  ClipboardCheck,
  Truck,
} from 'lucide-react';
import { Client } from '../types/client';
import { formatDate, formatWhatsApp, getEtapaColor, getCategoriaColor } from '../utils/clientHelpers';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
}

export const ClientModal: React.FC<ClientModalProps> = ({ isOpen, onClose, client }) => {
  // === Hooks: SIEMPRE en el mismo orden, sin returns antes ===
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const safe = (v?: string | number | null) =>
    v !== undefined && v !== null && String(v).trim() ? String(v) : '';

  const phoneE164 = (client?.whatsapp || '').replace('@s.whatsapp.net', '');
  const waLink = useMemo(() => `https://wa.me/${phoneE164}`, [phoneE164]);

  const mailtoAgendar = useMemo(() => {
    const asunto = encodeURIComponent(`Agenda ${safe(client?.nombre) || 'cliente'} - ${safe(client?.modelo)}`);
    const cuerpo = encodeURIComponent(
      [
        `Nombre: ${safe(client?.nombre)}`,
        `Ciudad: ${safe(client?.ciudad)}`,
        `Modelo: ${safe(client?.modelo)}`,
        `Intención: ${safe(client?.intencion)}`,
        `Detalles: ${safe(client?.detalles)}`,
        `Fecha agenda: ${safe(client?.fecha_agenda)}`,
        `Sede/Ciudad agenda: ${safe(client?.agenda_ciudad_sede)}`,
      ].join('\n')
    );
    return `mailto:?subject=${asunto}&body=${cuerpo}`;
  }, [client?.nombre, client?.modelo, client?.ciudad, client?.intencion, client?.detalles, client?.fecha_agenda, client?.agenda_ciudad_sede]);

  const mapsLink = useMemo(() => {
    const q = encodeURIComponent(safe(client?.ciudad) || 'Colombia');
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }, [client?.ciudad]);

  const consentBadge = useMemo(() => {
    const on =
      client?.consentimiento_contacto === true ||
      client?.consentimiento_contacto === '' ||
      client?.consentimiento_contacto === null;
    return on ? (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <ShieldCheck className="w-3.5 h-3.5" />
        Bot activo
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
        <ShieldCheck className="w-3.5 h-3.5" />
        Bot inactivo
      </span>
    );
  }, [client?.consentimiento_contacto]);

  const etapaBadge = useMemo(() => {
    if (!client?.estado_etapa) return null;
    return (
      <span
        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getEtapaColor(
          client.estado_etapa as any
        )}`}
        title="Etapa"
      >
        {String(client.estado_etapa).replace('_', ' ')}
      </span>
    );
  }, [client?.estado_etapa]);

  const categoriaBadge = useMemo(() => {
    if (!client?.categoria_contacto) return null;
    return (
      <span
        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${getCategoriaColor(
          client.categoria_contacto as any
        )}`}
        title="Categoría"
      >
        {String(client.categoria_contacto).replace('_', ' ')}
      </span>
    );
  }, [client?.categoria_contacto]);

  const agendaBadge = useMemo(() => {
    if (!client?.fecha_agenda) return null;
    return (
      <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
        <Calendar className="w-3.5 h-3.5" />
        {formatDate(client.fecha_agenda)}
      </span>
    );
  }, [client?.fecha_agenda]);

  // Cerrar con Esc y bloquear scroll cuando esté abierto
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = original;
    };
  }, [isOpen, onClose]);

  const onOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const hasAny = (...vals: Array<string | number | null | undefined>) =>
    vals.some((v) => safe(v));

  // === Después de declarar TODOS los hooks, ya podemos decidir no renderizar ===
  if (!isOpen || !client) return null;

  const sections: Array<{
    title: string;
    icon: React.ComponentType<any>;
    fields: Array<{ label: string; value?: string | null; icon: React.ComponentType<any> }>;
    show?: boolean;
  }> = [
    {
      title: 'Información Personal',
      icon: User,
      fields: [
        { label: 'Nombre', value: client.nombre, icon: User },
        { label: 'WhatsApp', value: formatWhatsApp(client.whatsapp), icon: Phone },
        { label: 'Ciudad', value: client.ciudad, icon: MapPin },
      ],
      show: hasAny(client.nombre, client.whatsapp, client.ciudad),
    },
    {
      title: 'Dispositivo y Servicio',
      icon: Smartphone,
      fields: [
        { label: 'Modelo', value: client.modelo, icon: Smartphone },
        { label: 'Intención', value: client.intencion, icon: Settings },
        { label: 'Detalles', value: client.detalles, icon: FileText },
        { label: 'Modo de recepción', value: client.modo_recepcion, icon: MapPin },
      ],
      show: hasAny(client.modelo, client.intencion, client.detalles, client.modo_recepcion),
    },
    {
      title: 'Estado y Seguimiento',
      icon: Calendar,
      fields: [
        { label: 'Etapa', value: client.estado_etapa || '', icon: Settings },
        { label: 'Categoría', value: client.categoria_contacto || '', icon: UserCheck },
        { label: 'Fecha agenda', value: client.fecha_agenda ? formatDate(client.fecha_agenda) : '', icon: Calendar },
        { label: 'Asignado a', value: client.asignado_a, icon: User },
        { label: 'Sede/Ciudad agenda', value: client.agenda_ciudad_sede, icon: Building2 },
      ],
      show: true,
    },
    {
      title: 'Diagnóstico y Precios',
      icon: PackageSearch,
      fields: [
        { label: 'Diagnóstico requerido', value: client.diagnostico_requerido, icon: ClipboardCheck },
        { label: 'Equipo manipulado', value: client.equipo_manipulado, icon: ClipboardList },
        { label: 'Precio diagnóstico informado', value: client.precio_diagnostico_informado, icon: DollarSign },
        { label: 'Precio reparación estimado', value: client.precio_reparacion_estimado, icon: DollarSign },
        { label: 'Precio máximo informado', value: client.precio_maximo_informado, icon: DollarSign },
        { label: 'Estado búsqueda de precios', value: client.buscar_precios_status, icon: DollarSign },
        { label: 'Descuento multi-reparación', value: client.descuento_multi_reparacion, icon: DollarSign },
        { label: 'Servicios adicionales', value: client.servicios_adicionales, icon: Settings },
      ],
      show: hasAny(
        client.diagnostico_requerido,
        client.equipo_manipulado,
        client.precio_diagnostico_informado,
        client.precio_reparacion_estimado,
        client.precio_maximo_informado,
        client.buscar_precios_status,
        client.descuento_multi_reparacion,
        client.servicios_adicionales
      ),
    },
    {
      title: 'Notas y Observaciones',
      icon: FileText,
      fields: [
        { label: 'Notas del cliente', value: client.notas_cliente, icon: FileText },
        { label: 'Notas internas', value: client.notas, icon: FileText },
        { label: 'Observaciones técnicas', value: client.observaciones_tecnicas, icon: FileText },
        { label: 'Interés en accesorios', value: client.interes_accesorios, icon: Settings },
      ],
      show: hasAny(client.notas_cliente, client.notas, client.observaciones_tecnicas, client.interes_accesorios),
    },
    {
      title: 'Guía / Envío',
      icon: Truck,
      fields: [
        { label: 'Nombre completo', value: client.guia_nombre_completo, icon: User },
        { label: 'Cédula / ID', value: client.guia_cedula_id, icon: ClipboardList },
        { label: 'Teléfono', value: client.guia_telefono, icon: Phone },
        { label: 'Dirección', value: client.guia_direccion, icon: MapPin },
        { label: 'Ciudad', value: client.guia_ciudad, icon: MapPin },
        { label: 'Departamento/Estado', value: client.guia_departamento_estado, icon: MapPin },
        { label: 'Email', value: client.guia_email, icon: User },
        { label: 'Guía ida', value: client.guia_numero_ida, icon: Truck },
        { label: 'Guía retorno', value: client.guia_numero_retorno, icon: Truck },
        { label: 'Asegurado', value: client.asegurado, icon: ShieldCheck },
        { label: 'Valor seguro', value: client.valor_seguro?.toString(), icon: DollarSign },
      ],
      show: hasAny(
        client.guia_nombre_completo,
        client.guia_cedula_id,
        client.guia_telefono,
        client.guia_direccion,
        client.guia_ciudad,
        client.guia_departamento_estado,
        client.guia_email,
        client.guia_numero_ida,
        client.guia_numero_retorno,
        client.asegurado,
        client.valor_seguro as any
      ),
    },
  ];

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // no-op
    }
  };

  return (
    <div
      ref={overlayRef}
      onMouseDown={onOverlayClick}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Detalle del cliente"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/40 max-w-5xl w-full max-h-[92vh] overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold truncate">
                {safe(client.nombre) || 'Sin nombre'}
              </h2>
              <p className="text-blue-100 truncate">{safe(client.modelo) || 'Sin modelo'}</p>
            </div>

            <div className="hidden md:flex items-center gap-2">
              {etapaBadge}
              {categoriaBadge}
              {agendaBadge}
              {consentBadge}
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-xl transition-colors shrink-0"
              aria-label="Cerrar"
              title="Cerrar"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* badges en móvil */}
          <div className="mt-3 flex md:hidden flex-wrap items-center gap-2">
            {etapaBadge}
            {categoriaBadge}
            {agendaBadge}
            {consentBadge}
          </div>
        </div>

        {/* Quick actions bar */}
        <div className="px-6 py-3 bg-white border-b border-gray-100 flex flex-wrap items-center gap-2">
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition"
            title="Abrir WhatsApp"
          >
            <MessageCircle className="w-4 h-4" />
            {formatWhatsApp(client.whatsapp)}
          </a>

          <button
            onClick={() => handleCopy(phoneE164)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 transition"
            title="Copiar número"
          >
            <Copy className="w-4 h-4" />
            Copiar número
          </button>


          {safe(client.ciudad) && (
            <a
              href={mapsLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition"
              title="Abrir en Maps"
            >
              <MapPin className="w-4 h-4" />
              Maps: {safe(client.ciudad)}
            </a>
          )}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(92vh-152px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sections
              .filter((s) => s.show !== false)
              .map((section, idx) => (
                <div key={idx} className="bg-gray-50/60 rounded-2xl p-6 border border-gray-100">
                  <div className="flex items-center mb-4">
                    <section.icon className="w-5 h-5 text-blue-600 mr-2" />
                    <h3 className="text-lg font-semibold text-gray-800">{section.title}</h3>
                  </div>

                  <div className="space-y-4">
                    {section.fields
                      .filter((f) => safe(f.value))
                      .map((field, j) => (
                        <div key={`${section.title}-${j}`} className="flex items-start gap-3">
                          <field.icon className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-600 mb-1">{field.label}</p>

                            {/* Badges especiales para etapa/categoría */}
                            {field.label.toLowerCase().startsWith('etapa') && client.estado_etapa ? (
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getEtapaColor(
                                  client.estado_etapa as any
                                )}`}
                              >
                                {String(client.estado_etapa).replace('_', ' ')}
                              </span>
                            ) : field.label.toLowerCase().startsWith('categoría') && client.categoria_contacto ? (
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${getCategoriaColor(
                                  client.categoria_contacto as any
                                )}`}
                              >
                                {String(client.categoria_contacto).replace('_', ' ')}
                              </span>
                            ) : (
                              <p className="text-sm text-gray-900 break-words">{safe(field.value)}</p>
                            )}
                          </div>
                        </div>
                      ))}

                    {section.fields.filter((f) => safe(f.value)).length === 0 && (
                      <p className="text-sm text-gray-500">Sin información disponible.</p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
