import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, RefreshCw, Eye, X, Image as ImageIcon, Play, ClipboardCheck, Smartphone, User, MapPin, Wrench, Clock, ShieldCheck, Hash, Edit3, Save, Bot, Send, Loader } from 'lucide-react';
import { ReparacionService } from '../services/reparacionService';
import type { Reparacion } from '../types/reparacion';
import { agenteApi, flowApi } from '../services/diagnosticadorService';
import type { FlowData } from '../types/diagnosticador';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Diagnosticador from './Diagnosticador';

const labelFor = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());

const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 'Sin definir';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'Sin definir';
  if (typeof value === 'object') return Object.values(value as object).join(' · ');
  return String(value);
};

const InfoSection = ({ title, icon: Icon, data, accent = 'slate' }: { title: string; icon: typeof User; data: Record<string, unknown>; accent?: 'slate' | 'blue' | 'amber' | 'emerald' }) => {
  const entries = Object.entries(data || {}).filter(([, value]) => value !== null && value !== undefined && value !== '');
  const colors = { slate: 'bg-slate-100 text-slate-700', blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700', emerald: 'bg-emerald-50 text-emerald-700' };
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className={`rounded-xl p-2 ${colors[accent]}`}><Icon className="h-4 w-4" /></div>
        <h3 className="text-xs font-black uppercase tracking-[0.16em] text-slate-700">{title}</h3>
      </div>
      <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        {entries.map(([key, value]) => (
          <div key={key} className="border-b border-slate-100 px-5 py-4 last:border-0">
            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">{labelFor(key)}</span>
            <span className="mt-1 block break-words text-sm font-semibold leading-relaxed text-slate-800">{displayValue(value)}</span>
          </div>
        ))}
        {entries.length === 0 && <div className="px-5 py-8 text-sm italic text-slate-400">Sin información registrada.</div>}
      </div>
    </section>
  );
};

type DiagnosisItem = {
  key: string;
  label: string;
  type: string;
  raw: any;
  visible: string;
  stepId: string | null;
  options: Array<{ label: string; value: string | boolean | number }>;
};

const visibleAnswer = (value: any, options: DiagnosisItem['options']) => {
  const values = Array.isArray(value) ? value : [value];
  return values.map(item => {
    const option = options.find(candidate => candidate.value === item);
    if (option) return option.label;
    if (item === true || item === 'true') return 'Sí';
    if (item === false || item === 'false') return 'No';
    return item ?? '';
  }).join(', ');
};

const getDiagnosisItems = (repair: Reparacion, flows: FlowData[]): DiagnosisItem[] => {
  const flow = flows.find(item => item.id === repair.id_diagrama || item.flow_name === repair.flow_name);
  const fieldRows = (flow?.configuracion.steps || []).flatMap(step =>
    (step.fields || []).map(field => ({ field, stepId: step.id }))
  );
  return Object.entries(repair.respuestas || {}).map(([key, stored]) => {
    const row = fieldRows.find(item => item.field.key === key);
    const detail = stored && typeof stored === 'object' && !Array.isArray(stored) && 'pregunta' in stored
      ? stored as { pregunta?: string; respuesta?: unknown; valor?: unknown; tipo?: string; step_id?: string }
      : null;
    const raw = detail ? detail.valor : stored;
    const options = row?.field.options || [];
    const type = detail?.tipo || row?.field.type || typeof raw;
    return {
      key,
      label: detail?.pregunta || row?.field.label || labelFor(key),
      type,
      raw,
      visible: String(detail?.respuesta ?? visibleAnswer(raw, options) ?? 'Sin respuesta'),
      stepId: detail?.step_id || row?.stepId || null,
      options,
    };
  });
};

const getStepTitle = (repair: Reparacion, flows: FlowData[]) => {
  const flow = flows.find(item => item.id === repair.id_diagrama || item.flow_name === repair.flow_name);
  return flow?.configuracion.steps.find(step => step.id === repair.paso_actual)?.title || repair.paso_actual || 'Sin definir';
};

const parseAgentResponse = (response: any): string => {
  if (!response) return 'No se recibió respuesta del agente.';
  const value = Array.isArray(response) ? response[0] : response;
  const text = typeof value === 'string' ? value : value?.respuesta || value?.response || value?.output || value?.text || JSON.stringify(value);
  return String(text).replace(/\\n/g, '\n');
};

const getRepairAgentContext = (repair: Reparacion, flows: FlowData[]) => ({
  instruccion: 'Responde como asistente técnico de esta reparación. Usa toda la información disponible y no inventes datos.',
  reparacion: { id: repair.id, numero_orden: repair.numero_orden, id_dispositivo: repair.id_dispositivo, id_diagrama: repair.id_diagrama, diagrama: repair.flow_name, version_diagrama: repair.version_diagrama, estado: repair.estado, estado_diagnostico: repair.estado_diagnostico, paso_actual: getStepTitle(repair, flows), tecnico_asignado: repair.tecnico_asignado, sede: repair.sede, prioridad: repair.prioridad, fecha_ingreso: repair.fecha_ingreso, fecha_promesa: repair.fecha_promesa, fecha_entrega: repair.fecha_entrega },
  cliente_y_crm: { crm_row_number: repair.crm_row_number, crm_source: repair.crm_source, whatsapp: repair.crm_whatsapp, ...repair.crm_data },
  equipo: repair.datos_dispositivo || {},
  recepcion_y_falla: repair.detalle_reparacion || {},
  diagnostico: Object.fromEntries(getDiagnosisItems(repair, flows).map(item => [item.label, item.visible])),
  evidencias: (repair.multimedia || []).map(media => ({ pregunta: media.field_key, nombre: media.nombre_archivo, descripcion: media.descripcion, tipo: media.mime_type, url: media.archivo_url })),
});
export default function ReparacionesPage() {
  const [rows, setRows] = useState<Reparacion[]>([]);
  const [selected, setSelected] = useState<Reparacion | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flows, setFlows] = useState<FlowData[]>([]);
  const [editingAnswers, setEditingAnswers] = useState(false);
  const [answerDraft, setAnswerDraft] = useState<Record<string, any>>({});
  const [answerSaving, setAnswerSaving] = useState(false);
  const [agentOpen, setAgentOpen] = useState(true);
  const [agentMessages, setAgentMessages] = useState<Array<{ sender: 'user' | 'agent'; text: string }>>([]);
  const [agentInput, setAgentInput] = useState('');
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentSessionId, setAgentSessionId] = useState('');
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const [workspace, setWorkspace] = useState<'ordenes' | 'diagnostico' | 'reparacion'>(() => {
    const mode = initialParams.get('modo');
    return mode === 'reparacion' ? 'reparacion' : mode === 'diagnostico' ? 'diagnostico' : 'ordenes';
  });
  const [processRepairId, setProcessRepairId] = useState<string>(() => initialParams.get('id_reparacion') || '');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [repairs, diagrams] = await Promise.all([ReparacionService.getAll(), flowApi.getAll()]);
      setRows(repairs);
      setFlows(diagrams || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las reparaciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return term ? rows.filter(row => JSON.stringify(row).toLowerCase().includes(term)) : rows;
  }, [rows, search]);

  useEffect(() => {
    if (!selected) return;
    setAnswerDraft(Object.fromEntries(getDiagnosisItems(selected, flows).map(item => [item.key, item.raw])));
    setEditingAnswers(false);
    setAgentSessionId('reparacion_' + selected.id + '_' + Date.now());
    setAgentMessages([{ sender: 'agent', text: 'Hola. Ya tengo el contexto completo de esta reparación. Puedes preguntarme por el equipo, la falla, las respuestas del diagnóstico o las evidencias.' }]);
    setAgentInput('');
    setAgentOpen(true);
  }, [selected?.id, flows]);

  const saveDiagnosticAnswers = async () => {
    if (!selected) return;
    setAnswerSaving(true);
    try {
      const items = getDiagnosisItems(selected, flows);
      const respuestas = Object.fromEntries(items.map(item => {
        const value = answerDraft[item.key];
        return [item.key, {
          pregunta: item.label,
          respuesta: item.type === 'multimedia' ? `${Array.isArray(value) ? value.length : 0} archivos adjuntos` : visibleAnswer(value, item.options),
          valor: value,
          tipo: item.type,
          step_id: item.stepId,
        }];
      }));
      const updated = await ReparacionService.update({ id: selected.id, respuestas });
      setRows(current => current.map(row => row.id === updated.id ? updated : row));
      setSelected(updated);
      setEditingAnswers(false);
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : 'No se pudieron guardar las respuestas');
    } finally {
      setAnswerSaving(false);
    }
  };

  const openProcess = (type: 'diagnostico' | 'reparacion', repair?: Reparacion) => {
    const nextRepairId = repair ? String(repair.id) : workspace !== 'ordenes' ? processRepairId : '';
    setProcessRepairId(nextRepairId);
    setSelected(null);
    setWorkspace(type);
    window.history.replaceState(null, '', '/reparaciones?modo=' + type + (nextRepairId ? '&id_reparacion=' + nextRepairId : ''));
  };

  const showOrders = () => {
    setWorkspace('ordenes');
    setProcessRepairId('');
    window.history.replaceState(null, '', '/reparaciones');
    void load();
  };
  const sendAgentMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = agentInput.trim();
    if (!selected || !message || agentLoading) return;
    const history = agentMessages.map(item => ({ role: item.sender === 'user' ? 'user' : 'assistant', content: item.text }));
    setAgentInput('');
    setAgentMessages(current => [...current, { sender: 'user', text: message }]);
    setAgentLoading(true);
    try {
      const response = await agenteApi.chat({ mensaje: message, sessionId: agentSessionId, historial: history, informacion_contexto: getRepairAgentContext(selected, flows) });
      setAgentMessages(current => [...current, { sender: 'agent', text: parseAgentResponse(response) }]);
    } catch (cause) {
      console.error('Error al consultar el agente de reparaciones:', cause);
      setAgentMessages(current => [...current, { sender: 'agent', text: 'No pude conectarme con el agente en este momento. Intenta nuevamente.' }]);
    } finally {
      setAgentLoading(false);
    }
  };
  if (workspace !== 'ordenes') {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-slate-50 md:h-screen">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Centro de reparaciones</span>
            <h1 className="text-lg font-black text-slate-900">{workspace === 'diagnostico' ? 'Realizar diagnóstico' : 'Ejecutar reparación'}</h1>
          </div>
          <div className="flex rounded-2xl bg-slate-100 p-1">
            <button onClick={showOrders} className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-white">Órdenes</button>
            <button onClick={() => openProcess('diagnostico')} className={'rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-wider ' + (workspace === 'diagnostico' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500')}>Diagnóstico</button>
            <button onClick={() => openProcess('reparacion')} className={'rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-wider ' + (workspace === 'reparacion' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500')}>Reparación</button>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <Diagnosticador key={workspace} embedded processType={workspace} initialRepairId={processRepairId} onExit={showOrders} onSwitchProcess={type => openProcess(type)} onRepairLinked={setProcessRepairId} />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container flex flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Reparaciones</h1>
          <p className="mt-1 text-sm text-slate-500">Ingresos, equipos, diagnóstico y evidencia multimedia.</p>
        </div>
        <button onClick={() => void load()} className="btn-secondary"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar</button>
      </header>

      <div className="flex w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
        <button className="flex-1 rounded-xl bg-slate-950 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-white">Órdenes</button>
        <button onClick={() => openProcess('diagnostico')} className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-wider text-blue-700 transition hover:bg-blue-50"><ClipboardCheck className="h-4 w-4" /> Iniciar diagnóstico</button>
        <button onClick={() => openProcess('reparacion')} className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-wider text-amber-700 transition hover:bg-amber-50"><Wrench className="h-4 w-4" /> Iniciar reparación</button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por dispositivo, cliente, modelo, WhatsApp, estado..." className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-slate-500" />
      </div>

      {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <tr><th className="p-4">Dispositivo</th><th className="p-4">Cliente CRM</th><th className="p-4">Equipo</th><th className="p-4">Estado</th><th className="p-4">Diagnóstico</th><th className="p-4">Ingreso</th><th className="p-4" /></tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="p-4"><strong className="block text-sm text-slate-900">{row.id_dispositivo}</strong><span className="text-xs text-slate-400">#{row.id}</span></td>
                  <td className="p-4"><span className="block text-sm font-bold">{String(row.crm_data?.nombre || 'Sin cliente')}</span><span className="text-xs text-slate-400">CRM #{row.crm_row_number || '—'} · {row.crm_whatsapp || '—'}</span></td>
                  <td className="p-4 text-sm">{String(row.datos_dispositivo?.marca || '')} {String(row.datos_dispositivo?.modelo || row.crm_data?.modelo || 'Sin modelo')}</td>
                  <td className="p-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase">{row.estado}</span></td>
                  <td className="p-4"><span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase text-blue-700">{row.estado_diagnostico}</span></td>
                  <td className="p-4 text-xs text-slate-500">{row.fecha_ingreso ? new Date(row.fecha_ingreso).toLocaleString('es-CO') : '—'}</td>
                  <td className="p-4"><button onClick={() => setSelected(row)} className="rounded-xl bg-slate-900 p-2.5 text-white"><Eye className="h-4 w-4" /></button></td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-sm text-slate-400">No hay reparaciones registradas.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {selected && createPortal((
        <div className="fixed inset-0 z-[180] bg-slate-100">
          <div className="flex h-screen min-h-0 w-screen flex-col overflow-hidden bg-slate-50">
            <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="shrink-0 rounded-xl bg-slate-950 p-2.5 text-white"><Smartphone className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black tracking-tight text-slate-900 sm:text-xl">{String(selected.datos_dispositivo?.modelo || selected.crm_data?.modelo || 'Equipo sin modelo')}</h2>
                    <p className="truncate text-xs font-medium text-slate-400">{String(selected.crm_data?.nombre || 'Cliente sin identificar')} · {selected.id_dispositivo}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={() => setAgentOpen(current => !current)} className={agentOpen ? 'flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-violet-700' : 'flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-600'}>
                    <Bot className="h-4 w-4" /><span className="hidden sm:inline">Agente IA</span>
                  </button>
                  <button onClick={() => openProcess('diagnostico', selected)} className="flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-white sm:px-4">
                    <ClipboardCheck className="h-4 w-4" /><span className="hidden sm:inline">Diagnóstico</span><span className="sm:hidden">Diag.</span>
                  </button>
                  <button onClick={() => openProcess('reparacion', selected)} className="flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-white sm:px-4">
                    <Wrench className="h-4 w-4" /><span className="hidden sm:inline">Reparación</span><span className="sm:hidden">Rep.</span>
                  </button>
                  <button onClick={() => setSelected(null)} className="rounded-xl border border-slate-200 p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-700">{selected.estado}</span>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-blue-700">{selected.estado_diagnostico}</span>
              </div>
            </header>

            <div className="grid grid-cols-2 border-b border-slate-200 bg-white md:grid-cols-4">
              {[
                { label: 'Orden interna', value: `#${selected.id}`, icon: Hash },
                { label: 'Sede', value: selected.sede || 'Sin sede', icon: MapPin },
                { label: 'Prioridad', value: selected.prioridad || 'Normal', icon: ShieldCheck },
                { label: 'Fecha de ingreso', value: selected.fecha_ingreso ? new Date(selected.fecha_ingreso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha', icon: Clock },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 border-b border-r border-slate-100 px-5 py-4 md:border-b-0">
                  <item.icon className="h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0"><span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">{item.label}</span><strong className="block truncate text-xs capitalize text-slate-800">{String(item.value).replace(/_/g, ' ')}</strong></div>
                </div>
              ))}
            </div>

            <div className="relative flex min-h-0 flex-1 overflow-hidden"><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
              <div className="grid gap-5 lg:grid-cols-12">
                <main className="space-y-5 lg:col-span-8">
                  <InfoSection title="Cliente" icon={User} accent="blue" data={{ nombre: selected.crm_data?.nombre, whatsapp: selected.crm_whatsapp || selected.crm_data?.whatsapp, ciudad: selected.crm_data?.ciudad, fecha_agenda: selected.crm_data?.fecha_agenda, asignado_a: selected.crm_data?.asignado_a }} />
                  <InfoSection title="Ficha del equipo" icon={Smartphone} data={selected.datos_dispositivo || {}} />
                  <InfoSection title="Recepción y falla reportada" icon={Wrench} accent="amber" data={selected.detalle_reparacion || {}} />
                  <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><ClipboardCheck className="h-4 w-4" /></div>
                        <h3 className="text-xs font-black uppercase tracking-[0.16em] text-slate-700">Resultado del diagnóstico</h3>
                      </div>
                      <div className="flex gap-2">
                        {editingAnswers ? (
                          <>
                            <button onClick={() => setEditingAnswers(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-[9px] font-black uppercase text-slate-500">Cancelar</button>
                            <button onClick={() => void saveDiagnosticAnswers()} disabled={answerSaving} className="flex items-center gap-1 rounded-lg bg-slate-950 px-3 py-2 text-[9px] font-black uppercase text-white"><Save className="h-3 w-3" /> {answerSaving ? 'Guardando' : 'Guardar'}</button>
                          </>
                        ) : (
                          <button onClick={() => setEditingAnswers(true)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[9px] font-black uppercase text-slate-600"><Edit3 className="h-3 w-3" /> Editar respuestas</button>
                        )}
                      </div>
                    </div>
                    <div>
                      {getDiagnosisItems(selected, flows).map(item => {
                        const fieldMedia = (selected.multimedia || []).filter(media => media.field_key === item.key);
                        return (
                          <div key={item.key} className="border-b border-slate-100 px-5 py-4 last:border-0">
                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">{item.label}</span>
                            {item.type === 'multimedia' ? (
                              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {fieldMedia.map(media => (
                                  <div key={String(media.id)} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                    {media.mime_type?.startsWith('image/') || /\.(jpe?g|png|gif|webp)(?:\?|$)/i.test(media.archivo_url) ? (
                                      <a href={media.archivo_url} target="_blank" rel="noreferrer"><img src={media.archivo_url} alt={media.descripcion || media.nombre_archivo} className="h-32 w-full object-cover" /></a>
                                    ) : media.mime_type?.startsWith('video/') || /\.(mp4|webm|mov)(?:\?|$)/i.test(media.archivo_url) ? (
                                      <video src={media.archivo_url} controls className="h-32 w-full bg-black object-contain" />
                                    ) : (
                                      <a href={media.archivo_url} target="_blank" rel="noreferrer" className="flex h-24 items-center justify-center p-3 text-center text-xs font-bold text-blue-600">Abrir archivo</a>
                                    )}
                                    <a href={media.archivo_url} target="_blank" rel="noreferrer" className="block truncate p-2 text-[9px] font-bold text-slate-600 hover:text-blue-600">{media.descripcion || media.nombre_archivo}</a>
                                  </div>
                                ))}
                                {fieldMedia.length === 0 && <span className="col-span-full mt-1 text-sm italic text-slate-400">Sin archivos adjuntos</span>}
                              </div>
                            ) : editingAnswers ? (
                              item.type === 'select' && item.options.length > 0 ? (
                                <select value={String(answerDraft[item.key] ?? '')} onChange={event => {
                                  const option = item.options.find(candidate => String(candidate.value) === event.target.value);
                                  setAnswerDraft(current => ({ ...current, [item.key]: option?.value ?? event.target.value }));
                                }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-slate-500">
                                  <option value="">Seleccionar...</option>
                                  {item.options.map(option => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
                                </select>
                              ) : item.type === 'textarea' ? (
                                <textarea value={String(answerDraft[item.key] ?? '')} onChange={event => setAnswerDraft(current => ({ ...current, [item.key]: event.target.value }))} className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-slate-500" />
                              ) : (
                                <input type={item.type === 'number' ? 'number' : 'text'} value={String(answerDraft[item.key] ?? '')} onChange={event => setAnswerDraft(current => ({ ...current, [item.key]: item.type === 'number' ? Number(event.target.value) : event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-slate-500" />
                              )
                            ) : (
                              <strong className="mt-1 block text-sm leading-relaxed text-slate-800">{item.visible || 'Sin respuesta'}</strong>
                            )}
                          </div>
                        );
                      })}
                      {getDiagnosisItems(selected, flows).length === 0 && <div className="px-5 py-8 text-sm italic text-slate-400">Todavía no hay respuestas guardadas.</div>}
                    </div>
                  </section>
                </main>

                <aside className="space-y-5 lg:col-span-4">
                  <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
                    <h3 className="mb-5 text-xs font-black uppercase tracking-[0.16em] text-slate-700">Seguimiento</h3>
                    <div className="space-y-5 border-l-2 border-slate-100 pl-5">
                      {[
                        ['Estado reparación', selected.estado],
                        ['Estado diagnóstico', selected.estado_diagnostico],
                        ['Diagrama', selected.flow_name],
                        ['Paso actual', getStepTitle(selected, flows)],
                        ['Técnico', selected.tecnico_asignado],
                      ].map(([label, value], index) => (
                        <div key={label} className="relative">
                          <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white ${index < 2 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">{label}</span>
                          <strong className="mt-1 block text-xs capitalize text-slate-800">{displayValue(value).replace(/_/g, ' ')}</strong>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-[0.16em] text-slate-700">Evidencias</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black">{selected.multimedia?.length || 0}</span></div>
                    <div className="grid grid-cols-2 gap-2">
                      {(selected.multimedia || []).map(media => (
                        <a key={String(media.id)} href={media.archivo_url} target="_blank" rel="noreferrer" className="group relative overflow-hidden rounded-xl border border-slate-100 bg-slate-100">
                          {media.mime_type?.startsWith('image/') || /\.(jpe?g|png|gif|webp)(?:\?|$)/i.test(media.archivo_url) ? (
                            <img src={media.archivo_url} className="h-32 w-full object-cover transition group-hover:scale-105" alt={media.descripcion || media.nombre_archivo} />
                          ) : media.mime_type?.startsWith('video/') || /\.(mp4|webm|mov)(?:\?|$)/i.test(media.archivo_url) ? (
                            <video src={media.archivo_url} controls className="h-32 w-full bg-black object-contain" />
                          ) : (
                            <div className="flex h-28 items-center justify-center text-slate-400"><ImageIcon /></div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6 text-[9px] font-bold text-white">{media.descripcion || media.nombre_archivo}</div>
                        </a>
                      ))}
                      {(!selected.multimedia || selected.multimedia.length === 0) && <div className="col-span-2 rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">Sin evidencias cargadas</div>}
                    </div>
                  </section>
                </aside>
              </div>
            </div>
            {agentOpen && (
              <aside className="absolute inset-0 z-30 flex min-h-0 flex-col border-l border-slate-200 bg-white shadow-2xl md:relative md:inset-auto md:w-[410px] md:shrink-0 md:shadow-none">
                <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-violet-100 p-2.5 text-violet-700"><Bot className="h-5 w-5" /></div>
                    <div><h3 className="text-sm font-black text-slate-900">Agente técnico IA</h3><p className="text-[10px] font-semibold text-emerald-600">Contexto completo de la reparación</p></div>
                  </div>
                  <button onClick={() => setAgentOpen(false)} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
                </header>
                <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4">
                  {agentMessages.map((message, index) => (
                    <div key={message.sender + '-' + index} className={'flex ' + (message.sender === 'user' ? 'justify-end' : 'justify-start')}>
                      <div className={'max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ' + (message.sender === 'user' ? 'rounded-br-md bg-slate-950 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-700')}>
                        {message.sender === 'agent' ? (
                          <div className="[&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_strong]:font-black [&_ul]:list-disc [&_ul]:pl-5"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown></div>
                        ) : message.text}
                      </div>
                    </div>
                  ))}
                  {agentLoading && <div className="flex items-center gap-2 text-xs font-semibold text-violet-600"><Loader className="h-4 w-4 animate-spin" /> Analizando la reparación...</div>}
                </div>
                <form onSubmit={sendAgentMessage} className="border-t border-slate-200 bg-white p-4">
                  <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-violet-400">
                    <textarea value={agentInput} onChange={event => setAgentInput(event.target.value)} placeholder="Pregunta cualquier cosa sobre esta reparación..." rows={2} className="max-h-32 min-h-12 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none" />
                    <button type="submit" disabled={!agentInput.trim() || agentLoading} className="rounded-xl bg-violet-600 p-3 text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4" /></button>
                  </div>
                  <p className="mt-2 text-center text-[9px] font-medium text-slate-400">El agente recibe cliente, equipo, diagnóstico, seguimiento y evidencias.</p>
                </form>
              </aside>
            )}
          </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}
