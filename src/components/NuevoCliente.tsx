import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  X,
  Save,
  Phone,
  MapPin,
  User,
  Smartphone,
  FileText,
  Settings,
  DollarSign,
  UserCheck,
  Calendar,
  ShieldCheck,
  PackageSearch,
  ClipboardList,
  ClipboardCheck,
  Truck,
  Mail,
  Bot,
  MessageCircle,
} from 'lucide-react';
import { Client } from '../types/client';

/** ===================== Helpers ===================== **/

/**
 * Normaliza un número ingresado a JID de WhatsApp: 573154479122@s.whatsapp.net
 * Reglas:
 *  - Si viene en 10 dígitos (p.ej. 3154479122) => antepone 57
 *  - Si viene con +57 o 57, lo respeta
 *  - El móvil colombiano debe empezar por 3 y tener 10 dígitos (sin contar el 57)
 * Devuelve { jid, e164 } o null si no es válido.
 */
function toWaJid(raw: string): { jid: string; e164: string } | null {
  if (!raw) return null;
  const digits = (raw || '').replace(/\D+/g, '');

  let e164 = '';
  if (digits.startsWith('57') && digits.length === 12) {
    // 57 + 10 dígitos
    e164 = digits;
  } else if (digits.length === 10 && digits.startsWith('3')) {
    // móvil colombiano sin indicativo
    e164 = '57' + digits;
  } else if (digits.length === 11 && digits.startsWith('03')) {
    // casos donde escriben 0 delante del móvil
    e164 = '57' + digits.slice(1);
  } else if (digits.length > 12 && /57\d{10}$/.test(digits)) {
    // por si pegan con prefijos internacionales tipo 0057 / 01157
    e164 = digits.slice(-12);
  } else {
    return null;
  }

  return { jid: `${e164}@s.whatsapp.net`, e164 };
}

function safe(v?: string | number | null) {
  return v !== undefined && v !== null && String(v).trim() ? String(v) : '';
}

/** Estructura de campos para pintar inputs de forma declarativa */
type FieldType = 'text' | 'textarea' | 'datetime' | 'email' | 'number' | 'boolean';
type FieldDef<K extends keyof Client = keyof Client> = {
  label: string;
  key: K;
  icon: React.ComponentType<any>;
  type?: FieldType;
  required?: boolean;
};

/** ===================== Component ===================== **/

type NuevoClienteProps = {
  /** Llamado al crear con éxito, útil para recargar listas */
  onCreated?: (created: Partial<Client>) => void;
  /** Si lo quieres no-flotante en algún lugar particular */
  floating?: boolean;
};

export const NuevoCliente: React.FC<NuevoClienteProps> = ({ onCreated, floating = true }) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Estado del formulario (Partial<Client> para que sea flexible)
  const [form, setForm] = useState<Partial<Client>>({
    nombre: '',
    whatsapp: '',
    ciudad: '',
    modelo: '',
    intencion: '',
    detalles: '',
    modo_recepcion: '',
    estado_etapa: '',
    categoria_contacto: '',
    fecha_agenda: '',
    asignado_a: '',
    agenda_ciudad_sede: '',
    diagnostico_requerido: '',
    equipo_manipulado: '',
    precio_diagnostico_informado: '',
    precio_reparacion_estimado: '',
    precio_maximo_informado: '',
    buscar_precios_status: '',
    descuento_multi_reparacion: '',
    servicios_adicionales: '',
    notas_cliente: '',
    notas: '',
    observaciones_tecnicas: '',
    interes_accesorios: '',
    guia_nombre_completo: '',
    guia_cedula_id: '',
    guia_telefono: '',
    guia_direccion: '',
    guia_ciudad: '',
    guia_departamento_estado: '',
    guia_email: '',
    guia_numero_ida: '',
    guia_numero_retorno: '',
    asegurado: false as any, // depende de tu tipo (boolean)
    valor_seguro: '' as any, // depende de tu tipo (number | string)
    consentimiento_contacto: true as any, // por defecto on (bot activo)
  });

  const waParsed = useMemo(() => toWaJid(String(form.whatsapp || '')), [form.whatsapp]);
  const waPreviewLink = useMemo(() => (waParsed ? `https://wa.me/${waParsed.e164}` : ''), [waParsed]);

  // Cerrar con click en overlay
  const onOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) setOpen(false);
  };

  // Cerrar con Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = original;
    };
  }, [open]);

  const setVal = <K extends keyof Client>(key: K, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  /** Secciones (mismas que tu modal para mantener consistencia visual) */
  const sections: Array<{ title: string; icon: React.ComponentType<any>; fields: Array<FieldDef> }> = [
    {
      title: 'Información Personal',
      icon: User,
      fields: [
        { label: 'Nombre', key: 'nombre', icon: User, type: 'text' },
        { label: 'WhatsApp (obligatorio)', key: 'whatsapp', icon: Phone, type: 'text', required: true },
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
        { label: 'Sede/Ciudad agenda', key: 'agenda_ciudad_sede', icon: MapPin, type: 'text' },
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
        { label: 'Email', key: 'guia_email', icon: Mail, type: 'email' },
        { label: 'Guía ida', key: 'guia_numero_ida', icon: Truck, type: 'text' },
        { label: 'Guía retorno', key: 'guia_numero_retorno', icon: Truck, type: 'text' },
        { label: 'Asegurado', key: 'asegurado', icon: ShieldCheck, type: 'boolean' },
        { label: 'Valor seguro', key: 'valor_seguro', icon: DollarSign, type: 'number' },
      ],
    },
  ];

  /** Submit */
  const handleSubmit = async () => {
    setError(null);

    // Validar WhatsApp
    const parsed = toWaJid(String(form.whatsapp || ''));
    if (!parsed) {
      setError('Debes ingresar un número de WhatsApp válido. Ej: +57 315 447 9122');
      return;
    }

    // Payload: igual al form, pero whatsapp normalizado a JID
    const payload: Partial<Client> & Record<string, any> = {
      ...form,
      whatsapp: parsed.jid,
    };

    try {
      setSaving(true);

      const res = await fetch('https://n8n.alliasoft.com/webhook/wiltech/clientes-nuevo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || `Error ${res.status}`);
      }

      // Notificar globalmente y callback opcional
      try {
        window.dispatchEvent(new CustomEvent<Partial<Client>>('client:created', { detail: payload }));
        localStorage.setItem('crm:client-created', JSON.stringify({ at: Date.now() }));
      } catch {}

      onCreated?.(payload);

      // Reset & cerrar
      setForm(prev => ({ ...prev, nombre: '', whatsapp: '', ciudad: '' }));
      setOpen(false);
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear el cliente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Botón flotante (esquina inferior derecha) */}
      <div className={floating ? 'fixed bottom-6 right-6 z-[130]' : ''}>
        <button
          onClick={() => setOpen(true)}
          className="btn-primary shadow-lg ring-1 ring-black/5 active:scale-[0.98] inline-flex items-center gap-2"
          aria-label="Nuevo cliente"
          title="Nuevo cliente"
        >
          <Plus className="w-5 h-5" />
          Nuevo cliente
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div
          ref={overlayRef}
          onMouseDown={onOverlayClick}
          className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nuevo-cliente-title"
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="glass rounded-3xl shadow-elevated ring-1 ring-black/5 border border-white/10 max-w-5xl w-full max-h-[92vh] overflow-hidden fade-in"
          >
            {/* Header */}
            <div className="relative px-6 py-5 text-white bg-gradient-to-r from-emerald-600 to-cyan-600">
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-12 rounded-2xl bg-white/20 backdrop-blur-sm ring-1 ring-white/30 flex items-center justify-center">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 id="nuevo-cliente-title" className="text-2xl md:text-3xl font-semibold tracking-tight">
                      Nuevo cliente
                    </h2>
                    <p className="text-emerald-100/90">Crea un registro y habilita el bot si deseas.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="btn bg-white text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                  >
                    <Save className="w-5 h-5" />
                    Guardar
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="btn-ghost text-white"
                    aria-label="Cerrar"
                    title="Cerrar"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Quick actions */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 text-sm text-white/90">
                  <ShieldCheck className="w-4 h-4 opacity-90" />
                  Bot por defecto: <span className="font-semibold ml-1">activo</span>
                </div>
                {!!waParsed && (
                  <a
                    href={waPreviewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="btn bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-emerald-600/10 border border-emerald-200"
                    title="Abrir chat en WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {waParsed.e164}
                  </a>
                )}
              </div>
            </div>

            {/* Alerta de error */}
            {error && (
              <div className="px-6 py-3 bg-red-50 border-b border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(92vh-152px)] bg-neutral-50/60 dark:bg-neutral-950/60">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {sections.map((section) => (
                  <section key={section.title} className="card card-hover">
                    <div className="card-body">
                      <div className="flex items-center mb-4">
                        <div className="w-9 h-9 mr-3 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 flex items-center justify-center">
                          <section.icon className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">{section.title}</h3>
                      </div>

                      <div className="space-y-4">
                        {section.fields.map((field) => {
                          const value: any = (form as any)[field.key] ?? '';
                          const common =
                            'w-full text-sm px-3 py-2 rounded-lg border border-neutral-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900';

                          return (
                            <div
                              key={`${section.title}-${String(field.key)}`}
                              className="group flex items-start gap-3 p-3 rounded-xl border border-neutral-200/70 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/60 hover:shadow-sm transition"
                            >
                              <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 flex items-center justify-center mt-0.5">
                                <field.icon className="w-4 h-4" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="section-title !normal-case !tracking-normal !text-xs !text-neutral-500 dark:!text-neutral-400 mb-1">
                                  {field.label}{field.required ? ' *' : ''}
                                </p>

                                {field.type === 'textarea' ? (
                                  <textarea
                                    value={value}
                                    onChange={(e) => setVal(field.key, e.target.value)}
                                    className={common}
                                    rows={3}
                                    required={field.required}
                                  />
                                ) : field.type === 'datetime' ? (
                                  <input
                                    type="datetime-local"
                                    value={value}
                                    onChange={(e) => setVal(field.key, e.target.value)}
                                    className={common}
                                  />
                                ) : field.type === 'email' ? (
                                  <input
                                    type="email"
                                    value={value}
                                    onChange={(e) => setVal(field.key, e.target.value)}
                                    className={common}
                                  />
                                ) : field.type === 'number' ? (
                                  <input
                                    type="number"
                                    value={value}
                                    onChange={(e) => setVal(field.key, e.target.value === '' ? '' : Number(e.target.value))}
                                    className={common}
                                  />
                                ) : field.type === 'boolean' ? (
                                  <select
                                    value={value === true ? 'true' : value === false ? 'false' : 'true'}
                                    onChange={(e) => setVal(field.key, e.target.value === 'true')}
                                    className={common}
                                  >
                                    <option value="true">Sí</option>
                                    <option value="false">No</option>
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={value}
                                    onChange={(e) => setVal(field.key, e.target.value)}
                                    className={common}
                                    required={field.required}
                                    onBlur={() => {
                                      if (field.key === 'whatsapp' && form.whatsapp) {
                                        const parsed = toWaJid(String(form.whatsapp));
                                        // No sobrescribimos si es inválido; solo dejamos que el submit avise
                                        if (parsed) setVal('whatsapp' as any, parsed.e164); // dejamos e164 visible
                                      }
                                    }}
                                    placeholder={field.key === 'whatsapp' ? '+57 315 447 9122' : undefined}
                                  />
                                )}

                                {field.key === 'whatsapp' && (
                                  <p className="mt-1 text-xs text-neutral-500">
                                    Se guardará como <code className="font-mono">{waParsed ? waParsed.jid : '57XXXXXXXXXX@s.whatsapp.net'}</code>
                                  </p>
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
      )}
    </>
  );
};

export default NuevoCliente;
