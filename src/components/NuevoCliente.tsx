// src/components/NuevoCliente.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, X, Save, Phone, MapPin, User, Smartphone, FileText, Settings, 
  DollarSign, UserCheck, Calendar, ShieldCheck, ClipboardList, ClipboardCheck, 
  Truck, Mail, Bot, MessageCircle, Percent, ChevronRight, Fingerprint,
  LayoutDashboard, ShoppingBag
} from 'lucide-react';
import { Client } from '../types/client';
import { ClientService } from '../services/clientService';

/** ===================== Helpers ===================== **/

/**
 * Normaliza un número para guardar en BD: 573001234567@s.whatsapp.net
 */
function toWaJid(raw: string): { jid: string; e164: string } | null {
  if (!raw) return null;
  const digits = raw.replace(/\D+/g, '');

  let e164 = '';
  
  if (digits.startsWith('57') && digits.length === 12) {
    e164 = digits;
  } else if (digits.length === 10 && digits.startsWith('3')) {
    e164 = '57' + digits;
  } else if (digits.length === 11 && digits.startsWith('03')) {
    e164 = '57' + digits.slice(1);
  } else if (digits.length > 10) {
    e164 = digits;
  } else {
    return null;
  }

  return { jid: `${e164}@s.whatsapp.net`, e164 };
}

/** Tipos de campo idénticos a ClientModal */
type FieldType = 'text' | 'textarea' | 'datetime' | 'email' | 'number' | 'boolean';

type FieldDef<K extends keyof Client = keyof Client> = {
  label: string;
  key: K;
  icon: React.ComponentType<any>;
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
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Estado inicial del formulario (Bot activo por defecto: true)
  const initialForm: Partial<Client> = {
    nombre: '',
    whatsapp: '',
    ciudad: '',
    modelo: '',
    intencion: '',
    detalles: '',
    modo_recepcion: '',
    estado_etapa: 'nuevo', 
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
    asegurado: false as any,
    valor_seguro: '' as any,
    consentimiento_contacto: true as any, 
  };

  const [form, setForm] = useState<Partial<Client>>(initialForm);

  // Preview del WhatsApp
  const waParsed = useMemo(() => toWaJid(String(form.whatsapp || '')), [form.whatsapp]);

  // Manejadores de cierre
  const handleClose = () => {
    if ((form.nombre || form.whatsapp) && !window.confirm("¿Deseas cerrar? Se perderán los datos ingresados.")) {
       return;
    }
    setOpen(false);
    setForm(initialForm);
    setError(null);
  };

  const onOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) handleClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, form]);

  const setVal = <K extends keyof Client>(key: K, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // ================= SECCIONES (Estilo Idéntico a ClientModal) =================
  const sections: Array<{ title: string; icon: React.ComponentType<any>; fields: Array<FieldDef>; iconColor: string }> = [
    {
      title: 'Información Personal',
      icon: User,
      iconColor: 'text-blue-600 bg-blue-50',
      fields: [
        { label: 'Nombre', key: 'nombre', icon: User, type: 'text', required: true },
        { label: 'WhatsApp', key: 'whatsapp', icon: Phone, type: 'text', required: true, placeholder: 'Ej: 315 123 4567' },
        { label: 'Ciudad', key: 'ciudad', icon: MapPin, type: 'text' },
        { label: 'Subscriber ID', key: 'subscriber_id', icon: Fingerprint, type: 'text' },
      ],
    },
    {
      title: 'Dispositivo y Detalle',
      icon: Smartphone,
      iconColor: 'text-indigo-600 bg-indigo-50',
      fields: [
        { label: 'Modelo', key: 'modelo', icon: Smartphone, type: 'text' },
        { label: 'Intención', key: 'intencion', icon: Settings, type: 'text' },
        { label: 'Detalles', key: 'detalles', icon: FileText, type: 'textarea' },
        { label: 'Recepción', key: 'modo_recepcion', icon: MapPin, type: 'text' },
      ],
    },
    {
      title: 'Comercial y Agenda',
      icon: Calendar,
      iconColor: 'text-teal-600 bg-teal-50',
      fields: [
        { label: 'Etapa', key: 'estado_etapa', icon: Settings, type: 'text' },
        { label: 'Categoría', key: 'categoria_contacto', icon: UserCheck, type: 'text' },
        { label: 'Fecha agenda', key: 'fecha_agenda', icon: Calendar, type: 'datetime' },
        { label: 'Sede Agendada', key: 'agenda_ciudad_sede', icon: MapPin, type: 'text' },
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
    setError(null);

    // Validaciones
    if (!form.nombre?.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }

    const parsed = toWaJid(String(form.whatsapp || ''));
    if (!parsed) {
      setError('Número de WhatsApp inválido. Formato requerido: 10 dígitos (Ej: 3001234567)');
      return;
    }

    // Payload
    const payload: Partial<Client> = {
      ...form,
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
      } catch {}

      if (onCreated) onCreated(payload);
      
      setForm(initialForm);
      setOpen(false);

    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Error al crear el cliente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Botón Flotante */}
      {floating && (
        <div className="fixed bottom-6 right-6 z-[110] animate-in slide-in-from-bottom-4 duration-500">
          <button
            onClick={() => setOpen(true)}
            className="group flex items-center gap-2 bg-blue-600 text-white px-5 py-3.5 rounded-full shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:shadow-blue-600/50 transition-all active:scale-95 border border-blue-500"
            title="Crear Nuevo Cliente"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            <span className="font-bold text-sm tracking-wide">Nuevo Cliente</span>
          </button>
        </div>
      )}

      {/* Modal Overlay */}
      {open && (
        <div
          ref={overlayRef}
          onMouseDown={onOverlayClick}
          className="fixed inset-0 z-[130] bg-gray-900/70 backdrop-blur-sm flex justify-center items-center transition-all duration-300"
          role="dialog"
        >
          {/* Main Container - Estilo idéntico a ClientModal */}
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="bg-white w-full h-full sm:h-[90vh] sm:w-[95vw] sm:max-w-6xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300 border border-gray-200"
          >
            
            {/* Header */}
            <div className="relative shrink-0 bg-white z-20 shadow-sm px-4 sm:px-6 py-4 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-200 border-2 border-white ring-1 ring-gray-100">
                   <Plus className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">Crear Nuevo Cliente</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-green-50 text-green-700 border border-green-100 flex items-center gap-1">
                       <Bot className="w-3 h-3" /> Bot: Activo
                    </span>
                    <span className="text-xs text-gray-400">Complete la información requerida</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleClose}
                  className="px-4 py-2.5 rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition font-medium text-sm border border-transparent hover:border-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition shadow-md shadow-blue-200 disabled:opacity-70 active:scale-95 font-medium"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Guardar Cliente</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="px-6 py-3 bg-red-50 border-b border-red-100 flex items-center gap-3 text-red-700 text-sm animate-in slide-in-from-top-2">
                <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                   <X className="w-4 h-4 text-red-600" />
                </div>
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-8">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-7xl mx-auto pb-10">
                {sections.map((section, idx) => (
                  <div key={idx} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden h-fit flex flex-col">
                    
                    {/* Section Header */}
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${section.iconColor}`}>
                                <section.icon className="w-5 h-5" />
                            </div>
                            <h3 className="font-bold text-gray-800 text-base tracking-tight">{section.title}</h3>
                        </div>
                    </div>

                    {/* Fields */}
                    <div className="p-5 bg-white grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                      {section.fields.map((field, j) => {
                        const isFullWidth = field.type === 'textarea';
                        const val = (form as any)[field.key];

                        return (
                          <div key={j} className={`flex flex-col gap-1.5 ${isFullWidth ? 'sm:col-span-2' : ''}`}>
                             <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-0.5 mb-1 flex items-center justify-between">
                                {field.label} {field.required && <span className="text-red-500">*</span>}
                             </label>
                             
                             <div className="relative group">
                               {field.type === 'textarea' ? (
                                 <textarea
                                   value={val ?? ''}
                                   onChange={(e) => setVal(field.key, e.target.value)}
                                   rows={3}
                                   className="w-full text-sm bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all px-3 py-2.5 resize-none placeholder:text-gray-300"
                                   placeholder="Escribe aquí..."
                                 />
                               ) : field.type === 'boolean' ? (
                                 <div className="relative">
                                    <select
                                      value={val === true ? 'true' : 'false'}
                                      onChange={(e) => setVal(field.key, e.target.value === 'true')}
                                      className="w-full text-sm bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all px-3 py-2.5 appearance-none"
                                    >
                                      <option value="true">Sí</option>
                                      <option value="false">No</option>
                                    </select>
                                    <ChevronRight className="absolute right-3 top-3 w-4 h-4 text-gray-400 rotate-90 pointer-events-none"/>
                                 </div>
                               ) : field.type === 'datetime' ? (
                                 <input
                                   type="datetime-local"
                                   value={val ?? ''}
                                   onChange={(e) => setVal(field.key, e.target.value)}
                                   className="w-full text-sm bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all px-3 py-2.5"
                                 />
                               ) : (
                                 <input
                                   type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                                   value={val ?? ''}
                                   onChange={(e) => setVal(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                                   placeholder={field.placeholder || '-'}
                                   className="w-full text-sm bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all px-3 py-2.5 placeholder:text-gray-300"
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
                                  Se guardará como: {waParsed.jid}
                                </span>
                             )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
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