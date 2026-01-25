// src/components/ClientModal.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Phone, Calendar, MapPin, User, Smartphone, FileText, Settings, DollarSign, UserCheck,
  Copy, MessageCircle, ShieldCheck, ClipboardList, Building2, ClipboardCheck,
  Truck, Edit2, Save, Bot, CheckCircle, AlertCircle, Fingerprint, Clock, Mail, Percent,
  ShoppingBag, MessageSquare, LayoutDashboard, ExternalLink, ChevronRight
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

const toInputDate = (val: any): string => {
  if (!val) return '';
  try {
    const date = new Date(val);
    if (isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
    return localISOTime;
  } catch {
    return '';
  }
};

// NUEVO HELPER: Maneja IDs grandes de FB/IG evitando notación científica
const safeBigIntStr = (val: any): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') {
    // Convierte números grandes a string sin usar notación científica (e.g. 1.2e+15)
    return val.toLocaleString('fullwide', { useGrouping: false });
  }
  return String(val);
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

// ========= Definición de Tabs =========
type TabID = 'general' | 'comercial' | 'logistica' | 'notas' | 'chat';

const TABS: { id: TabID; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'general', label: 'General', icon: LayoutDashboard },
  { id: 'comercial', label: 'Comercial', icon: DollarSign },
  { id: 'logistica', label: 'Logística', icon: Truck },
  { id: 'notas', label: 'Notas', icon: FileText },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
];

export const ClientModal: React.FC<ClientModalProps> = ({ isOpen, onClose, client, onUpdate }) => {
  const shouldRender = Boolean(isOpen && client);
  const c = (client ?? {}) as Client;
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // State
  const [activeTab, setActiveTab] = useState<TabID>('general');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Client>>({});
  const [saving, setSaving] = useState(false);

  // Init logic
  useEffect(() => {
    if (!shouldRender) return;
    setActiveTab('general');
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
  }, [shouldRender, isEditing, onClose, c]);

  const onOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      if (isEditing) {
         if(window.confirm("Tienes cambios sin guardar. ¿Deseas cerrar y perder los cambios?")) {
            setIsEditing(false);
            onClose();
         }
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

  // === LÓGICA DEL BOT CORREGIDA ===
  const isBotOn = (v: any) => {
    if (v === false) return false;
    if (typeof v === 'string' && v.toLowerCase() === 'false') return false;
    return true;
  };

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
  // CONFIGURACIÓN DE SECCIONES 
  // =========================================================
  const allSections: Array<{ tab: TabID; title: string; icon: React.ComponentType<any>; fields: Array<FieldDef>; iconColor: string }> = [
    // --- TAB GENERAL ---
    { tab: 'general', title: 'Información Personal', icon: User, iconColor: 'text-blue-600 bg-blue-50', fields: [
      { label: 'Nombre', key: 'nombre', icon: User, type: 'text' },
      { label: 'WhatsApp', key: 'whatsapp', icon: Phone, type: 'text' },
      { label: 'Ciudad', key: 'ciudad', icon: MapPin, type: 'text' },
      { label: 'Subscriber ID', key: 'subscriber_id', icon: Fingerprint, type: 'text' },
    ]},
    { tab: 'general', title: 'Estado y Tiempos', icon: Clock, iconColor: 'text-purple-600 bg-purple-50', fields: [
      { label: 'Source (origen)', key: 'source', icon: Settings, type: 'text' },
      { label: 'Etapa', key: 'estado_etapa', icon: Settings, type: 'text' },
      { label: 'Categoría', key: 'categoria_contacto', icon: UserCheck, type: 'text' },
      { label: 'Asignado a', key: 'asignado_a', icon: User, type: 'text' },
      { label: 'Creado', key: 'created', icon: Clock, type: 'datetime' },
      { label: 'Último Mensaje', key: 'last_msg', icon: MessageCircle, type: 'datetime' },
    ]},
    { tab: 'general', title: 'Dispositivo', icon: Smartphone, iconColor: 'text-indigo-600 bg-indigo-50', fields: [
      { label: 'Modelo', key: 'modelo', icon: Smartphone, type: 'text' },
      { label: 'Intención', key: 'intencion', icon: Settings, type: 'text' },
      { label: 'Detalles', key: 'detalles', icon: FileText, type: 'textarea' },
      { label: 'Recepción', key: 'modo_recepcion', icon: MapPin, type: 'text' },
    ]},
    // --- TAB COMERCIAL ---
    { tab: 'comercial', title: 'Agenda', icon: Calendar, iconColor: 'text-teal-600 bg-teal-50', fields: [
       { label: 'Fecha agenda', key: 'fecha_agenda', icon: Calendar, type: 'datetime' },
       { label: 'Sede Agendada', key: 'agenda_ciudad_sede', icon: Building2, type: 'text' },
       { label: 'Asistió', key: 'asistio_agenda', icon: CheckCircle, type: 'boolean' },
    ]},
    { tab: 'comercial', title: 'Diagnóstico y Comercial', icon: DollarSign, iconColor: 'text-green-600 bg-green-50', fields: [
      { label: 'Diagnóstico req.', key: 'diagnostico_requerido', icon: ClipboardCheck, type: 'text' },
      { label: 'Equipo manipulado', key: 'equipo_manipulado', icon: ClipboardList, type: 'text' },
      { label: 'Precio diag.', key: 'precio_diagnostico_informado', icon: DollarSign, type: 'text' },
      { label: 'Precio rep. est.', key: 'precio_reparacion_estimado', icon: DollarSign, type: 'text' },
      { label: 'Precio máximo', key: 'precio_maximo_informado', icon: DollarSign, type: 'text' },
      { label: 'Búsqueda precios', key: 'buscar_precios_status', icon: DollarSign, type: 'text' },
      { label: 'Servicios extra', key: 'servicios_adicionales', icon: Settings, type: 'text' },
      { label: 'Interés accesorios', key: 'interes_accesorios', icon: ShoppingBag, type: 'text' },
      { label: 'Desc. Multi-rep', key: 'descuento_multi_reparacion', icon: Percent, type: 'text' },
    ]},
    // --- TAB NOTAS ---
    { tab: 'notas', title: 'Notas', icon: FileText, iconColor: 'text-amber-600 bg-amber-50', fields: [
      { label: 'Último Input', key: 'last_input_text', icon: MessageSquare, type: 'textarea' },
      { label: 'Notas cliente', key: 'notas_cliente', icon: FileText, type: 'textarea' },
      { label: 'Notas internas', key: 'notas', icon: FileText, type: 'textarea' },
      { label: 'Obs. técnicas', key: 'observaciones_tecnicas', icon: FileText, type: 'textarea' },
    ]},
    // --- TAB LOGISTICA ---
    { tab: 'logistica', title: 'Logística y Envío', icon: Truck, iconColor: 'text-orange-600 bg-orange-50', fields: [
      { label: 'Nombre Guía', key: 'guia_nombre_completo', icon: User, type: 'text' },
      { label: 'Cédula / ID', key: 'guia_cedula_id', icon: ClipboardList, type: 'text' },
      { label: 'Teléfono Guía', key: 'guia_telefono', icon: Phone, type: 'text' },
      { label: 'Dirección', key: 'guia_direccion', icon: MapPin, type: 'text' },
      { label: 'Ciudad Guía', key: 'guia_ciudad', icon: MapPin, type: 'text' },
      { label: 'Dpto/Estado', key: 'guia_departamento_estado', icon: MapPin, type: 'text' },
      { label: 'Email Guía', key: 'guia_email', icon: Mail, type: 'email' },
      { label: 'Guía Ida', key: 'guia_numero_ida', icon: Truck, type: 'text' },
      { label: 'Guía Retorno', key: 'guia_numero_retorno', icon: Truck, type: 'text' },
      { label: 'Asegurado', key: 'asegurado', icon: ShieldCheck, type: 'boolean' },
      { label: 'Valor Seguro', key: 'valor_seguro', icon: DollarSign, type: 'text' },
      { label: 'Estado envío', key: 'estado_envio', icon: Truck, type: 'text' },
    ]},
  ];

  const getTabCounts = (tabId: TabID) => {
    if (tabId === 'chat') return null;
    const relevantSections = allSections.filter(s => s.tab === tabId);
    let total = 0;
    let filled = 0;

    relevantSections.forEach(section => {
      section.fields.forEach(field => {
        total++;
        const val = getVal(field.key);
        if (val !== null && val !== undefined && val !== '') {
          filled++;
        }
      });
    });

    return { filled, total };
  };

  const sectionsToRender = allSections.filter(s => s.tab === activeTab);

  if (!shouldRender) return null;

  return (
    <div
      ref={overlayRef}
      onMouseDown={onOverlayClick}
      className="fixed inset-0 z-[120] bg-gray-900/70 backdrop-blur-sm flex justify-end sm:justify-center sm:items-center transition-all duration-300"
      role="dialog"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-white w-full h-full sm:h-[90vh] sm:w-[95vw] sm:max-w-6xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300 border border-gray-200"
      >
        
        {/* === HEADER PRINCIPAL === */}
        <div className="relative shrink-0 bg-white z-20 shadow-sm">
          
          {/* Top Bar: Info Cliente & Acciones Globales */}
          <div className="px-4 sm:px-6 py-4 flex flex-col md:flex-row gap-4 md:items-center justify-between bg-white border-b border-gray-100">
            {/* Cliente Info */}
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-blue-200 shrink-0 border-2 border-white ring-1 ring-gray-100">
                  {initials}
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
              </div>
              <div className="min-w-0">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight truncate">
                  {safeStr(c?.nombre) || 'Sin Nombre'}
                </h2>
                <div className="flex items-center gap-3 text-gray-500 text-sm mt-1">
                  <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                     <Smartphone className="w-3.5 h-3.5 text-gray-400" />
                     <span className="truncate font-medium">{safeStr(c?.modelo) || 'Modelo desconocido'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Acciones Principales */}
            <div className="flex flex-wrap items-center gap-3 justify-end">
               {isEditing ? (
                 <>
                   <button
                     onClick={() => { 
                        if(window.confirm('¿Descartar cambios?')) {
                            setIsEditing(false); 
                            setEditData(c); 
                        }
                     }}
                     disabled={saving}
                     className="px-4 py-2.5 rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition font-medium text-sm border border-transparent hover:border-gray-200"
                   >
                     Cancelar
                   </button>
                   <button
                     onClick={handleSave}
                     disabled={saving}
                     className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition shadow-md shadow-blue-200 disabled:opacity-70 active:scale-95 font-medium"
                   >
                     {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Save className="w-4 h-4" />}
                     <span>Guardar Cambios</span>
                   </button>
                 </>
               ) : (
                 <>
                   <button
                     onClick={() => { setIsEditing(true); setEditData(c); }}
                     className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 hover:border-blue-200 transition shadow-sm active:scale-95 font-medium"
                   >
                     <Edit2 className="w-4 h-4" />
                     <span>Editar</span>
                   </button>
                   <button onClick={onClose} className="p-2.5 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition border border-transparent hover:border-red-100 ml-1">
                     <X className="w-6 h-6" />
                   </button>
                 </>
               )}
            </div>
          </div>

          {/* Quick Info Bar & Toggles */}
          <div className="px-4 sm:px-6 py-3 flex flex-col xl:flex-row gap-4 xl:items-center justify-between bg-gray-50/80 backdrop-blur border-b border-gray-100">
            {/* Etiquetas y Toggles */}
            <div className="flex flex-wrap items-center gap-3">
               {c?.estado_etapa && (
                 <span className={`px-3 py-1 rounded-lg text-xs font-bold border uppercase tracking-wide shadow-sm ${getEtapaColor(c.estado_etapa as any)}`}>
                   {String(c.estado_etapa).replace(/_/g, ' ')}
                 </span>
               )}
               
               <div className="h-6 w-px bg-gray-300 mx-1 hidden sm:block"></div>

               <button 
                 onClick={handleBotToggle}
                 disabled={saving}
                 className={`group inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 shadow-sm
                   ${isBotOn(editData.consentimiento_contacto ?? c.consentimiento_contacto) 
                     ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200' 
                     : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 grayscale'}`}
               >
                 <div className={`w-2 h-2 rounded-full ${isBotOn(editData.consentimiento_contacto ?? c.consentimiento_contacto) ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                 <Bot className="w-3.5 h-3.5"/>
                 <span>{isBotOn(editData.consentimiento_contacto ?? c.consentimiento_contacto) ? 'Bot Activo' : 'Bot Apagado'}</span>
               </button>

               {canShowAsistio && (
                 <button
                   onClick={toggleAsistio}
                   className={`group inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 shadow-sm
                     ${asistio 
                        ? 'bg-teal-100 text-teal-800 border-teal-200 hover:bg-teal-200' 
                        : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'}`}
                 >
                   {asistio ? <CheckCircle className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                   <span>{asistio ? 'Asistió' : 'Pendiente Asistencia'}</span>
                 </button>
               )}
            </div>

            <div className="flex items-center gap-2 text-sm overflow-x-auto no-scrollbar">
               <a href={waLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-1.5 bg-white text-gray-700 rounded-lg hover:text-green-600 hover:border-green-200 hover:shadow-sm transition border border-gray-200 whitespace-nowrap font-medium text-xs group">
                 <MessageCircle className="w-4 h-4 text-green-500 group-hover:scale-110 transition-transform" /> 
                 <span className="opacity-90">{formatWhatsApp(c.whatsapp)}</span>
                 <ExternalLink className="w-3 h-3 opacity-50 ml-1"/>
               </a>
               <button onClick={() => handleCopy(phoneE164)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition" title="Copiar número">
                 <Copy className="w-4 h-4" />
               </button>
               {safeStr(c?.ciudad) && (
                 <a href={mapsLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-1.5 bg-white text-gray-700 rounded-lg hover:text-blue-600 hover:border-blue-200 hover:shadow-sm transition border border-gray-200 whitespace-nowrap font-medium text-xs group">
                   <MapPin className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" /> 
                   <span className="opacity-90">{safeStr(c?.ciudad)}</span>
                 </a>
               )}
            </div>
          </div>

          {/* === TABS NAVIGATION === */}
          <div className="px-4 sm:px-6 flex overflow-x-auto gap-6 border-b border-gray-100 no-scrollbar bg-white">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const counts = getTabCounts(tab.id);
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative flex items-center gap-2 py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap outline-none
                    ${isActive 
                      ? 'border-blue-600 text-blue-700' 
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'}`}
                >
                  <tab.icon className={`w-4 h-4 transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  <span>{tab.label}</span>
                  
                  {counts && (
                    <span className={`ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-md transition-colors
                      ${isActive 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'}`}>
                      {counts.filled}/{counts.total}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* === BODY CONTENT === */}
        <div className="flex-1 overflow-hidden flex flex-col bg-gray-50 relative">
          
          {activeTab === 'chat' ? (
            <ChatPanel
              client={c}
              source={(editData.source ?? c.source) as any}
            />
          ) : (
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-7xl mx-auto pb-10">
                
                {sectionsToRender.map((section, idx) => (
                  <div key={`${section.title}-${idx}`} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden h-fit flex flex-col">
                    {/* Section Header */}
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${section.iconColor}`}>
                                <section.icon className="w-5 h-5" />
                            </div>
                            <h3 className="font-bold text-gray-800 text-base tracking-tight">{section.title}</h3>
                        </div>
                    </div>

                    {/* Section Body */}
                    <div className="p-5 bg-white grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                      {section.fields.map((field, j) => {
                        const value = getVal(field.key);
                        const isEmpty = !safeStr(value);
                        const isFullWidth = field.type === 'textarea';
                        
                        // CORRECCIÓN PRINCIPAL AQUÍ:
                        // Usamos safeBigIntStr para asegurarnos de que los IDs de FB no se muestren como 1.23e+15
                        const displayValue = field.key === 'subscriber_id' 
                           ? safeBigIntStr(value) 
                           : (value ?? '');

                        return (
                          <div key={j} className={`flex flex-col gap-1.5 ${isFullWidth ? 'sm:col-span-2' : ''}`}>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-0.5 mb-1 flex items-center justify-between">
                               {field.label}
                               {!isEditing && !isEmpty && field.type !== 'boolean' && (
                                 <div className="w-1.5 h-1.5 rounded-full bg-blue-400/50" />
                               )}
                            </label>

                            {isEditing ? (
                                /* === Edit Mode === */
                                <div className="relative group">
                                  {field.key === 'estado_envio' ? (
                                    <div className="relative">
                                        <select
                                            value={String(value ?? '').toLowerCase() === 'envio_gestionado' ? 'envio_gestionado' : String(value ?? '').toLowerCase() === 'no_aplica' ? 'no_aplica' : ''}
                                            onChange={(e) => setVal('estado_envio', e.target.value as any)}
                                            className="w-full text-sm bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all px-3 py-2.5 appearance-none"
                                        >
                                            <option value="">(Seleccionar)</option>
                                            <option value="envio_gestionado">Envío gestionado</option>
                                            <option value="no_aplica">No aplica</option>
                                        </select>
                                        <ChevronRight className="absolute right-3 top-3 w-4 h-4 text-gray-400 rotate-90 pointer-events-none"/>
                                    </div>
                                  ) : field.type === 'textarea' ? (
                                    <textarea
                                      value={value ?? ''}
                                      onChange={(e) => setVal(field.key, e.target.value)}
                                      rows={3}
                                      placeholder="Escribe aquí..."
                                      className="w-full text-sm bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all px-3 py-2.5 resize-none placeholder:text-gray-300"
                                    />
                                  ) : field.type === 'boolean' ? (
                                    <div className="relative">
                                        <select
                                            value={value === true ? 'true' : 'false'}
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
                                      value={toInputDate(value)}
                                      onChange={(e) => setVal(field.key, e.target.value)}
                                      className="w-full text-sm bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all px-3 py-2.5"
                                    />
                                  ) : (
                                    <input
                                      type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                                      // USAMOS displayValue AQUÍ
                                      value={displayValue}
                                      onChange={(e) => setVal(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                                      placeholder="-"
                                      className="w-full text-sm bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all px-3 py-2.5 placeholder:text-gray-300"
                                    />
                                  )}
                                </div>
                            ) : (
                                /* === View Mode === */
                                <div className="min-h-[24px] flex items-center">
                                  {field.key === 'estado_envio' && value ? (
                                     <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${deriveEnvioUI({ ...c, ...editData }).classes}`}>
                                        <Truck className="w-3.5 h-3.5"/> {deriveEnvioUI({ ...c, ...editData }).label}
                                     </span>
                                  ) : isEmpty ? (
                                     <span className="text-gray-300 text-sm select-none font-light italic">Vacío</span>
                                  ) : field.key === 'whatsapp' ? (
                                     <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-gray-700 font-mono tracking-wide">{formatWhatsApp(String(value))}</span>
                                     </div>
                                  ) : (field.type === 'datetime' || field.key === 'fecha_agenda') ? (
                                     <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-gray-400"/> 
                                        {formatDate(String(value))}
                                     </span>
                                  ) : field.type === 'boolean' ? (
                                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide border ${value ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                        {value ? <CheckCircle className="w-3.5 h-3.5"/> : <X className="w-3.5 h-3.5"/>}
                                        {value ? 'Sí' : 'No'}
                                      </span>
                                  ) : (
                                     <span className="text-sm font-medium text-gray-700 break-words leading-relaxed whitespace-pre-wrap">
                                        {/* USAMOS displayValue TAMBIÉN AQUÍ */}
                                        {String(displayValue)}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};