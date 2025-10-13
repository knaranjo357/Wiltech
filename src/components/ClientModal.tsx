import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Phone, Calendar, MapPin, User, Smartphone, FileText, Settings, DollarSign, UserCheck,
  Copy, MessageCircle, ShieldCheck, PackageSearch, ClipboardList, Building2, ClipboardCheck,
  Truck, Edit2, Save, Bot, Send, CheckCircle,
} from 'lucide-react';
import { Client } from '../types/client';
import { formatDate, formatWhatsApp, getEtapaColor, getCategoriaColor } from '../utils/clientHelpers';
import { ApiService } from '../services/apiService';

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

type ChatMsg = { id: string | number; type: 'human' | 'ai' | 'system'; content: string };

const SEDE_OPCIONES = ['Bogotá', 'Bucaramanga', 'Barranquilla', 'Barrancabermeja'];
const CUSTOM_VALUE = '__custom__';

const parseAgendaDate = (raw?: string | null): Date | null => {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  const t1 = Date.parse(s);
  if (!Number.isNaN(t1)) return new Date(t1);
  if (s.includes(' ') && !s.includes('T')) {
    const iso = s.length === 16 ? s.replace(' ', 'T') + ':00' : s.replace(' ', 'T');
    const t2 = Date.parse(iso);
    if (!Number.isNaN(t2)) return new Date(t2);
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d), 0, 0, 0);
  }
  return null;
};

const safeStr = (v?: unknown) => {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  const l = s.toLowerCase();
  return l === 'null' || l === 'undefined' ? '' : s;
};

export const ClientModal: React.FC<ClientModalProps> = ({ isOpen, onClose, client, onUpdate }) => {
  /** ===== NO returns antes de hooks ===== */
  const shouldRender = Boolean(isOpen && client);
  const c = (client ?? {}) as Client;

  const overlayRef = useRef<HTMLDivElement | null>(null);

  /** Estado general */
  const [activeTab, setActiveTab] = useState<'ficha' | 'chat'>('ficha');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Client>>({});
  const [saving, setSaving] = useState(false);

  /** Chat state */
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

  /** Reset al abrir */
  useEffect(() => {
    if (!shouldRender) return;
    setActiveTab('ficha');
    setIsEditing(false);
    setEditData(c);
    setMsgs([]);
    setChatError(null);
    setInput('');
  }, [shouldRender]); // eslint-disable-line

  /** Autoscroll chat */
  useEffect(() => {
    if (activeTab !== 'chat') return;
    const el = chatScrollRef.current;
    if (el) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
  }, [msgs, activeTab]);

  /** Hotkeys + bloqueo scroll fondo */
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
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = original;
    };
  }, [shouldRender, isEditing, activeTab, onClose, c]);

  const onOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
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

  /** Helpers */
  const getVal = <K extends keyof Client>(key: K): any => (editData[key] ?? c[key]) as any;
  const setVal = <K extends keyof Client>(key: K, value: any) => setEditData(prev => ({ ...prev, [key]: value }));
  const handleCopy = async (text: string) => { try { await navigator.clipboard.writeText(text); } catch {} };
  const notifyGlobalUpdate = (payload: Partial<Client>) => {
    try { window.dispatchEvent(new CustomEvent<Partial<Client>>('client:updated', { detail: payload })); } catch {}
    try { localStorage.setItem('crm:client-updated', JSON.stringify({ row_number: payload.row_number, at: Date.now() })); } catch {}
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

  /** Bot on/off */
  const isBotOn = (v: any) => v === true || v === '' || v === null;
  const handleBotToggle = async () => {
    const currentRaw = (editData.consentimiento_contacto ?? c.consentimiento_contacto) as any;
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
      const fullPayload: Partial<Client> = { ...c, ...optimistic, row_number: c.row_number };
      const ok = await onUpdate(fullPayload);
      if (ok) notifyGlobalUpdate(fullPayload);
      else setEditData(prevEdit);
    } catch {
      setEditData(prevEdit);
    } finally { setSaving(false); }
  };

  /** Asistencia */
  const agendaDate = parseAgendaDate(c?.fecha_agenda ?? null);
  const canShowAsistio = !!agendaDate;
  const asistio = Boolean(editData.asistio_agenda ?? c?.asistio_agenda);
  const toggleAsistio = async () => {
    const next = !asistio;
    const prev = editData.asistio_agenda;
    setEditData(p => ({ ...p, asistio_agenda: next }));
    try {
      const ok = await onUpdate({ row_number: c.row_number, asistio_agenda: next });
      if (!ok) setEditData(p => ({ ...p, asistio_agenda: prev }));
      else notifyGlobalUpdate({ row_number: c.row_number, asistio_agenda: next });
    } catch {
      setEditData(p => ({ ...p, asistio_agenda: prev }));
    }
  };

  /** Quick data memos (siempre fuera de condiciones) */
  const phoneE164 = (c?.whatsapp || '').replace('@s.whatsapp.net', '');
  const waLink = useMemo(() => `https://wa.me/${phoneE164}`, [phoneE164]);
  const mapsLink = useMemo(() => {
    const q = encodeURIComponent(safeStr(c?.ciudad) || 'Colombia');
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }, [c?.ciudad]);
  const initials = useMemo(() => {
    const name = safeStr(c?.nombre);
    if (!name) return '👤';
    const parts = name.split(' ').filter(Boolean);
    return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
  }, [c?.nombre]);

  const consentBadge = useMemo(() => {
    const raw = (editData.consentimiento_contacto ?? c?.consentimiento_contacto) as any;
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
  }, [editData.consentimiento_contacto, c?.consentimiento_contacto]);

  const etapaBadge = useMemo(() => {
    if (!c?.estado_etapa) return null;
    return (
      <span className={`badge border ${getEtapaColor(c.estado_etapa as any)} font-semibold`} title="Etapa">
        {String(c.estado_etapa).replace('_', ' ')}
      </span>
    );
  }, [c?.estado_etapa]);

  const categoriaBadge = useMemo(() => {
    if (!c?.categoria_contacto) return null;
    return (
      <span className={`badge ${getCategoriaColor(c.categoria_contacto as any)} font-semibold`} title="Categoría">
        {String(c.categoria_contacto).replace('_', ' ')}
      </span>
    );
  }, [c?.categoria_contacto]);

  const agendaBadge = useMemo(() => {
    if (!c?.fecha_agenda) return null;
    return (
      <span className="badge bg-purple-50 text-purple-700 border border-purple-200">
        <Calendar className="w-3.5 h-3.5" />
        {formatDate(c.fecha_agenda)}
      </span>
    );
  }, [c?.fecha_agenda]);

  /** Chat API */
  const loadConversation = async () => {
    if (!c?.whatsapp) return;
    try {
      setChatLoading(true);
      setChatError(null);
      const resp = await ApiService.post<any[]>('/conversacion', { whatsapp: c.whatsapp });
      const normalized: ChatMsg[] = Array.isArray(resp)
        ? resp.map((it, idx) => ({
            id: it?.id ?? idx,
            type: (it?.message?.type === 'human' || it?.message?.type === 'ai' || it?.message?.type === 'system')
              ? it.message.type
              : 'ai',
            content: String(it?.message?.content ?? '').trim(),
          }))
        : [];
      setMsgs(normalized);
      setTimeout(() => chatInputRef.current?.focus(), 0);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'No se pudo cargar la conversación');
    } finally {
      setChatLoading(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !c?.whatsapp) return;
    const optimistic: ChatMsg = { id: `local-${Date.now()}`, type: 'ai', content: text };
    setMsgs(prev => [...prev, optimistic]);
    setInput('');
    setSending(true);
    try {
      await ApiService.post('/enviarmensaje', { whatsapp: c.whatsapp, mensaje: text });
      await loadConversation();
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'No se pudo enviar el mensaje');
      setMsgs(prev => prev.filter(m => m !== optimistic));
      setInput(text);
      chatInputRef.current?.focus();
    } finally { setSending(false); }
  };

  /** Secciones (sin hooks dentro) */
  const sections: Array<{ title: string; icon: React.ComponentType<any>; fields: Array<FieldDef>; }> = [
    { title: 'Información Personal', icon: User, fields: [
      { label: 'Nombre', key: 'nombre', icon: User, type: 'text' },
      { label: 'WhatsApp', key: 'whatsapp', icon: Phone, type: 'text' },
      { label: 'Ciudad', key: 'ciudad', icon: MapPin, type: 'text' },
    ]},
    { title: 'Dispositivo y Servicio', icon: Smartphone, fields: [
      { label: 'Modelo', key: 'modelo', icon: Smartphone, type: 'text' },
      { label: 'Intención', key: 'intencion', icon: Settings, type: 'text' },
      { label: 'Detalles', key: 'detalles', icon: FileText, type: 'textarea' },
      { label: 'Modo de recepción', key: 'modo_recepcion', icon: MapPin, type: 'text' },
    ]},
    { title: 'Estado y Seguimiento', icon: Calendar, fields: [
      { label: 'Etapa', key: 'estado_etapa', icon: Settings, type: 'text' },
      { label: 'Categoría', key: 'categoria_contacto', icon: UserCheck, type: 'text' },
      { label: 'Fecha agenda', key: 'fecha_agenda', icon: Calendar, type: 'datetime' },
      { label: 'Asignado a', key: 'asignado_a', icon: User, type: 'text' },
      { label: 'Sede/Ciudad agenda', key: 'agenda_ciudad_sede', icon: Building2, type: 'text' },
    ]},
    { title: 'Diagnóstico y Precios', icon: PackageSearch, fields: [
      { label: 'Diagnóstico requerido', key: 'diagnostico_requerido', icon: ClipboardCheck, type: 'text' },
      { label: 'Equipo manipulado', key: 'equipo_manipulado', icon: ClipboardList, type: 'text' },
      { label: 'Precio diagnóstico informado', key: 'precio_diagnostico_informado', icon: DollarSign, type: 'text' },
      { label: 'Precio reparación estimado', key: 'precio_reparacion_estimado', icon: DollarSign, type: 'text' },
      { label: 'Precio máximo informado', key: 'precio_maximo_informado', icon: DollarSign, type: 'text' },
      { label: 'Estado búsqueda de precios', key: 'buscar_precios_status', icon: DollarSign, type: 'text' },
      { label: 'Descuento multi-reparación', key: 'descuento_multi_reparacion', icon: DollarSign, type: 'text' },
      { label: 'Servicios adicionales', key: 'servicios_adicionales', icon: Settings, type: 'text' },
    ]},
    { title: 'Notas y Observaciones', icon: FileText, fields: [
      { label: 'Notas del cliente', key: 'notas_cliente', icon: FileText, type: 'textarea' },
      { label: 'Notas internas', key: 'notas', icon: FileText, type: 'textarea' },
      { label: 'Observaciones técnicas', key: 'observaciones_tecnicas', icon: FileText, type: 'textarea' },
      { label: 'Interés en accesorios', key: 'interes_accesorios', icon: Settings, type: 'text' },
    ]},
    { title: 'Guía / Envío', icon: Truck, fields: [
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
    ]},
  ];

  const fichaTopRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (isEditing && activeTab === 'ficha') fichaTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isEditing, activeTab]);

  /** ===== Render final (AHORA sí podemos retornar) ===== */
  if (!shouldRender) return null;

  return (
    <div
      ref={overlayRef}
      onMouseDown={onOverlayClick}
      className="fixed inset-0 z-[120] bg-neutral-950/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-modal-title"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute inset-0 w-screen h-screen flex flex-col bg-white dark:bg-neutral-950"
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
                <h2 id="client-modal-title" className="text-2xl md:text-3xl font-semibold tracking-tight truncate">
                  {safeStr(c?.nombre) || 'Sin nombre'}
                </h2>
                <p className="text-indigo-100/90 truncate">{safeStr(c?.modelo) || 'Sin modelo'}</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2">
              {etapaBadge}
              {categoriaBadge}
              {agendaBadge}
              {consentBadge}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden sm:flex rounded-xl overflow-hidden border border-white/40">
                <button
                  onClick={() => setActiveTab('ficha')}
                  className={`px-3 py-1.5 text-sm font-medium ${activeTab === 'ficha' ? 'bg-white text-indigo-700' : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                  Ficha
                </button>
                <button
                  onClick={async () => { setActiveTab('chat'); await loadConversation(); }}
                  className={`px-3 py-1.5 text-sm font-medium ${activeTab === 'chat' ? 'bg-white text-indigo-700' : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                  Chat
                </button>
              </div>

              {canShowAsistio && (
                <button
                  onClick={toggleAsistio}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition
                    ${asistio
                      ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}
                  title={asistio ? 'Marcar como NO asistió' : 'Marcar como asistió'}
                >
                  <CheckCircle className="w-4 h-4" />
                  {asistio ? 'Asistió' : 'Marcar asistencia'}
                </button>
              )}

              {!isEditing ? (
                <button
                  onClick={() => { setActiveTab('ficha'); setIsEditing(true); setEditData(c); }}
                  className="btn-secondary"
                  title="Editar"
                >
                  <Edit2 className="w-5 h-5" />
                  Editar
                </button>
              ) : (
                <>
                  <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-60" title="Guardar">
                    <Save className="w-5 h-5" /> Guardar
                  </button>
                  <button onClick={() => { setIsEditing(false); setEditData(c); }} disabled={saving} className="btn-ghost disabled:opacity-60" title="Cancelar">
                    <X className="w-5 h-5" /> Cancelar
                  </button>
                </>
              )}

              <button onClick={onClose} className="btn-icon hover:bg-white/20 text-white" aria-label="Cerrar" title="Cerrar">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="mt-3 flex md:hidden flex-wrap items-center gap-2">
            {etapaBadge}
            {categoriaBadge}
            {agendaBadge}
            {consentBadge}
          </div>

          <div className="mt-4 px-0 py-3 bg-white/20 rounded-xl border border-white/30 flex flex-wrap items-center gap-2">
            <a href={waLink} target="_blank" rel="noreferrer" className="btn bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-emerald-600/10 border border-emerald-200">
              <MessageCircle className="w-4 h-4" />
              {formatWhatsApp(c.whatsapp)}
            </a>
            <button onClick={() => handleCopy((c?.whatsapp || '').replace('@s.whatsapp.net', ''))} className="btn bg-neutral-100 text-neutral-800 hover:bg-neutral-200">
              <Copy className="w-4 h-4" /> Copiar número
            </button>
            {safeStr(c?.ciudad) && (
              <a href={mapsLink} target="_blank" rel="noreferrer" className="btn bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200">
                <MapPin className="w-4 h-4" /> {safeStr(c?.ciudad)}
              </a>
            )}
            {(() => {
              const on = isBotOn(editData.consentimiento_contacto ?? c?.consentimiento_contacto);
              return (
                <button
                  onClick={handleBotToggle}
                  disabled={saving}
                  className={on ? 'btn-primary disabled:opacity-60' : 'btn-secondary disabled:opacity-60'}
                  title={on ? 'Apagar bot para este número' : 'Encender bot para este número'}
                >
                  <Bot className="w-4 h-4" /> {on ? 'Apagar bot' : 'Encender bot'}
                </button>
              );
            })()}
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 flex flex-col min-h-0">
          {activeTab === 'ficha' ? (
            <div ref={fichaTopRef} className="flex-1 overflow-y-auto p-6 bg-neutral-50/60 dark:bg-neutral-950/60">
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
                          const isEmpty = !safeStr(value);
                          const isSedeField = field.key === 'agenda_ciudad_sede';
                          const sedeSelectValue = isSedeField
                            ? (SEDE_OPCIONES.includes(safeStr(value)) ? safeStr(value) : CUSTOM_VALUE)
                            : '';

                          return (
                            <div key={`${section.title}-${j}`} className="group flex items-start gap-3 p-3 rounded-xl border border-neutral-200/70 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/60 hover:shadow-sm transition">
                              <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 flex items-center justify-center mt-0.5">
                                <field.icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="section-title !normal-case !tracking-normal !text-xs !text-neutral-500 dark:!text-neutral-400 mb-1">
                                  {field.label}
                                </p>

                                {!isEditing ? (
                                  Lower.startsWith('etapa') && c.estado_etapa ? (
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getEtapaColor(c.estado_etapa as any)}`}>
                                      {String(c.estado_etapa).replace('_', ' ')}
                                    </span>
                                  ) : Lower.startsWith('categoría') && c.categoria_contacto ? (
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getCategoriaColor(c.categoria_contacto as any)}`}>
                                      {String(c.categoria_contacto).replace('_', ' ')}
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
                                      {isEmpty ? '— sin dato —' : safeStr(value)}
                                    </p>
                                  )
                                ) : (
                                  <>
                                    {isSedeField ? (
                                      <div className="flex flex-col gap-2">
                                        <select
                                          value={sedeSelectValue}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            if (v === CUSTOM_VALUE) setVal('agenda_ciudad_sede', '');
                                            else setVal('agenda_ciudad_sede', v);
                                          }}
                                          className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900"
                                        >
                                          {SEDE_OPCIONES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                          <option value={CUSTOM_VALUE}>Escribir…</option>
                                        </select>
                                        {sedeSelectValue === CUSTOM_VALUE && (
                                          <input
                                            type="text"
                                            value={safeStr(getVal('agenda_ciudad_sede'))}
                                            onChange={(e) => setVal('agenda_ciudad_sede', e.target.value)}
                                            placeholder="Escribe la sede…"
                                            className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900"
                                          />
                                        )}
                                      </div>
                                    ) : field.type === 'textarea' ? (
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
          ) : (
            <div className="flex-1 min-h-0 flex flex-col bg-white">
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-50">
                {chatLoading && (
                  <div className="flex items-center justify-center py-6 text-neutral-600 text-sm">
                    Cargando conversación…
                  </div>
                )}
                {chatError && (
                  <div className="mx-auto max-w-md w-full p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
                    {chatError}
                  </div>
                )}
                {!chatLoading && !chatError && msgs.length === 0 && (
                  <div className="mx-auto max-w-md w-full p-3 rounded-lg border border-neutral-200 bg-white text-neutral-700 text-sm">
                    No hay mensajes todavía. ¡Envía el primero!
                  </div>
                )}
                {msgs.map((m) => {
                  const isMe = m.type === 'ai'; // yo = AI
                  return (
                    <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow
                        ${isMe ? 'bg-indigo-600 text-white' : 'bg-white text-neutral-900 border border-neutral-200'}`}>
                        {m.content.split('\n').map((line, i) => (
                          <p key={i} className="whitespace-pre-wrap">{line}</p>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-neutral-200 p-3 bg-white">
                <form
                  onSubmit={(e) => { e.preventDefault(); if (!sending && input.trim()) sendMessage(); }}
                  className="flex items-end gap-2"
                >
                  <textarea
                    ref={chatInputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Escribe un mensaje…"
                    className="flex-1 resize-none rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                    rows={1}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        if (!sending && input.trim()) sendMessage();
                      }
                    }}
                  />
                  <button
                    type="submit"
                    disabled={sending || !input.trim()}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                    title="Enviar"
                  >
                    <Send className="w-4 h-4" />
                    Enviar
                  </button>
                </form>
                <div className="mt-1 text-[11px] text-neutral-500">
                  Enviando a: <span className="font-mono">{c?.whatsapp}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
