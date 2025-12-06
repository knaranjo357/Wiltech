import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Phone, Calendar, MapPin, User, Smartphone, FileText, Settings, DollarSign, UserCheck,
  Copy, MessageCircle, ShieldCheck, ClipboardList, Building2, ClipboardCheck,
  Truck, Edit2, Save, Bot, CheckCircle, AlertCircle, Fingerprint, Clock, Mail, Percent,
  ShoppingBag, MessageSquare
} from 'lucide-react';
import { Client } from '../types/client';
import {
  formatDate,
  formatWhatsApp,
  getEtapaColor,
  getCategoriaColor,
  deriveEnvioUI,
} from '../utils/clientHelpers';
import { ChatPanel } from './ChatPanel';

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

// ========= Utils & Helpers =========

/** Formatea fechas ISO o Timestamps para el input type="datetime-local" */
const toInputDate = (val: any): string => {
  if (!val) return '';
  try {
    const date = new Date(val);
    if (isNaN(date.getTime())) return '';
    // Ajuste simple para que el input datetime-local lo lea (YYYY-MM-DDTHH:mm)
    // Nota: Esto toma la hora local del navegador.
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
    return localISOTime;
  } catch {
    return '';
  }
};

const parseAgendaDate = (raw?: string | null): Date | null => {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  const t1 = Date.parse(s);
  if (!Number.isNaN(t1)) return new Date(t1);
  return null;
};

const safeStr = (v?: unknown) => {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  const l = s.toLowerCase();
  return l === 'null' || l === 'undefined' ? '' : s;
};

export const ClientModal: React.FC<ClientModalProps> = ({ isOpen, onClose, client, onUpdate }) => {
  const shouldRender = Boolean(isOpen && client);
  const c = (client ?? {}) as Client;
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // State
  const [activeTab, setActiveTab] = useState<'ficha' | 'chat'>('ficha');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Client>>({});
  const [saving, setSaving] = useState(false);

  // Init logic
  useEffect(() => {
    if (!shouldRender) return;
    setActiveTab('ficha');
    setIsEditing(false);
    setEditData(c);
  }, [shouldRender, c]); 

  // Close / Esc logic
  useEffect(() => {
    if (!shouldRender) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing) {
          setIsEditing(false);
          setEditData(c || {});
        } else if (activeTab === 'chat') {
          setActiveTab('ficha');
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [shouldRender, isEditing, activeTab, onClose, c]);

  const onOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      if (isEditing) {
         setIsEditing(false);
         setEditData(c || {});
      } else {
         onClose();
      }
    }
  };

  const getVal = <K extends keyof Client>(key: K): any => (editData[key] ?? c[key]) as any;
  const setVal = <K extends keyof Client>(key: K, value: any) => setEditData(prev => ({ ...prev, [key]: value }));

  const handleCopy = async (text: string) => { try { await navigator.clipboard.writeText(text); } catch {} };
  
  const notifyGlobalUpdate = (payload: Partial<Client>) => {
    try { window.dispatchEvent(new CustomEvent<Partial<Client>>('client:updated', { detail: payload })); } catch {}
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const fullPayload: Partial<Client> = { ...editData, row_number: c.row_number };
      const ok = await onUpdate(fullPayload);
      if (ok) {
        notifyGlobalUpdate({ ...c, ...fullPayload });
        setIsEditing(false);
      }
    } finally { setSaving(false); }
  };

  const isBotOn = (v: any) => v === true || v === '' || v === null;
  const handleBotToggle = async () => {
    const currentRaw = (editData.consentimiento_contacto ?? c.consentimiento_contacto) as any;
    const currentlyOn = isBotOn(currentRaw);
    const newValue = !currentlyOn;

    if (currentlyOn) {
      const ok = window.confirm('¿Desea apagar el bot para este contacto?');
      if (!ok) return;
    }

    const prevEdit = editData;
    const optimistic = { ...editData, consentimiento_contacto: newValue };
    setEditData(optimistic);
    setSaving(true);

    try {
      const fullPayload: Partial<Client> = { ...c, ...optimistic, row_number: c.row_number };
      const ok = await onUpdate(fullPayload);
      if (ok) notifyGlobalUpdate(fullPayload);
      else setEditData(prevEdit);
    } catch {
      setEditData(prevEdit);
    } finally { setSaving(false); }
  };

  const agendaDate = parseAgendaDate(c?.fecha_agenda ?? null);
  const canShowAsistio = !!agendaDate;
  const asistio = Boolean(editData.asistio_agenda ?? c?.asistio_agenda);
  
  const toggleAsistio = async () => {
    const next = !asistio;
    const prev = editData.asistio_agenda;
    setEditData(p => ({ ...p, asistio_agenda: next }));
    try {
      const ok = await onUpdate({ row_number: c.row_number, asistio_agenda: next as any });
      if (!ok) setEditData(p => ({ ...p, asistio_agenda: prev }));
      else notifyGlobalUpdate({ row_number: c.row_number, asistio_agenda: next as any });
    } catch {
      setEditData(p => ({ ...p, asistio_agenda: prev }));
    }
  };

  // Memos
  const phoneE164 = (c?.whatsapp || '').replace('@s.whatsapp.net', '');
  const waLink = useMemo(() => `https://wa.me/${phoneE164}`, [phoneE164]);
  const mapsLink = useMemo(() => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(safeStr(c?.ciudad) || 'Colombia')}`, [c?.ciudad]);
  const initials = useMemo(() => {
    const name = safeStr(c?.nombre);
    if (!name) return 'Cn';
    const parts = name.split(' ').filter(Boolean);
    return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
  }, [c?.nombre]);

  // =========================================================
  // CONFIGURACIÓN DE CAMPOS (Aquí agregamos los faltantes)
  // =========================================================
  const sections: Array<{ title: string; icon: React.ComponentType<any>; fields: Array<FieldDef>; iconColor: string }> = [
    { title: 'Información Personal', icon: User, iconColor: 'text-blue-600 bg-blue-50', fields: [
      { label: 'Nombre', key: 'nombre', icon: User, type: 'text' },
      { label: 'WhatsApp', key: 'whatsapp', icon: Phone, type: 'text' },
      { label: 'Ciudad', key: 'ciudad', icon: MapPin, type: 'text' },
      { label: 'Subscriber ID', key: 'subscriber_id', icon: Fingerprint, type: 'text' }, // Nuevo
    ]},
    { title: 'Estado y Tiempos', icon: Clock, iconColor: 'text-purple-600 bg-purple-50', fields: [
      { label: 'Source (origen)', key: 'source', icon: Settings, type: 'text' },
      { label: 'Etapa', key: 'estado_etapa', icon: Settings, type: 'text' },
      { label: 'Categoría', key: 'categoria_contacto', icon: UserCheck, type: 'text' },
      { label: 'Asignado a', key: 'asignado_a', icon: User, type: 'text' },
      { label: 'Creado', key: 'created', icon: Clock, type: 'datetime' }, // Nuevo
      { label: 'Último Mensaje', key: 'last_msg', icon: MessageCircle, type: 'datetime' }, // Nuevo
    ]},
    { title: 'Agenda', icon: Calendar, iconColor: 'text-teal-600 bg-teal-50', fields: [
       { label: 'Fecha agenda', key: 'fecha_agenda', icon: Calendar, type: 'datetime' },
       { label: 'Sede Agendada', key: 'agenda_ciudad_sede', icon: Building2, type: 'text' },
       { label: 'Asistió', key: 'asistio_agenda', icon: CheckCircle, type: 'boolean' }, // Nuevo (editable)
    ]},
    { title: 'Dispositivo', icon: Smartphone, iconColor: 'text-indigo-600 bg-indigo-50', fields: [
      { label: 'Modelo', key: 'modelo', icon: Smartphone, type: 'text' },
      { label: 'Intención', key: 'intencion', icon: Settings, type: 'text' },
      { label: 'Detalles', key: 'detalles', icon: FileText, type: 'textarea' },
      { label: 'Recepción', key: 'modo_recepcion', icon: MapPin, type: 'text' },
    ]},
    { title: 'Diagnóstico y Comercial', icon: DollarSign, iconColor: 'text-green-600 bg-green-50', fields: [
      { label: 'Diagnóstico req.', key: 'diagnostico_requerido', icon: ClipboardCheck, type: 'text' },
      { label: 'Equipo manipulado', key: 'equipo_manipulado', icon: ClipboardList, type: 'text' },
      { label: 'Precio diag.', key: 'precio_diagnostico_informado', icon: DollarSign, type: 'text' },
      { label: 'Precio rep. est.', key: 'precio_reparacion_estimado', icon: DollarSign, type: 'text' },
      { label: 'Precio máximo', key: 'precio_maximo_informado', icon: DollarSign, type: 'text' },
      { label: 'Búsqueda precios', key: 'buscar_precios_status', icon: DollarSign, type: 'text' },
      { label: 'Servicios extra', key: 'servicios_adicionales', icon: Settings, type: 'text' },
      { label: 'Interés accesorios', key: 'interes_accesorios', icon: ShoppingBag, type: 'text' }, // Nuevo
      { label: 'Desc. Multi-rep', key: 'descuento_multi_reparacion', icon: Percent, type: 'text' }, // Nuevo
    ]},
    { title: 'Notas', icon: FileText, iconColor: 'text-amber-600 bg-amber-50', fields: [
      { label: 'Último Input', key: 'last_input_text', icon: MessageSquare, type: 'textarea' }, // Nuevo
      { label: 'Notas cliente', key: 'notas_cliente', icon: FileText, type: 'textarea' },
      { label: 'Notas internas', key: 'notas', icon: FileText, type: 'textarea' },
      { label: 'Obs. técnicas', key: 'observaciones_tecnicas', icon: FileText, type: 'textarea' },
    ]},
    { title: 'Logística y Envío', icon: Truck, iconColor: 'text-orange-600 bg-orange-50', fields: [
      { label: 'Nombre Guía', key: 'guia_nombre_completo', icon: User, type: 'text' },
      { label: 'Cédula / ID', key: 'guia_cedula_id', icon: ClipboardList, type: 'text' },
      { label: 'Teléfono Guía', key: 'guia_telefono', icon: Phone, type: 'text' }, // Nuevo (estaba faltando)
      { label: 'Dirección', key: 'guia_direccion', icon: MapPin, type: 'text' },
      { label: 'Ciudad Guía', key: 'guia_ciudad', icon: MapPin, type: 'text' },
      { label: 'Dpto/Estado', key: 'guia_departamento_estado', icon: MapPin, type: 'text' }, // Nuevo
      { label: 'Email Guía', key: 'guia_email', icon: Mail, type: 'email' }, // Nuevo
      { label: 'Guía Ida', key: 'guia_numero_ida', icon: Truck, type: 'text' },
      { label: 'Guía Retorno', key: 'guia_numero_retorno', icon: Truck, type: 'text' },
      { label: 'Asegurado', key: 'asegurado', icon: ShieldCheck, type: 'boolean' },
      { label: 'Valor Seguro', key: 'valor_seguro', icon: DollarSign, type: 'text' }, // Nuevo
      { label: 'Estado envío', key: 'estado_envio', icon: Truck, type: 'text' },
    ]},
  ];

  if (!shouldRender) return null;

  return (
    <div
      ref={overlayRef}
      onMouseDown={onOverlayClick}
      className="fixed inset-0 z-[120] bg-gray-900/60 backdrop-blur-sm flex justify-end sm:justify-center sm:items-center transition-opacity duration-300"
      role="dialog"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-white w-full h-full sm:h-[90vh] sm:w-[95vw] sm:max-w-6xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300"
      >
        
        {/* === HEADER === */}
        <div className="relative shrink-0 bg-white border-b border-gray-100 z-20">
          
          {/* Top Bar */}
          <div className="px-4 sm:px-8 py-5 flex flex-col md:flex-row gap-4 md:items-center justify-between bg-gradient-to-r from-white via-white to-gray-50/50">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-blue-200">
                {initials}
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                  {safeStr(c?.nombre) || 'Cliente Nuevo'}
                </h2>
                <div className="flex items-center gap-2 text-gray-500 text-sm mt-0.5">
                  <Smartphone className="w-4 h-4" />
                  <span>{safeStr(c?.modelo) || 'Sin modelo'}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
               <div className="bg-gray-100 p-1 rounded-xl flex items-center font-medium text-sm">
                  <button
                    onClick={() => setActiveTab('ficha')}
                    className={`px-4 py-1.5 rounded-lg transition-all shadow-sm ${activeTab === 'ficha' ? 'bg-white text-gray-900' : 'bg-transparent text-gray-500 hover:text-gray-700 shadow-none'}`}
                  >
                    Ficha
                  </button>
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`px-4 py-1.5 rounded-lg transition-all shadow-sm ${activeTab === 'chat' ? 'bg-white text-gray-900' : 'bg-transparent text-gray-500 hover:text-gray-700 shadow-none'}`}
                  >
                    Chat
                  </button>
               </div>

               <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block" />

               {isEditing ? (
                 <>
                   <button
                     onClick={handleSave}
                     disabled={saving}
                     className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-black transition shadow-md disabled:opacity-70"
                   >
                     {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Save className="w-4 h-4" />}
                     <span className="text-sm font-medium">Guardar</span>
                   </button>
                   <button
                     onClick={() => { setIsEditing(false); setEditData(c); }}
                     disabled={saving}
                     className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                   >
                     <X className="w-4 h-4" />
                   </button>
                 </>
               ) : (
                 <button
                   onClick={() => { setActiveTab('ficha'); setIsEditing(true); setEditData(c); }}
                   className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition shadow-sm"
                 >
                   <Edit2 className="w-4 h-4" />
                   <span className="text-sm font-medium">Editar</span>
                 </button>
               )}

               <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition">
                 <X className="w-6 h-6" />
               </button>
            </div>
          </div>

          {/* Quick Info Bar */}
          <div className="px-4 sm:px-8 pb-4 flex flex-col xl:flex-row gap-4 xl:items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
               {c?.estado_etapa && (
                 <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getEtapaColor(c.estado_etapa as any)}`}>
                   {String(c.estado_etapa).replace(/_/g, ' ')}
                 </span>
               )}
               {c?.categoria_contacto && (
                 <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getCategoriaColor(c.categoria_contacto as any)}`}>
                   {String(c.categoria_contacto).replace(/_/g, ' ')}
                 </span>
               )}
               
               <button 
                 onClick={handleBotToggle}
                 disabled={saving}
                 className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition active:scale-95
                   ${isBotOn(editData.consentimiento_contacto ?? c.consentimiento_contacto) 
                     ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                     : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}
               >
                 {isBotOn(editData.consentimiento_contacto ?? c.consentimiento_contacto) ? <Bot className="w-3 h-3"/> : <AlertCircle className="w-3 h-3"/>}
                 {isBotOn(editData.consentimiento_contacto ?? c.consentimiento_contacto) ? 'Bot Activo' : 'Bot Inactivo'}
               </button>

               {canShowAsistio && (
                 <button
                   onClick={toggleAsistio}
                   className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition active:scale-95
                     ${asistio ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}
                 >
                   {asistio ? <CheckCircle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                   {asistio ? 'Asistió a Cita' : 'Pendiente Asistencia'}
                 </button>
               )}
            </div>

            <div className="flex items-center gap-2 text-sm overflow-x-auto pb-1 xl:pb-0">
               <a href={waLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition border border-green-100 whitespace-nowrap">
                 <MessageCircle className="w-4 h-4" /> {formatWhatsApp(c.whatsapp)}
               </a>
               <button onClick={() => handleCopy(phoneE164)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition border border-transparent hover:border-gray-200" title="Copiar número">
                 <Copy className="w-4 h-4" />
               </button>
               {safeStr(c?.ciudad) && (
                 <a href={mapsLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition border border-blue-100 whitespace-nowrap">
                   <MapPin className="w-4 h-4" /> {safeStr(c?.ciudad)}
                 </a>
               )}
            </div>
          </div>
        </div>

        {/* === BODY === */}
        <div className="flex-1 overflow-hidden flex flex-col bg-gray-50/50 relative">
          {activeTab === 'ficha' ? (
            <div className="flex-1 overflow-y-auto p-4 sm:p-8">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-7xl mx-auto">
                {sections.map((section, idx) => (
                  <div key={idx} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${section.iconColor}`}>
                        <section.icon className="w-5 h-5" />
                      </div>
                      <h3 className="font-semibold text-gray-900 text-lg">{section.title}</h3>
                    </div>

                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                      {section.fields.map((field, j) => {
                        const value = getVal(field.key);
                        const isEmpty = !safeStr(value);
                        const isFullWidth = field.type === 'textarea';
                        
                        return (
                          <div key={j} className={`flex flex-col gap-1.5 ${isFullWidth ? 'sm:col-span-2' : ''}`}>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide pl-1 flex items-center gap-1.5">
                               {field.label}
                            </label>

                            {isEditing ? (
                                /* === Edit Mode === */
                                field.key === 'estado_envio' ? (
                                  <select
                                    value={String(value ?? '').toLowerCase() === 'envio_gestionado' ? 'envio_gestionado' : String(value ?? '').toLowerCase() === 'no_aplica' ? 'no_aplica' : ''}
                                    onChange={(e) => setVal('estado_envio', e.target.value as any)}
                                    className="w-full text-sm bg-gray-50 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all px-3 py-2"
                                  >
                                    <option value="">(Seleccionar)</option>
                                    <option value="envio_gestionado">Envío gestionado</option>
                                    <option value="no_aplica">No aplica</option>
                                  </select>
                                ) : field.type === 'textarea' ? (
                                  <textarea
                                    value={value ?? ''}
                                    onChange={(e) => setVal(field.key, e.target.value)}
                                    rows={3}
                                    className="w-full text-sm bg-gray-50 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all px-3 py-2"
                                  />
                                ) : field.type === 'boolean' ? (
                                  <select
                                    value={value === true ? 'true' : 'false'}
                                    onChange={(e) => setVal(field.key, e.target.value === 'true')}
                                    className="w-full text-sm bg-gray-50 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all px-3 py-2"
                                  >
                                    <option value="true">Sí</option>
                                    <option value="false">No</option>
                                  </select>
                                ) : field.type === 'datetime' ? (
                                  <input
                                    type="datetime-local"
                                    value={toInputDate(value)} // Usamos helper para formato correcto
                                    onChange={(e) => setVal(field.key, e.target.value)}
                                    className="w-full text-sm bg-gray-50 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all px-3 py-2"
                                  />
                                ) : (
                                  <input
                                    type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                                    value={value ?? ''}
                                    onChange={(e) => setVal(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                                    className="w-full text-sm bg-gray-50 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all px-3 py-2"
                                  />
                                )
                            ) : (
                                /* === View Mode === */
                                <div className="min-h-[24px] flex items-center">
                                  {field.key === 'estado_envio' && value ? (
                                     <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${deriveEnvioUI({ ...c, ...editData }).classes}`}>
                                        <Truck className="w-3 h-3"/> {deriveEnvioUI({ ...c, ...editData }).label}
                                     </span>
                                  ) : isEmpty ? (
                                     <span className="text-gray-300 text-sm italic select-none">-</span>
                                  ) : field.key === 'whatsapp' ? (
                                     <span className="text-sm font-medium text-gray-900 font-mono bg-gray-50 px-2 py-0.5 rounded">{formatWhatsApp(String(value))}</span>
                                  ) : (field.type === 'datetime' || field.key === 'fecha_agenda') ? (
                                     <span className="text-sm font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded flex items-center gap-2">
                                        <Calendar className="w-3.5 h-3.5"/> {formatDate(String(value))}
                                     </span>
                                  ) : field.type === 'boolean' ? (
                                      <span className={`text-sm font-bold ${value ? 'text-green-600' : 'text-gray-500'}`}>{value ? 'Sí' : 'No'}</span>
                                  ) : (
                                     <span className="text-sm font-medium text-gray-900 break-words leading-relaxed">
                                        {String(value)}
                                     </span>
                                  )}
                                </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="h-12"></div>
            </div>
          ) : (
            <ChatPanel
              client={c}
              source={(editData.source ?? c.source) as any}
            />
          )}
        </div>
      </div>
    </div>
  );
};