import { RepairLoader } from './RepairLoader';
// src/components/NuevoCliente.tsx
import React, { useMemo, useState } from 'react';
import {
  Plus, X, Save, Phone, MapPin, User, Smartphone, FileText, Settings, 
  DollarSign, UserCheck, Calendar, ShieldCheck, ClipboardList, ClipboardCheck, 
  Truck, Mail, Bot, MessageCircle, Percent, ChevronRight, Fingerprint,
  Globe, ShoppingBag
} from 'lucide-react';
import { Client } from '../types/client';
import { ClientService } from '../services/clientService';
import { AuthService } from '../services/authService';
import { ModalPortal } from './ModalPortal';
import { SedeSelect } from './SedeSelect';
import { StageAutocomplete } from './StageAutocomplete';

/** ===================== Helpers ===================== **/

/**
 * Normaliza un número para guardar en BD: 573001234567@s.whatsapp.net
 */
function toWaJid(raw: string, country: string): { jid: string; e164: string } | null {
  if (!raw) return null;
  const digits = raw.replace(/\D+/g, '');

  let e164 = '';
  
  if (raw.trim().startsWith('+') && /^[1-9]\d{7,14}$/.test(digits)) {
    e164 = digits;
  } else if (country === 'Mexico' || country === 'México') {
    if (digits.length === 10) e164 = '52' + digits;
    else if (digits.startsWith('52') && digits.length === 12) e164 = digits;
    else return null;
  } else if (country !== 'Colombia') {
    return null;
  } else if (digits.startsWith('57') && digits.length === 12) {
    e164 = digits;
  } else if (digits.length === 10 && digits.startsWith('3')) {
    e164 = '57' + digits;
  } else if (digits.length === 11 && digits.startsWith('03')) {
    e164 = '57' + digits.slice(1);
  } else {
    return null;
  }

  return { jid: `${e164}@s.whatsapp.net`, e164 };
}

/** Tipos de campo idénticos a ClientModal */
type FieldType = 'text' | 'textarea' | 'datetime' | 'email' | 'number' | 'boolean' | 'sede';

type FieldDef<K extends keyof Client = keyof Client> = {
  label: string;
  key: K;
  icon: typeof User;
  type?: FieldType;
  required?: boolean;
  placeholder?: string;
};

type NuevoClienteProps = {
  onCreated?: (created: Partial<Client>) => void;
  floating?: boolean;
};

export const NuevoCliente: React.FC<NuevoClienteProps> = ({ onCreated, floating = true }) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeCountry = AuthService.getPaisSede();

  // Estado inicial del formulario (Bot activo por defecto: true)
  const initialForm: Partial<Client> = {
    nombre: '',
    whatsapp: '',
    ciudad: '',
    modelo: '',
    intencion: '',
    detalles: '',
    modo_recepcion: '',
    estado_etapa: 'Nuevo',
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
    asegurado: false,
    valor_seguro: '',
    consentimiento_contacto: true,
  };

  const [form, setForm] = useState<Partial<Client>>(initialForm);

  // Preview del WhatsApp
  const waParsed = useMemo(() => toWaJid(String(form.whatsapp || ''), activeCountry), [form.whatsapp, activeCountry]);

  // Manejadores de cierre
  const handleClose = () => {
    if (saving) return;
    const hasChanges = Object.entries(form).some(([key, value]) => value !== initialForm[key as keyof Client] && value !== '');
    if (hasChanges && !window.confirm("¿Deseas cerrar? Se perderán los datos ingresados.")) {
       return;
    }
    setOpen(false);
    setForm(initialForm);
    setError(null);
  };

  const setVal = (key: keyof Client, value: Client[keyof Client]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // ================= SECCIONES (Estilo Idéntico a ClientModal) =================
  const sections: Array<{ title: string; icon: typeof User; fields: Array<FieldDef>; iconColor: string }> = [
    {
      title: 'Contacto y Agenda',
      icon: User,
      iconColor: 'text-blue-600 bg-blue-50',
      fields: [
        { label: 'Nombre', key: 'nombre', icon: User, type: 'text', required: true },
        { label: 'WhatsApp', key: 'whatsapp', icon: Phone, type: 'text', required: true, placeholder: activeCountry === 'Colombia' ? '+57 300 123 4567' : ['Mexico', 'México'].includes(activeCountry) ? '+52 55 1234 5678' : '+ Código de país y número' },
        { label: 'Fecha agenda', key: 'fecha_agenda', icon: Calendar, type: 'datetime' },
        { label: 'Sede Agendada', key: 'agenda_ciudad_sede', icon: MapPin, type: 'sede' },
        { label: 'Ciudad', key: 'ciudad', icon: MapPin, type: 'text' },
        { label: 'Subscriber ID', key: 'subscriber_id', icon: Fingerprint, type: 'text' },
      ],
    },
    {
      title: 'Dispositivo y Detalle',
      icon: Smartphone,
      iconColor: 'text-slate-800 bg-slate-50',
      fields: [
        { label: 'Modelo', key: 'modelo', icon: Smartphone, type: 'text' },
        { label: 'Intención', key: 'intencion', icon: Settings, type: 'text' },
        { label: 'Detalles', key: 'detalles', icon: FileText, type: 'textarea' },
        { label: 'Recepción', key: 'modo_recepcion', icon: MapPin, type: 'text' },
      ],
    },
    {
      title: 'Información Comercial',
      icon: Calendar,
      iconColor: 'text-teal-600 bg-teal-50',
      fields: [
        { label: 'Etapa', key: 'estado_etapa', icon: Settings, type: 'text' },
        { label: 'Categoría', key: 'categoria_contacto', icon: UserCheck, type: 'text' },
        { label: 'Asignado a', key: 'asignado_a', icon: User, type: 'text' },
      ],
    },
    {
      title: 'Diagnóstico y Precios',
      icon: DollarSign,
      iconColor: 'text-green-600 bg-green-50',
      fields: [
        { label: 'Diag. requerido', key: 'diagnostico_requerido', icon: ClipboardCheck, type: 'text' },
        { label: 'Eq. manipulado', key: 'equipo_manipulado', icon: ClipboardList, type: 'text' },
        { label: 'Precio Diag.', key: 'precio_diagnostico_informado', icon: DollarSign, type: 'text' },
        { label: 'Precio Estimado', key: 'precio_reparacion_estimado', icon: DollarSign, type: 'text' },
        { label: 'Buscar precios', key: 'buscar_precios_status', icon: DollarSign, type: 'text' },
        { label: 'Descuento', key: 'descuento_multi_reparacion', icon: Percent, type: 'text' },
        { label: 'Servicios extra', key: 'servicios_adicionales', icon: Settings, type: 'text' },
        { label: 'Interés acc.', key: 'interes_accesorios', icon: ShoppingBag, type: 'text' },
      ],
    },
    {
      title: 'Logística y Envío',
      icon: Truck,
      iconColor: 'text-orange-600 bg-orange-50',
      fields: [
        { label: 'Nombre Guía', key: 'guia_nombre_completo', icon: User, type: 'text' },
        { label: 'Cédula / ID', key: 'guia_cedula_id', icon: ClipboardList, type: 'text' },
        { label: 'Teléfono Guía', key: 'guia_telefono', icon: Phone, type: 'text' },
        { label: 'Dirección', key: 'guia_direccion', icon: MapPin, type: 'text' },
        { label: 'Ciudad Guía', key: 'guia_ciudad', icon: MapPin, type: 'text' },
        { label: 'Email Guía', key: 'guia_email', icon: Mail, type: 'email' },
        { label: 'Guía Ida', key: 'guia_numero_ida', icon: Truck, type: 'text' },
        { label: 'Guía Retorno', key: 'guia_numero_retorno', icon: Truck, type: 'text' },
        { label: 'Asegurado', key: 'asegurado', icon: ShieldCheck, type: 'boolean' },
        { label: 'Valor Seguro', key: 'valor_seguro', icon: DollarSign, type: 'text' },
      ],
    },
    {
      title: 'Notas',
      icon: FileText,
      iconColor: 'text-amber-600 bg-amber-50',
      fields: [
        { label: 'Notas cliente', key: 'notas_cliente', icon: FileText, type: 'textarea' },
        { label: 'Notas internas', key: 'notas', icon: FileText, type: 'textarea' },
        { label: 'Obs. técnicas', key: 'observaciones_tecnicas', icon: FileText, type: 'textarea' },
      ],
    },
  ];

  // ================= SUBMIT =================
  const handleSubmit = async () => {
    if (saving) return;
    setError(null);

    // Validaciones
    if (!form.nombre?.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }

    const parsed = toWaJid(String(form.whatsapp || ''), activeCountry);
    if (!parsed) {
      setError('Revisa el WhatsApp. Incluye + y el código de país; para Colombia y México también puedes escribir los 10 dígitos locales.');
      return;
    }

    // Validación dependiente para Sede y Fecha de agenda
    if ((form.fecha_agenda && !form.agenda_ciudad_sede) || (!form.fecha_agenda && form.agenda_ciudad_sede)) {
      setError('Si ingresas la Sede Agendada, debes especificar la Fecha de Agenda y viceversa.');
      return;
    }

    // Payload
    const payload: Partial<Client> = {
      ...form,
      pais_sede: activeCountry,
      whatsapp: parsed.jid,
      created: new Date().toISOString(),
      last_msg: new Date().toISOString(),
      // Bot activo (true) si no se especificó lo contrario
      consentimiento_contacto: form.consentimiento_contacto === true,
    };

    try {
      setSaving(true);
      await ClientService.createClient(payload);

      // Eventos globales
      try {
        window.dispatchEvent(new CustomEvent<Partial<Client>>('client:created', { detail: payload }));
        // Forzar actualización en listas
        window.dispatchEvent(new CustomEvent<Partial<Client>>('client:updated', { detail: { ...payload, row_number: 999999 } }));
      } catch { /* Creation succeeded even if the browser cannot dispatch an event. */ }

      if (onCreated) onCreated(payload);
      
      setForm(initialForm);
      setOpen(false);

    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Error al crear el cliente.');
    } finally {
      setSaving(false);
    }
  };



  return (
    <>
      {/* Botón Flotante */}
      {floating && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-4 duration-500">
          <button
            onClick={() => setOpen(true)}
            className="group flex items-center gap-2.5 bg-slate-950 text-white px-4 py-3 rounded-xl shadow-lg shadow-slate-900/20 hover:bg-black hover:shadow-xl transition-all duration-200 active:scale-95 border border-slate-800"
            title="Crear Nuevo Cliente"
          >
            <span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
            </span>
            <span className="font-bold text-sm tracking-wide">Nuevo Cliente</span>
          </button>
        </div>
      )}

      <ModalPortal open={open} onClose={handleClose} ariaLabel="Nuevo cliente" className="flex max-h-[92dvh] w-full max-w-3xl flex-col">
            <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-5 sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-zinc-950">Nuevo cliente</h2>
                    <p className="mt-1 text-sm text-slate-500">Empieza con su nombre, WhatsApp, fecha y sede de agenda.</p>
                  </div>
                </div>
                <button onClick={handleClose} disabled={saving} aria-label="Cerrar nuevo cliente" className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  <Globe className="h-3.5 w-3.5" /> {activeCountry}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  <Bot className="h-3.5 w-3.5" /> Bot activo
                </span>
                <span className="text-xs text-slate-400">Los campos con * son obligatorios</span>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div role="alert" className="shrink-0 px-6 py-3 bg-red-50 border-b border-red-100 flex items-center gap-3 text-red-700 text-sm animate-in slide-in-from-top-2">
                <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                   <X className="w-4 h-4 text-red-600" />
                </div>
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Scrollable Body */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
              <div className="space-y-3">
                {sections.map((section, idx) => (
                  <details key={idx} open={idx < 2} className="group/section rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {/* Section Header */}
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-4 outline-none focus-visible:ring-2 focus-visible:ring-slate-400 sm:px-5 [&::-webkit-details-marker]:hidden">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl shadow-sm ${section.iconColor}`}>
                                <section.icon className="w-5 h-5" />
                            </div>
                            <div><h3 className="text-sm font-semibold text-slate-800">{section.title}</h3><p className="mt-0.5 text-xs text-slate-400">{idx === 0 ? "Datos de contacto y programación de la visita" : "Opcional · Puedes completarlo después"}</p></div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open/section:rotate-90" />
                    </summary>

                    {/* Fields */}
                    <div className="p-5 bg-white grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 rounded-b-2xl border-t border-slate-100">
                      {section.fields.map((field, j) => {
                        const isFullWidth = field.type === 'textarea';
                        const val = form[field.key];

                        return (
                          <div key={j} className={`flex flex-col gap-1.5 ${isFullWidth ? 'sm:col-span-2' : ''}`}>
                             <label className="text-xs font-semibold text-slate-600 pl-0.5 flex items-center justify-between">
                                {field.label} {field.required && <span className="text-red-500">*</span>}
                             </label>
                             
                             <div className="relative group">
                               {field.key === 'estado_etapa' ? (
                                 <StageAutocomplete
                                   value={val}
                                   onChange={(nextValue) => setVal('estado_etapa', nextValue)}
                                 />
                               ) : field.type === 'textarea' ? (
                                 <textarea aria-label={field.label}
                                   value={String(val ?? '')}
                                   onChange={(e) => setVal(field.key, e.target.value)}
                                   rows={3}
                                   className="w-full text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900/20 focus:border-slate-600 outline-none transition-all px-3 py-2.5 resize-none placeholder:text-slate-300 min-h-[80px]"
                                   placeholder="Escribe aquí..."
                                 />
                               ) : field.type === 'boolean' ? (
                                 <div className="relative">
                                    <select aria-label={field.label}
                                      value={val === true ? 'true' : 'false'}
                                      onChange={(e) => setVal(field.key, e.target.value === 'true')}
                                      className="w-full text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900/20 focus:border-slate-600 outline-none transition-all px-3 py-2.5 appearance-none"
                                    >
                                      <option value="true">Sí</option>
                                      <option value="false">No</option>
                                    </select>
                                    <ChevronRight className="absolute right-3 top-3 w-4 h-4 text-gray-400 rotate-90 pointer-events-none"/>
                                 </div>
                               ) : field.type === 'datetime' ? (
                                 <input
                                   aria-label={field.label} type="datetime-local"
                                   value={String(val ?? '')}
                                   onChange={(e) => setVal(field.key, e.target.value)}
                                   className="w-full text-sm bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all px-3 py-2.5"
                                 />
                               ) : field.type === 'sede' || field.key === 'ciudad' || field.key === 'guia_ciudad' ? (
                                 <SedeSelect
                                   placeholder={`Selecciona o escribe ${field.label.toLowerCase()}`}
                                   value={String(val ?? '')}
                                   onChange={(v) => setVal(field.key, v)}
                                 />
                               ) : (
                                 <input
                                   aria-label={field.label}
                                   aria-required={field.required}
                                   type={field.key === 'whatsapp' ? 'tel' : field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                                   value={String(val ?? '')}
                                   onChange={(e) => setVal(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                                   placeholder={field.placeholder || field.label}
                                   className="w-full text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900/20 focus:border-slate-600 outline-none transition-all px-3 py-2.5 placeholder:text-slate-300"
                                 />
                               )}
                               
                               {/* WhatsApp Validation Visual Feedback */}
                               {field.key === 'whatsapp' && form.whatsapp && (
                                 <div className="absolute right-3 top-3">
                                    {waParsed ? (
                                      <MessageCircle className="w-4 h-4 text-green-500 animate-in zoom-in" />
                                    ) : (
                                      <span className="text-[10px] uppercase font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">Inválido</span>
                                    )}
                                 </div>
                               )}
                             </div>
                             
                             {/* WhatsApp JID Helper Text */}
                             {field.key === 'whatsapp' && waParsed && (
                                <span className="text-[10px] text-gray-400 font-mono pl-1 flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3 text-gray-300" />
                                  Número de contacto: +{waParsed.e164}
                                </span>
                             )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </div>
            </div>
            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">El cliente se creará en <span className="font-semibold text-slate-800">{activeCountry}</span>.</p>
                <div className="flex items-center justify-end gap-2">
                  <button onClick={handleClose} disabled={saving} className="btn-secondary">Cancelar</button>
                  <button onClick={handleSubmit} disabled={saving} className="btn-primary min-w-[150px]">
                    {saving ? <RepairLoader variant="icon" /> : <Save className="h-4 w-4" />}
                    {saving ? 'Creando...' : 'Crear cliente'}
                  </button>
                </div>
              </div>
            </div>
      </ModalPortal>
    </>
  );
};

export default NuevoCliente;
