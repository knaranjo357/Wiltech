// components/ClientModal.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Phone, Calendar, MapPin, User, Smartphone, FileText, Settings, DollarSign, UserCheck,
  Copy, MessageCircle, ShieldCheck, PackageSearch, ClipboardList, Building2, ClipboardCheck,
  Truck, Edit2, Save, Bot, CheckCircle,
} from 'lucide-react';
import { Client } from '../types/client';
import {
  formatDate,
  formatWhatsApp,
  getEtapaColor,
  getCategoriaColor,
  deriveEnvioUI, // ← usar helper canónico
} from '../utils/clientHelpers';
import { ChatPanel } from './ChatPanel';
import { SourceSelector, SOURCE_TO_SEDE } from './SourceSelector';

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

const SEDE_OPCIONES = ['Bogotá', 'Bucaramanga', 'Barranquilla', 'Barrancabermeja'];
const CUSTOM_VALUE = '__custom__';

// ========= Utils =========
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

// ========= Paleta fija =========
const COLORS = {
  overlay: 'rgba(17, 24, 39, 0.7)',
  headerFrom: '#4F46E5',
  headerTo: '#A21CAF',
  white: '#FFFFFF',
  black: '#111827',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  borderSoft: '#F3F4F6',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  emerald50: '#ECFDF5',
  emerald200: '#A7F3D0',
  emerald600: '#059669',
  purple50: '#F5F3FF',
  purple200: '#DDD6FE',
  purple700: '#6D28D9',
  indigo50: '#EEF2FF',
  indigo700: '#4338CA',
  indigo800: '#3730A3',
  neutral50: '#FAFAFA',
  neutral100: '#F5F5F5',
  neutral200: '#E5E7EB',
};

// ========= Componente =========
export const ClientModal: React.FC<ClientModalProps> = ({ isOpen, onClose, client, onUpdate }) => {
  const shouldRender = Boolean(isOpen && client);
  const c = (client ?? {}) as Client;

  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Estado
  const [activeTab, setActiveTab] = useState<'ficha' | 'chat'>('ficha');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Client>>({});
  const [saving, setSaving] = useState(false);

  // Al abrir
  useEffect(() => {
    if (!shouldRender) return;
    setActiveTab('ficha');
    setIsEditing(false);
    setEditData(c);
  }, [shouldRender]); // eslint-disable-line

  // Hotkeys + bloqueo scroll fondo
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

  // Helpers
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

  // Bot on/off
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

  // Asistencia
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

  // Datos memorizados
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
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border"
        style={{ background: '#ECFDF5', color: '#065F46', borderColor: '#A7F3D0' }}>
        <ShieldCheck className="w-3.5 h-3.5" />
        Bot activo
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border"
        style={{ background: COLORS.slate100, color: '#0F172A', borderColor: COLORS.slate200 }}>
        <ShieldCheck className="w-3.5 h-3.5" />
        Bot inactivo
      </span>
    );
  }, [editData.consentimiento_contacto, c?.consentimiento_contacto]);

  const etapaBadge = useMemo(() => {
    if (!c?.estado_etapa) return null;
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getEtapaColor(c.estado_etapa as any)}`} title="Etapa">
        {String(c.estado_etapa).replace('_', ' ')}
      </span>
    );
  }, [c?.estado_etapa]);

  const categoriaBadge = useMemo(() => {
    if (!c?.categoria_contacto) return null;
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${getCategoriaColor(c.categoria_contacto as any)}`} title="Categoría">
        {String(c.categoria_contacto).replace('_', ' ')}
      </span>
    );
  }, [c?.categoria_contacto]);

  const agendaBadge = useMemo(() => {
    if (!c?.fecha_agenda) return null;
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border"
        style={{ background: COLORS.purple50, color: COLORS.purple700, borderColor: COLORS.purple200 }}>
        <Calendar className="w-3.5 h-3.5" />
        {formatDate(c.fecha_agenda)}
      </span>
    );
  }, [c?.fecha_agenda]);

  const envioBadge = useMemo(() => {
    const st = deriveEnvioUI(c);
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${st.classes}`}
        title="Estado de envío"
      >
        <Truck className="w-3.5 h-3.5" />
        {st.label}
      </span>
    );
  }, [c]);

  // Source → efectos (auto sede)
  const applySourceSideEffects = (nextSource: string) => {
    setEditData(prev => {
      const currSede = String(prev.agenda_ciudad_sede ?? c.agenda_ciudad_sede ?? '').trim();
      const mapped = SOURCE_TO_SEDE[nextSource];
      const shouldAuto = !currSede || Object.values(SOURCE_TO_SEDE).includes(currSede);
      return {
        ...prev,
        source: nextSource,
        agenda_ciudad_sede: shouldAuto && mapped ? mapped : prev.agenda_ciudad_sede,
      };
    });
  };

  // Secciones
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
      { label: 'Estado envío', key: 'estado_envio', icon: Truck, type: 'text' },
    ]},
  ];

  const fichaTopRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (isEditing && activeTab === 'ficha') fichaTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isEditing, activeTab]);

  if (!shouldRender) return null;
  const currentSource = (editData.source ?? c.source) || '';

  return (
    <div
      ref={overlayRef}
      onMouseDown={onOverlayClick}
      className="fixed inset-0 z-[120] backdrop-blur-sm"
      style={{ background: COLORS.overlay }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-modal-title"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute inset-0 w-screen h-screen flex flex-col"
        style={{ background: COLORS.white }}
      >
        {/* Header */}
        <div
          className="relative px-6 py-5 text-white"
          style={{
            backgroundImage: `linear-gradient(90deg, ${COLORS.headerFrom}, ${COLORS.headerTo})`,
          }}
        >
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-semibold"
                   style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)' }}>
                {initials}
              </div>
              <div className="min-w-0">
                <h2 id="client-modal-title" className="text-2xl md:text-3xl font-semibold tracking-tight truncate">
                  {safeStr(c?.nombre) || 'Sin nombre'}
                </h2>
                <p className="opacity-90 truncate">{safeStr(c?.modelo) || 'Sin modelo'}</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2">
              {etapaBadge}
              {categoriaBadge}
              {agendaBadge}
              {envioBadge} {/* badge unificado */}
              {consentBadge}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Tabs */}
              <div className="hidden sm:flex rounded-xl overflow-hidden"
                   style={{ border: '1px solid rgba(255,255,255,0.4)' }}>
                <button
                  onClick={() => setActiveTab('ficha')}
                  className="px-3 py-1.5 text-sm font-medium transition"
                  style={activeTab === 'ficha'
                    ? { background: COLORS.white, color: COLORS.headerFrom }
                    : { background: 'rgba(255,255,255,0.08)', color: '#FFFFFF' }}
                >
                  Ficha
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className="px-3 py-1.5 text-sm font-medium transition"
                  style={activeTab === 'chat'
                    ? { background: COLORS.white, color: COLORS.headerFrom }
                    : { background: 'rgba(255,255,255,0.08)', color: '#FFFFFF' }}
                >
                  Chat
                </button>
              </div>

              {/* Asistencia */}
              {canShowAsistio && (
                <button
                  onClick={toggleAsistio}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition"
                  style={
                    asistio
                      ? { background: '#059669', color: '#FFFFFF', borderColor: '#047857' }
                      : { background: '#ECFDF5', color: '#065F46', borderColor: '#A7F3D0' }
                  }
                  title={asistio ? 'Marcar como NO asistió' : 'Marcar como asistió'}
                >
                  <CheckCircle className="w-4 h-4" />
                  {asistio ? 'Asistió' : 'Marcar asistencia'}
                </button>
              )}

              {!isEditing ? (
                <button
                  onClick={() => { setActiveTab('ficha'); setIsEditing(true); setEditData(c); }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl transition"
                  style={{ background: '#F9FAFB', color: COLORS.black, border: `1px solid ${COLORS.border}` }}
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
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl transition disabled:opacity-60"
                    style={{ background: COLORS.headerFrom, color: COLORS.white }}
                    title="Guardar"
                  >
                    <Save className="w-5 h-5" /> Guardar
                  </button>
                  <button
                    onClick={() => { setIsEditing(false); setEditData(c); }}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl transition disabled:opacity-60"
                    style={{ background: '#FFFFFF', color: COLORS.black, border: `1px solid ${COLORS.border}` }}
                    title="Cancelar"
                  >
                    <X className="w-5 h-5" /> Cancelar
                  </button>
                </>
              )}

              <button
                onClick={onClose}
                className="p-2 rounded-xl transition"
                style={{ color: '#FFFFFF' }}
                aria-label="Cerrar"
                title="Cerrar"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Source + sede */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SourceSelector value={currentSource} onChange={applySourceSideEffects} />
            {!!currentSource && (
              <span
                className="inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-xl"
                style={{ color: '#FFFFFF', background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)' }}
              >
                Origen: <strong className="ml-1">{currentSource}</strong>
                {SOURCE_TO_SEDE[currentSource] && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    <MapPin className="w-4 h-4" /> {SOURCE_TO_SEDE[currentSource]}
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Acciones rápidas */}
          <div
            className="mt-4 px-3 py-3 rounded-xl flex flex-wrap items-center gap-2"
            style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)' }}
          >
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl transition"
              style={{ background: COLORS.emerald50, color: '#065F46', border: `1px solid ${COLORS.emerald200}` }}
            >
              <MessageCircle className="w-4 h-4" />
              {formatWhatsApp(c.whatsapp)}
            </a>
            <button
              onClick={() => handleCopy((c?.whatsapp || '').replace('@s.whatsapp.net', ''))}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl transition"
              style={{ background: COLORS.slate100, color: COLORS.black, border: `1px solid ${COLORS.slate200}` }}
            >
              <Copy className="w-4 h-4" /> Copiar número
            </button>
            {safeStr(c?.ciudad) && (
              <a
                href={mapsLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl transition"
                style={{ background: COLORS.purple50, color: COLORS.purple700, border: `1px solid ${COLORS.purple200}` }}
              >
                <MapPin className="w-4 h-4" /> {safeStr(c?.ciudad)}
              </a>
            )}
            {(() => {
              const on = isBotOn(editData.consentimiento_contacto ?? c?.consentimiento_contacto);
              return (
                <button
                  onClick={handleBotToggle}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl transition disabled:opacity-60"
                  style={
                    on
                      ? { background: COLORS.headerFrom, color: COLORS.white }
                      : { background: '#FFFFFF', color: COLORS.black, border: `1px solid ${COLORS.border}` }
                  }
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
            <div ref={fichaTopRef} className="flex-1 overflow-y-auto p-6"
                 style={{ background: '#F7F7FB' }}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {sections.map((section, idx) => (
                  <section
                    key={idx}
                    className="rounded-2xl overflow-hidden"
                    style={{
                      background: COLORS.white,
                      border: `1px solid ${COLORS.borderSoft}`,
                      boxShadow: '0 6px 20px rgba(0,0,0,0.06)',
                    }}
                  >
                    <div className="p-5">
                      <div className="flex items-center mb-4">
                        <div
                          className="w-9 h-9 mr-3 rounded-xl flex items-center justify-center"
                          style={{ background: COLORS.indigo50, color: COLORS.headerFrom }}
                        >
                          <section.icon className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-semibold" style={{ color: COLORS.black }}>
                          {section.title}
                        </h3>
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

                          const isEstadoEnvio = field.key === 'estado_envio';

                          return (
                            <div
                              key={`${section.title}-${j}`}
                              className="group flex items-start gap-3 p-3 rounded-xl transition"
                              style={{ background: COLORS.neutral50, border: `1px solid ${COLORS.border}` }}
                            >
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                                style={{ background: COLORS.neutral100, color: COLORS.muted }}
                              >
                                <field.icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs mb-1" style={{ color: COLORS.muted }}>
                                  {field.label}
                                </p>

                                {!isEditing ? (
                                  isEstadoEnvio ? (
                                    (() => {
                                      const st = deriveEnvioUI(c);
                                      return (
                                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${st.classes}`}>
                                          <Truck className="w-3.5 h-3.5" />
                                          {st.label}
                                        </span>
                                      );
                                    })()
                                  ) : Lower.startsWith('etapa') && c.estado_etapa ? (
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getEtapaColor(c.estado_etapa as any)}`}>
                                      {String(c.estado_etapa).replace('_', ' ')}
                                    </span>
                                  ) : Lower.startsWith('categoría') && c.categoria_contacto ? (
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getCategoriaColor(c.categoria_contacto as any)}`}>
                                      {String(c.categoria_contacto).replace('_', ' ')}
                                    </span>
                                  ) : field.key === 'fecha_agenda' && value ? (
                                    <span className="inline-flex items-center gap-2"
                                          style={{ color: COLORS.purple700 }}>
                                      <Calendar className="w-4 h-4" />
                                      {formatDate(String(value))}
                                    </span>
                                  ) : field.key === 'whatsapp' && value ? (
                                    <span className="inline-flex items-center gap-2"
                                          style={{ color: '#047857' }}>
                                      <Phone className="w-4 h-4" />
                                      {formatWhatsApp(String(value))}
                                    </span>
                                  ) : (
                                    <p
                                      className="text-sm break-words"
                                      style={{ color: isEmpty ? COLORS.muted : COLORS.black, fontStyle: isEmpty ? 'italic' : 'normal' }}
                                    >
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
                                          className="w-full text-sm px-3 py-2 rounded-lg shadow-sm"
                                          style={{ background: COLORS.white, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
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
                                            className="w-full text-sm px-3 py-2 rounded-lg shadow-sm"
                                            style={{ background: COLORS.white, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
                                          />
                                        )}
                                      </div>
                                    ) : isEstadoEnvio ? (
                                      (() => {
                                        // coacción: solo aceptamos 'envio_gestionado' o 'no_aplica'
                                        const raw = String(getVal('estado_envio') ?? '').toLowerCase();
                                        const coerced = raw === 'envio_gestionado' || raw === 'no_aplica' ? raw : '';
                                        return (
                                          <select
                                            value={coerced}
                                            onChange={(e) => setVal('estado_envio', e.target.value as any)}
                                            className="w-full text-sm px-3 py-2 rounded-lg shadow-sm"
                                            style={{ background: COLORS.white, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
                                          >
                                            <option value="">— (sin estado) —</option>
                                            <option value="envio_gestionado">Envío gestionado</option>
                                            <option value="no_aplica">No aplica</option>
                                          </select>
                                        );
                                      })()
                                    ) : field.type === 'textarea' ? (
                                      <textarea
                                        value={value ?? ''}
                                        onChange={(e) => setVal(field.key, e.target.value)}
                                        rows={3}
                                        className="w-full text-sm px-3 py-2 rounded-lg shadow-sm"
                                        style={{ background: COLORS.white, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
                                      />
                                    ) : field.type === 'datetime' ? (
                                      <input
                                        type="datetime-local"
                                        value={value ?? ''}
                                        onChange={(e) => setVal(field.key, e.target.value)}
                                        className="w-full text-sm px-3 py-2 rounded-lg shadow-sm"
                                        style={{ background: COLORS.white, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
                                      />
                                    ) : field.type === 'email' ? (
                                      <input
                                        type="email"
                                        value={value ?? ''}
                                        onChange={(e) => setVal(field.key, e.target.value)}
                                        className="w-full text-sm px-3 py-2 rounded-lg shadow-sm"
                                        style={{ background: COLORS.white, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
                                      />
                                    ) : field.type === 'number' ? (
                                      <input
                                        type="number"
                                        value={value ?? ''}
                                        onChange={(e) => setVal(field.key, e.target.value === '' ? '' : Number(e.target.value))}
                                        className="w-full text-sm px-3 py-2 rounded-lg shadow-sm"
                                        style={{ background: COLORS.white, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
                                      />
                                    ) : field.type === 'boolean' ? (
                                      <select
                                        value={value === true ? 'true' : value === false ? 'false' : ''}
                                        onChange={(e) => setVal(field.key, e.target.value === 'true')}
                                        className="w-full text-sm px-3 py-2 rounded-lg shadow-sm"
                                        style={{ background: COLORS.white, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
                                      >
                                        <option value="true">Sí</option>
                                        <option value="false">No</option>
                                      </select>
                                    ) : (
                                      <input
                                        type="text"
                                        value={value ?? ''}
                                        onChange={(e) => setVal(field.key, e.target.value)}
                                        className="w-full text-sm px-3 py-2 rounded-lg shadow-sm"
                                        style={{ background: COLORS.white, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
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
            <ChatPanel
              client={c}
              source={currentSource}
              onSourceChange={applySourceSideEffects}
            />
          )}
        </div>
      </div>
    </div>
  );
};
