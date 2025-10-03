import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Edit2,
  Save,
  Bot,
} from 'lucide-react';
import { Client } from '../types/client';
import { formatDate, formatWhatsApp, getEtapaColor, getCategoriaColor } from '../utils/clientHelpers';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  onUpdate: (client: Partial<Client>) => Promise<boolean>;
}

type FieldType = 'text' | 'textarea' | 'datetime' | 'email' | 'number' | 'boolean';
type FieldDef<K extends keyof Client = keyof Client> = {
  label: string;
  key: K;
  icon: React.ComponentType<any>;
  type?: FieldType;
};

export const ClientModal: React.FC<ClientModalProps> = ({ isOpen, onClose, client, onUpdate }) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Client>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && client) {
      setIsEditing(false);
      setEditData(client); // copia completa
    }
  }, [isOpen, client]);

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

  /** Estado del bot */
  const isBotOn = (v: any) => v === true || v === '' || v === null;

  /** Avatar con iniciales */
  const initials = useMemo(() => {
    const name = safe(client?.nombre);
    if (!name) return '👤';
    const parts = name.split(' ').filter(Boolean);
    return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
  }, [client?.nombre]);

  /** Badges reactivos */
  const consentBadge = useMemo(() => {
    const raw = (editData.consentimiento_contacto ?? client?.consentimiento_contacto) as any;
    const on = isBotOn(raw);
    return on ? (
      <span className="badge badge-success">
        <ShieldCheck className="w-3.5 h-3.5" />
        Bot activo
      </span>
    ) : (
      <span className="badge">
        <ShieldCheck className="w-3.5 h-3.5" />
        Bot inactivo
      </span>
    );
  }, [editData.consentimiento_contacto, client?.consentimiento_contacto]);

  const etapaBadge = useMemo(() => {
    if (!client?.estado_etapa) return null;
    return (
      <span
        className={`badge border ${getEtapaColor(client.estado_etapa as any)} font-semibold`}
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
        className={`badge ${getCategoriaColor(client.categoria_contacto as any)} font-semibold`}
        title="Categoría"
      >
        {String(client.categoria_contacto).replace('_', ' ')}
      </span>
    );
  }, [client?.categoria_contacto]);

  const agendaBadge = useMemo(() => {
    if (!client?.fecha_agenda) return null;
    return (
      <span className="badge bg-purple-50 text-purple-700 border border-purple-200">
        <Calendar className="w-3.5 h-3.5" />
        {formatDate(client.fecha_agenda)}
      </span>
    );
  }, [client?.fecha_agenda]);

  // cierre con Esc + bloqueo scroll
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing) {
          setIsEditing(false);
          setEditData(client || {});
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = original;
    };
  }, [isOpen, onClose, isEditing, client]);

  const onOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      if (isEditing) {
        setIsEditing(false);
        setEditData(client || {});
      } else {
        onClose();
      }
    }
  };

  if (!isOpen || !client) return null;

  // helpers form
  const getVal = <K extends keyof Client>(key: K): any => (editData[key] ?? client[key]) as any;
  const setVal = <K extends keyof Client>(key: K, value: any) => setEditData(prev => ({ ...prev, [key]: value }));

  const handleCopy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  const notifyGlobalUpdate = (payload: Partial<Client>) => {
    try { window.dispatchEvent(new CustomEvent<Partial<Client>>('client:updated', { detail: payload })); } catch {}
    try { localStorage.setItem('crm:client-updated', JSON.stringify({ row_number: payload.row_number, at: Date.now() })); } catch {}
  };

  const handleSave = async () => {
    if (!client) return;
    try {
      setSaving(true);
      const fullPayload: Partial<Client> = { ...editData, row_number: client.row_number };
      const ok = await onUpdate(fullPayload);
      if (ok) {
        notifyGlobalUpdate({ ...client, ...fullPayload });
        setIsEditing(false);
      }
    } finally { setSaving(false); }
  };

  const handleBotToggle = async () => {
    if (!client) return;
    const currentRaw = (editData.consentimiento_contacto ?? client.consentimiento_contacto) as any;
    const currentlyOn = isBotOn(currentRaw);
    const newValue = currentlyOn ? false : true;

    if (currentlyOn) {
      const ok = window.confirm(
        '¿Desea apagar el bot para este contacto?\n' +
        'El asistente dejará de escribir automáticamente por WhatsApp.\n' +
        'Podrá volver a activarlo cuando quiera.'
      );
      if (!ok) return;
    }

    const prevEdit = editData;
    const optimistic = { ...editData, consentimiento_contacto: newValue };
    setEditData(optimistic);
    setSaving(true);

    try {
      const fullPayload: Partial<Client> = {
        ...client,
        ...optimistic,
        row_number: client.row_number,
      };
      const ok = await onUpdate(fullPayload);
      if (ok) {
        notifyGlobalUpdate(fullPayload);
      } else {
        setEditData(prevEdit);
      }
    } catch {
      setEditData(prevEdit);
    } finally { setSaving(false); }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData(client!);
  };

  // secciones
  const sections: Array<{ title: string; icon: React.ComponentType<any>; fields: Array<FieldDef>; }> = [
    {
      title: 'Información Personal',
      icon: User,
      fields: [
        { label: 'Nombre', key: 'nombre', icon: User, type: 'text' },
        { label: 'WhatsApp', key: 'whatsapp', icon: Phone, type: 'text' },
        { label: 'Ciudad', key: 'ciudad', icon: MapPin, type: 'text' },
      ],
    },
    {
      title: 'Dispositivo y Servicio',
      icon: Smartphone,
      fields: [
        { label: 'Modelo', key: 'modelo', icon: Smartphone, type: 'text' },
        { label: 'Intención', key: 'intencion', icon: Settings, type: 'text' },
        { label: 'Detalles', key: 'detalles', icon: FileText, type: 'textarea' },
        { label: 'Modo de recepción', key: 'modo_recepcion', icon: MapPin, type: 'text' },
      ],
    },
    {
      title: 'Estado y Seguimiento',
      icon: Calendar,
      fields: [
        { label: 'Etapa', key: 'estado_etapa', icon: Settings, type: 'text' },
        { label: 'Categoría', key: 'categoria_contacto', icon: UserCheck, type: 'text' },
        { label: 'Fecha agenda', key: 'fecha_agenda', icon: Calendar, type: 'datetime' },
        { label: 'Asignado a', key: 'asignado_a', icon: User, type: 'text' },
        { label: 'Sede/Ciudad agenda', key: 'agenda_ciudad_sede', icon: Building2, type: 'text' },
      ],
    },
    {
      title: 'Diagnóstico y Precios',
      icon: PackageSearch,
      fields: [
        { label: 'Diagnóstico requerido', key: 'diagnostico_requerido', icon: ClipboardCheck, type: 'text' },
        { label: 'Equipo manipulado', key: 'equipo_manipulado', icon: ClipboardList, type: 'text' },
        { label: 'Precio diagnóstico informado', key: 'precio_diagnostico_informado', icon: DollarSign, type: 'text' },
        { label: 'Precio reparación estimado', key: 'precio_reparacion_estimado', icon: DollarSign, type: 'text' },
        { label: 'Precio máximo informado', key: 'precio_maximo_informado', icon: DollarSign, type: 'text' },
        { label: 'Estado búsqueda de precios', key: 'buscar_precios_status', icon: DollarSign, type: 'text' },
        { label: 'Descuento multi-reparación', key: 'descuento_multi_reparacion', icon: DollarSign, type: 'text' },
        { label: 'Servicios adicionales', key: 'servicios_adicionales', icon: Settings, type: 'text' },
      ],
    },
    {
      title: 'Notas y Observaciones',
      icon: FileText,
      fields: [
        { label: 'Notas del cliente', key: 'notas_cliente', icon: FileText, type: 'textarea' },
        { label: 'Notas internas', key: 'notas', icon: FileText, type: 'textarea' },
        { label: 'Observaciones técnicas', key: 'observaciones_tecnicas', icon: FileText, type: 'textarea' },
        { label: 'Interés en accesorios', key: 'interes_accesorios', icon: Settings, type: 'text' },
      ],
    },
    {
      title: 'Guía / Envío',
      icon: Truck,
      fields: [
        { label: 'Nombre completo', key: 'guia_nombre_completo', icon: User, type: 'text' },
        { label: 'Cédula / ID', key: 'guia_cedula_id', icon: ClipboardList, type: 'text' },
        { label: 'Teléfono', key: 'guia_telefono', icon: Phone, type: 'text' },
        { label: 'Dirección', key: 'guia_direccion', icon: MapPin, type: 'text' },
        { label: 'Ciudad', key: 'guia_ciudad', icon: MapPin, type: 'text' },
        { label: 'Departamento/Estado', key: 'guia_departamento_estado', icon: MapPin, type: 'text' },
        { label: 'Email', key: 'guia_email', icon: User, type: 'email' },
        { label: 'Guía ida', key: 'guia_numero_ida', icon: Truck, type: 'text' },
        { label: 'Guía retorno', key: 'guia_numero_retorno', icon: Truck, type: 'text' },
        { label: 'Asegurado', key: 'asegurado', icon: ShieldCheck, type: 'boolean' },
        { label: 'Valor seguro', key: 'valor_seguro', icon: DollarSign, type: 'number' },
      ],
    },
  ];

  return (
    <div
      ref={overlayRef}
      onMouseDown={onOverlayClick}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-modal-title"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="glass rounded-3xl shadow-elevated ring-1 ring-black/5 border border-white/10 max-w-5xl w-full max-h-[92vh] overflow-hidden fade-in"
      >
        {/* Header */}
        <div className="relative px-6 py-5 text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600">
          <div className="absolute inset-0 bg-hero opacity-50 mix-blend-overlay pointer-events-none" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="size-12 rounded-2xl bg-white/20 backdrop-blur-sm ring-1 ring-white/30 flex items-center justify-center text-lg font-semibold">
                {initials}
              </div>
              <div className="min-w-0">
                <h2 id="client-modal-title" className="text-2xl md:text-3xl font-semibold tracking-tight text-balance truncate">
                  {safe(client.nombre) || 'Sin nombre'}
                </h2>
                <p className="text-indigo-100/90 truncate">{safe(client.modelo) || 'Sin modelo'}</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2">
              {etapaBadge}
              {categoriaBadge}
              {agendaBadge}
              {consentBadge}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isEditing ? (
                <button
                  onClick={() => { setIsEditing(true); setEditData(client); }}
                  className="btn-secondary"
                  title="Editar"
                >
                  <Edit2 className="w-5 h-5" />
                  Editar
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary disabled:opacity-60"
                    title="Guardar"
                  >
                    <Save className="w-5 h-5" />
                    Guardar
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="btn-ghost disabled:opacity-60"
                    title="Cancelar"
                  >
                    <X className="w-5 h-5" />
                    Cancelar
                  </button>
                </>
              )}

              <button
                onClick={onClose}
                className="btn-icon hover:bg-white/20 text-white"
                aria-label="Cerrar"
                title="Cerrar"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* badges en móvil */}
          <div className="mt-3 flex md:hidden flex-wrap items-center gap-2">
            {etapaBadge}
            {categoriaBadge}
            {agendaBadge}
            {consentBadge}
          </div>
        </div>

        {/* Quick actions */}
        <div className="px-6 py-3 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-md border-b border-white/40 dark:border-neutral-800 flex flex-wrap items-center gap-2">
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="btn bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-emerald-600/10 border border-emerald-200"
            title="Abrir WhatsApp"
          >
            <MessageCircle className="w-4 h-4" />
            {formatWhatsApp(client.whatsapp)}
          </a>

          <button
            onClick={() => handleCopy(phoneE164)}
            className="btn bg-neutral-100 text-neutral-800 hover:bg-neutral-200"
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
              className="btn bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
              title="Abrir en Maps"
            >
              <MapPin className="w-4 h-4" />
              {safe(client.ciudad)}
            </a>
          )}

          {(() => {
            const on = isBotOn(editData.consentimiento_contacto ?? client.consentimiento_contacto);
            return (
              <button
                onClick={handleBotToggle}
                disabled={saving}
                className={on ? 'btn-primary disabled:opacity-60' : 'btn-secondary disabled:opacity-60'}
                title={on ? 'Apagar bot para este número' : 'Encender bot para este número'}
              >
                <Bot className="w-4 h-4" />
                {on ? 'Apagar bot' : 'Encender bot'}
              </button>
            );
          })()}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(92vh-152px)] bg-neutral-50/60 dark:bg-neutral-950/60">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sections.map((section, idx) => (
              <section key={idx} className="card card-hover">
                <div className="card-body">
                  <div className="flex items-center mb-4">
                    <div className="w-9 h-9 mr-3 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 flex items-center justify-center">
                      <section.icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">{section.title}</h3>
                  </div>

                  <div className="space-y-4">
                    {section.fields.map((field, j) => {
                      const value = getVal(field.key);
                      const Lower = field.label.toLowerCase();
                      const isEmpty = !safe(value);

                      return (
                        <div
                          key={`${section.title}-${j}`}
                          className="group flex items-start gap-3 p-3 rounded-xl border border-neutral-200/70 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/60 hover:shadow-sm transition"
                        >
                          <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 flex items-center justify-center mt-0.5">
                            <field.icon className="w-4 h-4" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="section-title !normal-case !tracking-normal !text-xs !text-neutral-500 dark:!text-neutral-400 mb-1">
                              {field.label}
                            </p>

                            {!isEditing ? (
                              Lower.startsWith('etapa') && client.estado_etapa ? (
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getEtapaColor(client.estado_etapa as any)}`}>
                                  {String(client.estado_etapa).replace('_', ' ')}
                                </span>
                              ) : Lower.startsWith('categoría') && client.categoria_contacto ? (
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getCategoriaColor(client.categoria_contacto as any)}`}>
                                  {String(client.categoria_contacto).replace('_', ' ')}
                                </span>
                              ) : field.key === 'fecha_agenda' && value ? (
                                <span className="inline-flex items-center gap-2 text-purple-700 dark:text-purple-300">
                                  <Calendar className="w-4 h-4" />
                                  {formatDate(String(value))}
                                </span>
                              ) : field.key === 'whatsapp' && value ? (
                                <span className="inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                                  <Phone className="w-4 h-4" />
                                  {formatWhatsApp(String(value))}
                                </span>
                              ) : (
                                <p className={`text-sm break-words ${isEmpty ? 'text-neutral-400 italic' : 'text-neutral-900 dark:text-neutral-100'}`}>
                                  {isEmpty ? '— sin dato —' : safe(value)}
                                </p>
                              )
                            ) : (
                              <>
                                {field.type === 'textarea' ? (
                                  <textarea
                                    value={value ?? ''}
                                    onChange={(e) => setVal(field.key, e.target.value)}
                                    className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900"
                                    rows={3}
                                  />
                                ) : field.type === 'datetime' ? (
                                  <input
                                    type="datetime-local"
                                    value={value ?? ''}
                                    onChange={(e) => setVal(field.key, e.target.value)}
                                    className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900"
                                  />
                                ) : field.type === 'email' ? (
                                  <input
                                    type="email"
                                    value={value ?? ''}
                                    onChange={(e) => setVal(field.key, e.target.value)}
                                    className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900"
                                  />
                                ) : field.type === 'number' ? (
                                  <input
                                    type="number"
                                    value={value ?? ''}
                                    onChange={(e) => setVal(field.key, e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900"
                                  />
                                ) : field.type === 'boolean' ? (
                                  <select
                                    value={value === true ? 'true' : value === false ? 'false' : ''}
                                    onChange={(e) => setVal(field.key, e.target.value === 'true')}
                                    className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900"
                                  >
                                    <option value="true">Sí</option>
                                    <option value="false">No</option>
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={value ?? ''}
                                    onChange={(e) => setVal(field.key, e.target.value)}
                                    className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900"
                                  />
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
