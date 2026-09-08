import { RepairLoader } from '../components/RepairLoader';
import { useState, useEffect, useRef } from 'react';
import { flowApi, agenteApi, diagnosticoApi } from '../services/diagnosticadorService';
import type { FlowData, FlowStepField, DiagnosticoMultimedia } from '../types/diagnosticador';
import { ArrowLeft, ArrowRight, Bot, Cpu, CheckCircle2, RotateCcw, AlertCircle, CheckSquare, Square, Send, X, Zap, Upload, Image, Trash2, Pencil, Wrench } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- Custom Modal Component ---
const CustomModal = ({ isOpen, title, message, onConfirm, onCancel, type = 'confirm' }: {
  isOpen: boolean,
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void,
  type?: 'confirm' | 'alert'
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-xs bg-white rounded-[3rem] p-10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] border border-gray-100 animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-6">
            <AlertCircle size={32} className="text-black" />
          </div>
          <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2 leading-none">{title}</h3>
          <p className="text-gray-400 font-bold text-[10px] uppercase tracking-tight mb-8 leading-relaxed">{message}</p>
          <div className="flex gap-3 w-full">
            {type === 'confirm' && (
              <button onClick={onCancel} className="flex-1 bg-gray-100 text-gray-400 py-4 rounded-xl font-bold uppercase text-[9px] tracking-widest hover:bg-gray-200 transition-all">Cancelar</button>
            )}
            <button onClick={onConfirm} className="flex-1 bg-black text-white py-4 rounded-xl font-bold uppercase text-[9px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg">
              {type === 'confirm' ? 'Aceptar' : 'Entendido'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Helper to parse API Chat webhook response ---
const parseChatResponse = (response: any): string => {
  if (!response) return 'No se recibió respuesta del agente.';
  let text = '';
  if (typeof response === 'string') {
    text = response;
  } else if (Array.isArray(response) && response.length > 0) {
    const first = response[0];
    if (first && typeof first === 'object') {
      text = first.respuesta || first.response || first.output || first.text || JSON.stringify(first);
    } else {
      text = String(first);
    }
  } else if (typeof response === 'object') {
    text = response.respuesta || response.response || response.output || response.text || JSON.stringify(response);
  } else {
    text = String(response);
  }

  // Reemplazar secuencias literales de \n por saltos de línea reales
  return text.replace(/\\n/g, '\n');
};

type DiagnosticadorProps = {
  embedded?: boolean;
  processType?: 'diagnostico' | 'reparacion';
  initialRepairId?: string | number;
  onExit?: () => void;
  onSwitchProcess?: (type: 'diagnostico' | 'reparacion') => void;
  onRepairLinked?: (id: string) => void;
};

export default function Diagnosticador({ embedded = false, processType = 'diagnostico', initialRepairId, onExit, onSwitchProcess, onRepairLinked }: DiagnosticadorProps) {
  const params = new URLSearchParams(window.location.search);
  const targetFlowName = processType;
  const processLabel = processType === 'reparacion' ? 'reparación' : 'diagnóstico';
  const [flows, setFlows] = useState<FlowData[]>([]);
  const [activeFlow, setActiveFlow] = useState<FlowData | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState('');
  const [repairId, setRepairId] = useState(String(initialRepairId ?? params.get('id_reparacion') ?? ''));
  const [diagnosticId, setDiagnosticId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [mediaByField, setMediaByField] = useState<Record<string, DiagnosticoMultimedia[]>>({});
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [currentFieldIndex, setCurrentFieldIndex] = useState<number>(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<Array<{ stepId: string, fieldIndex: number }>>([]);

  // --- Chat States ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'agent', text: string }>>([
    { sender: 'agent', text: '¡Hola! Soy tu asistente de diagnóstico Wiltech. ¿En qué te puedo colaborar el día de hoy?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isQuickMsgsOpen, setIsQuickMsgsOpen] = useState(false);

  // --- Quick Messages ---
  const QUICK_MESSAGES = [
    { category: '💰 Cotización', messages: [
      '¿En cuánto mínimo se puede dejar esta reparación?',
      '¿Cuál es el precio sugerido para el cliente?',
      '¿Hay opción de segunda mano más económica?',
      'Dame las dos opciones: nueva y segunda',
      '¿Qué descuento aplica por multi-reparación?',
    ]},
    { category: '🔧 Diagnóstico', messages: [
      '¿Qué recomiendas hacer en este caso?',
      '¿Qué prueba debo hacer primero?',
      '¿Es viable reparar o mejor cambiar el módulo completo?',
      '¿Qué componente puede estar fallando?',
      'Tengo un corto, ¿por dónde empiezo?',
    ]},
    { category: '⚠️ Alertas', messages: [
      '¿Qué riesgos tiene este equipo manipulado?',
      '¿Puedo ofrecer cristal si la pantalla tiene líneas?',
      '¿Debo cobrar diagnóstico en este caso?',
      'El equipo está mojado, ¿qué procede?',
    ]},
    { category: '📋 Cierre', messages: [
      'Resume la cotización final para el cliente',
      '¿Qué le digo al cliente si pide rebaja?',
      '¿Cuánto tiempo toma esta reparación aprox?',
    ]},
  ];

  // Initialize Session ID
  useEffect(() => {
    let sId = sessionStorage.getItem('wiltech_sessionId');
    if (!sId) {
      sId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      sessionStorage.setItem('wiltech_sessionId', sId);
    }
    setSessionId(sId);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatOpen]);

  const getReadableContext = () => {
    const readable: Record<string, any> = {};
    if (!activeFlow) return formData;

    const steps = (activeFlow as any).steps || activeFlow.configuracion?.steps || [];

    Object.entries(formData).forEach(([key, val]) => {
      let foundField: any = null;

      for (const step of steps) {
        if (step.fields) {
          const field = step.fields.find((f: any) => f.key === key);
          if (field) {
            foundField = field;
            break;
          }
        }
      }

      if (foundField) {
        const questionText = foundField.label || key;
        let answerText = val;

        if (foundField.type === 'select' || foundField.type === 'multi_select') {
          if (Array.isArray(val)) {
            answerText = val.map(v => {
              const opt = foundField.options?.find((o: any) => o.value === v);
              return opt ? opt.label : v;
            }).join(', ');
          } else {
            const opt = foundField.options?.find((o: any) => o.value === val || (val === true && o.value === 'true') || (val === false && o.value === 'false'));
            if (opt) {
              answerText = opt.label;
            } else if (val === true) {
              answerText = 'Sí';
            } else if (val === false) {
              answerText = 'No';
            }
          }
        } else if (val === true) {
          answerText = 'Sí';
        } else if (val === false) {
          answerText = 'No';
        }

        readable[questionText] = answerText;
      } else {
        readable[key] = val === true ? 'Sí' : val === false ? 'No' : val;
      }
    });

    return readable;
  };

  const getFieldMeta = (key: string) => {
    for (const step of getFlowSteps(activeFlow)) {
      const field = step.fields?.find((item: FlowStepField) => item.key === key);
      if (field) return { field, stepId: step.id };
    }
    return null;
  };

  const getVisibleAnswer = (field: FlowStepField | undefined, value: any) => {
    if (field?.type === 'multimedia') {
      const count = Array.isArray(value) ? value.length : 0;
      return `${count} archivo${count === 1 ? '' : 's'} adjunto${count === 1 ? '' : 's'}`;
    }
    if (field?.type === 'select' || field?.type === 'multi_select') {
      const values = Array.isArray(value) ? value : [value];
      return values.map(item => field.options?.find(option => option.value === item)?.label ?? item).join(', ');
    }
    if (value === true || value === 'true') return 'Sí';
    if (value === false || value === 'false') return 'No';
    if (Array.isArray(value)) return value.join(', ');
    return value ?? '';
  };

  const getDetailedResponses = (data: Record<string, any>) =>
    Object.fromEntries(Object.entries(data).map(([key, value]) => {
      const meta = getFieldMeta(key);
      return [key, {
        pregunta: meta?.field.label || key,
        respuesta: getVisibleAnswer(meta?.field, value),
        valor: value,
        tipo: meta?.field.type || typeof value,
        step_id: meta?.stepId || null,
      }];
    }));

  const unpackStoredResponses = (stored: Record<string, any>) =>
    Object.fromEntries(Object.entries(stored).map(([key, value]) => [
      key,
      value && typeof value === 'object' && !Array.isArray(value) && 'valor' in value ? value.valor : value,
    ]));

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setIsChatLoading(true);

    try {
      const historyPayload = chatMessages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));

      const response = await agenteApi.chat({
        mensaje: userMsg,
        sessionId,
        historial: historyPayload,
        informacion_contexto: getReadableContext()
      });

      const reply = parseChatResponse(response);
      setChatMessages(prev => [...prev, { sender: 'agent', text: reply }]);
    } catch (error) {
      console.error('Error in agent chat:', error);
      setChatMessages(prev => [...prev, { sender: 'agent', text: 'Lo siento, he tenido un problema de conexión. ¿Puedes intentar de nuevo?' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleQuickMessage = async (msg: string) => {
    if (isChatLoading) return;
    setIsQuickMsgsOpen(false);
    setChatMessages(prev => [...prev, { sender: 'user', text: msg }]);
    setIsChatLoading(true);

    try {
      const historyPayload = chatMessages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

      const response = await agenteApi.chat({
        mensaje: msg,
        sessionId,
        historial: historyPayload,
        informacion_contexto: getReadableContext()
      });

      const reply = parseChatResponse(response);
      setChatMessages(prev => [...prev, { sender: 'agent', text: reply }]);
    } catch (error) {
      console.error('Error in agent chat:', error);
      setChatMessages(prev => [...prev, { sender: 'agent', text: 'Lo siento, he tenido un problema de conexión. ¿Puedes intentar de nuevo?' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // --- Modal States ---
  const [modal, setModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, type: 'confirm' | 'alert' }>({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'confirm' });
  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));
  const openModal = (title: string, message: string, onConfirm: () => void, type: 'confirm' | 'alert' = 'confirm') => setModal({ isOpen: true, title, message, onConfirm, type });

  useEffect(() => {
    loadFlow();
  }, [targetFlowName]);

  const loadFlow = async () => {
    try {
      const data = await flowApi.getAll();
      const availableFlows = data || [];
      setFlows(availableFlows);
      const targetFlow = availableFlows.find(flow => flow.flow_name === targetFlowName);
      setSelectedFlowId(targetFlow ? String(targetFlow.id) : '');
    } catch (error) {
      console.error('Error loading flow:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFlowSteps = (flow: FlowData | null) =>
    ((flow as any)?.steps || flow?.configuracion?.steps || []);

  const startDiagnostic = async () => {
    const flow = flows.find(item => String(item.id) === selectedFlowId);
    const parsedRepairId = repairId.trim() ? Number(repairId) : undefined;
    if (!flow || (parsedRepairId !== undefined && (!Number.isInteger(parsedRepairId) || parsedRepairId <= 0))) {
      openModal('Datos incompletos', 'Selecciona un diagrama. Si escribes un ID, debe ser una reparación válida.', closeModal, 'alert');
      return;
    }

    setStarting(true);
    try {
      const diagnostic = await diagnosticoApi.create({
        id_reparacion: parsedRepairId,
        id_diagrama: flow.id,
        flow_name: flow.flow_name || flow.configuracion.name,
      });
      const steps = getFlowSteps(flow);
      setDiagnosticId(diagnostic.id);
      const linkedRepairId = String(diagnostic.id_reparacion);
      setRepairId(linkedRepairId);
      onRepairLinked?.(linkedRepairId);
      setActiveFlow(flow);
      setFormData(unpackStoredResponses((diagnostic.respuestas || {}) as Record<string, any>));
      setMediaByField((diagnostic.multimedia || []).reduce<Record<string, DiagnosticoMultimedia[]>>((grouped, media) => {
        if (!grouped[media.field_key]) grouped[media.field_key] = [];
        grouped[media.field_key].push(media);
        return grouped;
      }, {}));
      setCurrentStepId(diagnostic.paso_actual || flow.configuracion.start_step || steps[0]?.id || null);
      setCurrentFieldIndex(0);
      setHistory([]);
    } catch (error) {
      console.error('Error starting diagnostic:', error);
      const message = error instanceof Error ? error.message : 'Error desconocido';
      openModal('No se pudo iniciar', `${message}. Verifica los endpoints POST y PUT /reparaciones en n8n.`, closeModal, 'alert');
    } finally {
      setStarting(false);
    }
  };

  const getStep = (id: string | null) => {
    if (!id || !activeFlow) return null;
    const steps = (activeFlow as any).steps || activeFlow.configuracion?.steps || [];
    return steps.find((s: any) => s.id === id);
  };

  const handleNext = (overriddenFormData?: Record<string, any>) => {
    if (!currentStepId) return;
    const step = getStep(currentStepId);
    if (!step) return;

    const dataToUse = overriddenFormData || formData;

    // Si quedan más campos en el paso actual, avanzamos el índice del campo
    if (step.fields && currentFieldIndex < step.fields.length - 1) {
      setHistory(prev => [...prev, { stepId: currentStepId, fieldIndex: currentFieldIndex }]);
      setCurrentFieldIndex(prev => prev + 1);
      return;
    }

    // De lo contrario, avanzamos al siguiente paso en la lógica de bifurcación
    setHistory(prev => [...prev, { stepId: currentStepId, fieldIndex: currentFieldIndex }]);

    if (step.branches && step.branches.length > 0) {
      for (const branch of step.branches) {
        const isMatch = branch.match.every((cond: any) => {
          const val = dataToUse[cond.field];
          const nVal = (val === 'true' || val === true) ? true : (val === 'false' || val === false) ? false : val;
          const nCond = (cond.value === 'true' || cond.value === true) ? true : (cond.value === 'false' || cond.value === false) ? false : cond.value;
          return nVal === nCond;
        });
        if (isMatch && branch.next) {
          setCurrentStepId(branch.next);
          setCurrentFieldIndex(0);
          return;
        }
      }
    }
    if (step.next) {
      setCurrentStepId(step.next);
      setCurrentFieldIndex(0);
    }
  };

  const handleBack = () => {
    if (history.length === 0) return;
    const prevHistory = [...history];
    const last = prevHistory.pop();
    setHistory(prevHistory);
    if (last) {
      setCurrentStepId(last.stepId);
      setCurrentFieldIndex(last.fieldIndex);
    }
  };

  const handleChange = (field: FlowStepField, val: any) => {
    if (field.type === 'multi_select') {
      const currentVals = formData[field.key] || [];
      const newVals = currentVals.includes(val)
        ? currentVals.filter((v: any) => v !== val)
        : [...currentVals, val];
      setFormData(prev => ({ ...prev, [field.key]: newVals }));
    } else {
      const newFormData = { ...formData, [field.key]: val };
      setFormData(newFormData);
      if (field.type === 'select') {
        setTimeout(() => handleNext(newFormData), 300);
      }
    }
  };

  useEffect(() => {
    if (!diagnosticId || !activeFlow) return;
    setSaveState('saving');
    const timer = window.setTimeout(async () => {
      try {
        await diagnosticoApi.update({
          id: diagnosticId,
          respuestas: getDetailedResponses(formData),
          paso_actual: currentStepId,
          estado: getStep(currentStepId)?.type === 'end' ? 'completado' : 'en_progreso',
        });
        setSaveState('saved');
      } catch (error) {
        console.error('Error saving diagnostic:', error);
        setSaveState('error');
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [formData, currentStepId, diagnosticId, activeFlow]);

  const handleMediaUpload = async (field: FlowStepField, files: FileList | null) => {
    if (!files?.length || !diagnosticId) return;
    setUploadingField(field.key);
    try {
      const added: DiagnosticoMultimedia[] = [];
      for (const [index, file] of Array.from(files).entries()) {
        const uploaded: any = await diagnosticoApi.upload(file, `diagnostico_${diagnosticId}_${field.key}`);
        const archivoUrl = uploaded?.imagen_url || uploaded?.[0]?.imagen_url;
        if (!archivoUrl) throw new Error('El webhook no devolvió imagen_url');
        added.push({
          id: Date.now() + index,
          id_diagnostico: diagnosticId,
          field_key: field.key,
          archivo_url: archivoUrl,
          nombre_archivo: file.name,
          mime_type: file.type,
          descripcion: '',
          created_at: new Date().toISOString(),
        });
      }
      const nextState = { ...mediaByField, [field.key]: [...(mediaByField[field.key] || []), ...added] };
      await diagnosticoApi.saveMedia(diagnosticId, Object.values(nextState).flat());
      setMediaByField(nextState);
      setFormData(data => ({ ...data, [field.key]: nextState[field.key].map(item => item.archivo_url) }));
    } catch (error) {
      console.error('Error uploading media:', error);
      openModal('No se pudo subir', 'Revisa upload_file y el PUT /reparaciones.', closeModal, 'alert');
    } finally {
      setUploadingField(null);
    }
  };

  const handleMediaDelete = async (fieldKey: string, media: DiagnosticoMultimedia) => {
    try {
      if (!diagnosticId) return;
      const next = (mediaByField[fieldKey] || []).filter(item => item.id !== media.id);
      const nextState = { ...mediaByField, [fieldKey]: next };
      await diagnosticoApi.saveMedia(diagnosticId, Object.values(nextState).flat());
      setMediaByField(nextState);
      setFormData(data => ({ ...data, [fieldKey]: next.map(item => item.archivo_url) }));
    } catch (error) {
      console.error('Error deleting media:', error);
      openModal('No se pudo eliminar', 'El archivo no pudo eliminarse de la reparación.', closeModal, 'alert');
    }
  };

  const handleMediaEdit = async (fieldKey: string, media: DiagnosticoMultimedia) => {
    const descripcion = window.prompt('Descripción del archivo', media.descripcion || '');
    if (descripcion === null) return;
    try {
      if (!diagnosticId) return;
      const next = (mediaByField[fieldKey] || []).map(item => item.id === media.id ? { ...item, descripcion } : item);
      const nextState = { ...mediaByField, [fieldKey]: next };
      await diagnosticoApi.saveMedia(diagnosticId, Object.values(nextState).flat());
      setMediaByField(nextState);
    } catch (error) {
      console.error('Error editing media:', error);
      openModal('No se pudo editar', 'No se guardó la descripción del archivo.', closeModal, 'alert');
    }
  };

  const renderField = (field: FlowStepField) => {
    const value = formData[field.key];
    switch (field.type) {
      case 'text':
      case 'number':
        return (
          <input
            type={field.type}
            value={value || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value }))}
            placeholder={field.placeholder || 'Escribe aquí...'}
            className="w-full p-5 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-black outline-none transition-all font-bold text-base shadow-inner text-slate-800"
          />
        );
      case 'textarea':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
            placeholder={field.placeholder || 'Detalla tus observaciones...'}
            rows={4}
            className="w-full p-5 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-black outline-none transition-all font-bold text-base shadow-inner resize-none text-slate-800"
          />
        );
      case 'select':
      case 'multi_select':
        const isMulti = field.type === 'multi_select';
        return (
          <div className="grid grid-cols-1 gap-3">
            {field.options?.map((opt, i) => {
              const isSelected = isMulti
                ? (value || []).includes(opt.value)
                : ((value === opt.value) || (value === 'true' && opt.value === true) || (value === 'false' && opt.value === false));

              return (
                <button
                  key={i}
                  onClick={() => handleChange(field, opt.value)}
                  className={`p-5 rounded-2xl border-2 transition-all text-left flex items-center justify-between group ${isSelected ? 'bg-black text-white border-black shadow-xl' : 'bg-white text-gray-500 border-gray-100 hover:border-black hover:text-black shadow-sm'
                    }`}
                >
                  <span className="font-bold text-sm uppercase tracking-tight">{opt.label}</span>
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${isSelected ? 'border-white bg-white text-black' : 'border-gray-100 group-hover:border-black'}`}>
                    {isSelected ? (isMulti ? <CheckSquare size={14} /> : <div className="w-2 h-2 bg-black rounded-full" />) : (isMulti ? <Square size={14} className="opacity-20" /> : null)}
                  </div>
                </button>
              );
            })}
          </div>
        );
      case 'multimedia': {
        const items = mediaByField[field.key] || [];
        return (
          <div className="space-y-4">
            <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-6 font-bold text-gray-500 transition hover:border-black hover:text-black">
              {uploadingField === field.key ? <RepairLoader variant="icon" /> : <Upload size={20} />}
              <span className="text-xs uppercase tracking-widest">
                {uploadingField === field.key ? 'Subiendo...' : 'Subir fotos, video o audio'}
              </span>
              <input
                type="file"
                multiple
                accept="image/*,video/*,audio/*"
                className="hidden"
                disabled={uploadingField === field.key || !diagnosticId}
                onChange={(event) => {
                  void handleMediaUpload(field, event.target.files);
                  event.currentTarget.value = '';
                }}
              />
            </label>
            {items.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {items.map(media => (
                  <div key={media.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                    {media.mime_type?.startsWith('image/') ? (
                      <img src={media.archivo_url} alt={media.descripcion || media.nombre_archivo} className="h-36 w-full object-cover" />
                    ) : (
                      <div className="flex h-36 items-center justify-center bg-gray-50 text-gray-300"><Image size={36} /></div>
                    )}
                    <div className="p-3">
                      <p className="truncate text-[10px] font-black uppercase text-gray-700">{media.nombre_archivo}</p>
                      {media.descripcion && <p className="mt-1 text-[10px] text-gray-400">{media.descripcion}</p>}
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => void handleMediaEdit(field.key, media)} className="flex-1 rounded-lg bg-gray-50 py-2 text-[9px] font-bold uppercase"><Pencil size={12} className="mx-auto" /></button>
                        <button type="button" onClick={() => void handleMediaDelete(field.key, media)} className="flex-1 rounded-lg bg-red-50 py-2 text-red-500"><Trash2 size={12} className="mx-auto" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }
      default:
        return <p className="text-red-500 text-xs font-bold uppercase p-4 bg-red-50 rounded-xl">Formato "{field.type}" no soportado todavía.</p>;
    }
  };

  const resetProcess = () => {
    sessionStorage.removeItem('wiltech_sessionId');
    setActiveFlow(null);
    setDiagnosticId(null);
    setCurrentStepId(null);
    setCurrentFieldIndex(0);
    setFormData({});
    setMediaByField({});
    setHistory([]);
    setSaveState('idle');
  };

  const currentStep = getStep(currentStepId);
  const flowStepsList = getFlowSteps(activeFlow);
  const currentStepIndex = currentStepId ? flowStepsList.findIndex((s: any) => s.id === currentStepId) : -1;
  const currentStepFieldsCount = currentStep?.fields?.length || 0;

  if (loading) return <div className="h-[calc(100dvh-4rem)] md:h-[100dvh] flex items-center justify-center font-black text-xl animate-pulse italic">WILTECH...</div>;

  return (
    <div className={(embedded ? "h-full min-h-0" : "h-[calc(100dvh-4rem)] md:h-[100dvh]") + " bg-gray-50 flex flex-col font-sans selection:bg-black selection:text-white overflow-hidden"}>
      <CustomModal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        onConfirm={modal.onConfirm}
        onCancel={closeModal}
        type={modal.type}
      />

      <nav className="p-6 flex justify-between items-center bg-white border-b border-gray-100 shrink-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          {embedded && onExit && (
            <button onClick={onExit} title="Volver a reparaciones" className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl hover:bg-black hover:text-white transition-all shadow-sm shrink-0">
              <ArrowLeft size={18} />
            </button>
          )}
          <button onClick={() => openModal('¿Reiniciar?', 'Se perderá el progreso del proceso actual.', resetProcess)} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl hover:bg-black hover:text-white transition-all shadow-sm shrink-0 cursor-pointer">
            <RotateCcw size={18} />
          </button>
          <div>
            <h1 className="wt-page-title">{processType === "reparacion" ? "Proceso de reparación" : "Diagnosticador"}</h1>
            {activeFlow && currentStepId && currentStep?.type !== 'end' && (
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mt-1">
                Paso {currentStepIndex + 1} de {flowStepsList.length}
                {currentStepFieldsCount > 1 && ` • Pregunta ${currentFieldIndex + 1} de ${currentStepFieldsCount}`}
              </span>
            )}
            {diagnosticId && <span className="mt-1 block text-[8px] font-bold uppercase text-gray-300">Rep. #{repairId} · {saveState === 'saving' ? 'Guardando' : saveState === 'error' ? 'Error al guardar' : 'Guardado'}</span>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Botones de navegación duplicados en la parte superior derecha fija */}
          {history.length > 0 && currentStep && currentStep.type !== 'end' && (
            <button
              onClick={handleBack}
              className="bg-gray-50 text-gray-500 px-4 py-2.5 rounded-xl font-bold uppercase text-[9px] tracking-widest hover:bg-black hover:text-white border border-gray-100 transition-all shadow-sm cursor-pointer"
            >
              Atrás
            </button>
          )}

          {currentStep && currentStep.type !== 'end' && (
            <button
              onClick={() => handleNext()}
              className="bg-black text-white px-5 py-2.5 rounded-xl font-bold uppercase text-[9px] tracking-widest hover:bg-slate-800 transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              Continuar <ArrowRight size={14} />
            </button>
          )}

          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all cursor-pointer ${
              isChatOpen ? 'bg-black text-white scale-110' : 'bg-gray-100 text-black hover:bg-black hover:text-white'
            }`}
            title="Consultar Agente Wiltech"
          >
            <Bot size={20} className={isChatLoading ? 'animate-pulse' : ''} />
          </button>
        </div>
      </nav>

      <main className="flex-1 flex overflow-hidden relative">
        {/* Form Container */}
        <div className="flex-1 overflow-y-auto flex justify-center px-6 py-12 min-w-0">
          <div className="w-full max-w-xl my-auto">
            {!activeFlow ? (
              <div className="bg-white p-10 rounded-[2.5rem] shadow-xl max-w-md border border-gray-100 text-center mx-auto">
                <h2 className="text-2xl font-black uppercase italic mb-2 text-slate-800">Iniciar {processLabel}</h2>
                <p className="mb-6 text-xs font-bold text-gray-400">Asocia el proceso a una orden. El diagrama correspondiente ya está definido.</p>
                <div className="space-y-4 text-left">
                  <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400">ID reparación existente (opcional)</label>
                  <input type="number" min="1" value={repairId} onChange={event => setRepairId(event.target.value)} placeholder="Vacío = crear ingreso automático" className="w-full rounded-2xl border-2 border-gray-100 p-4 font-bold outline-none focus:border-black" />
                  <p className="text-[10px] font-semibold text-gray-400">Desde CRM llegará automáticamente. Si entras directo, déjalo vacío.</p>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Proceso seleccionado</span>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="rounded-xl bg-slate-950 p-2 text-white">{processType === 'reparacion' ? <Wrench size={16} /> : <CheckCircle2 size={16} />}</div>
                      <div><strong className="block text-sm capitalize text-slate-900">{processLabel}</strong><span className="text-[10px] font-semibold text-slate-400">{selectedFlowId ? `Diagrama #${selectedFlowId}` : 'Diagrama del país'}</span></div>
                    </div>
                  </div>
                  {!selectedFlowId && <p className="text-xs font-bold text-amber-600">No se encontró el diagrama de {processLabel} para este país. Publícalo desde AI Diagnosticador.</p>}
                  <button type="button" onClick={() => void startDiagnostic()} disabled={starting || !selectedFlowId} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-black py-5 text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-40">
                    {starting ? <RepairLoader variant="icon" /> : <ArrowRight size={16} />}
                    {starting ? 'Creando ingreso...' : 'Comenzar ' + processLabel}
                  </button>
                </div>
              </div>
            ) : !currentStep ? (
              <div className="rounded-[2.5rem] bg-white p-10 text-center shadow-xl">
                <h2 className="text-xl font-black uppercase">Paso no encontrado</h2>
                <p className="mt-2 text-xs font-bold text-gray-400">Revisa el start_step y las conexiones del diagrama.</p>
              </div>
            ) : currentStep.type === 'end' ? (
              <div className="bg-white rounded-[3rem] p-10 shadow-2xl border border-gray-100 text-center">
                <div className="w-20 h-20 bg-black text-white rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-xl">
                  <CheckCircle2 size={40} />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tighter italic mb-8 text-slate-800">Diagnóstico Listo</h2>
                <div className="bg-gray-50 rounded-3xl p-8 text-left space-y-4 mb-8 border border-gray-100 max-h-[300px] overflow-y-auto">
                  {Object.entries(getDetailedResponses(formData)).map(([key, detail]: [string, any]) => (
                    <div key={key} className="border-b border-gray-200 pb-4 last:border-0">
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-gray-400">{detail.pregunta}</span>
                      {detail.tipo === 'multimedia' ? (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          {(mediaByField[key] || []).map(media => (
                            <a key={String(media.id)} href={media.archivo_url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                              {media.mime_type?.startsWith('image/') ? (
                                <img src={media.archivo_url} alt={media.descripcion || media.nombre_archivo} className="h-32 w-full object-cover" />
                              ) : media.mime_type?.startsWith('video/') ? (
                                <video src={media.archivo_url} controls className="h-32 w-full bg-black object-contain" />
                              ) : (
                                <div className="flex h-24 items-center justify-center p-3 text-center text-xs font-bold text-slate-500">{media.nombre_archivo}</div>
                              )}
                              <p className="truncate p-2 text-[9px] font-bold text-slate-600">{media.descripcion || media.nombre_archivo}</p>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-base font-bold text-gray-900">{String(detail.respuesta || 'Sin respuesta')}</span>
                      )}
                    </div>
                  ))}
                </div>
                {processType === 'diagnostico' && onSwitchProcess && (
                  <button onClick={() => onSwitchProcess('reparacion')} className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg">
                    <Wrench size={16} /> Continuar con la reparación
                  </button>
                )}
                <button onClick={() => openModal('Nuevo proceso', '¿Estás seguro de iniciar un nuevo proceso?', resetProcess)} className="w-full bg-black text-white py-6 rounded-2xl font-bold uppercase text-[11px] tracking-widest shadow-xl cursor-pointer">Nuevo proceso</button>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-350">
                <div className="bg-white rounded-[3rem] p-10 shadow-2xl border border-gray-100 relative">
                  <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none"><Cpu size={80} strokeWidth={1} /></div>
                  <div className="relative z-10">
                    <h2 className="text-xl font-black uppercase tracking-tighter italic mb-8 leading-tight text-slate-800">{currentStep.title}</h2>

                    <div className="space-y-6">
                      {currentStep.fields && currentStep.fields[currentFieldIndex] && (
                        <div className="space-y-4">
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] px-2">
                            {currentStep.fields[currentFieldIndex].label}
                          </label>
                          {renderField(currentStep.fields[currentFieldIndex])}
                        </div>
                      )}
                    </div>

                    <div className="mt-12 flex gap-3">
                      {history.length > 0 && (
                        <button onClick={handleBack} className="flex-1 bg-gray-50 text-gray-400 py-4 rounded-xl font-bold uppercase text-[9px] tracking-widest hover:bg-black hover:text-white transition-all shadow-sm cursor-pointer">
                          Atrás
                        </button>
                      )}
                      {currentStep.type !== 'end' && (
                        <button onClick={() => handleNext()} className="flex-[2] flex items-center justify-center gap-3 bg-black text-white py-4 rounded-xl font-bold uppercase text-[9px] tracking-widest shadow-lg cursor-pointer">
                          Continuar <ArrowRight size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat Drawer Side Panel */}
        {isChatOpen && (
          <div className="absolute inset-y-0 right-0 w-full sm:relative sm:w-[420px] bg-white border-l border-gray-100 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 z-40">
            {/* Chat Header */}
            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-black text-white p-2 rounded-xl">
                  <Bot size={18} />
                </div>
                <div>
                  <h3 className="font-black text-[11px] uppercase tracking-widest text-black">Asistente IA</h3>
                  <span className="text-[8px] font-bold text-gray-300 uppercase tracking-widest">En Línea</span>
                </div>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="w-8 h-8 bg-gray-50 hover:bg-black hover:text-white rounded-lg flex items-center justify-center transition-all cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Chat Message List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-[11px] font-bold leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-black text-white rounded-tr-none'
                      : 'bg-white text-gray-700 border border-gray-100 rounded-tl-none shadow-sm'
                  }`}>
                    {msg.sender === 'user' ? (
                      <span className="whitespace-pre-line">{msg.text}</span>
                    ) : (
                      <div className="space-y-1.5 whitespace-pre-wrap [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:leading-relaxed [&_strong]:font-black [&_strong]:text-slate-900">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white text-gray-400 border border-gray-100 p-4 rounded-2xl rounded-tl-none text-[11px] font-bold flex items-center gap-2 shadow-sm">
                    <RepairLoader variant="icon" /> Pensando...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Messages Panel */}
            {isQuickMsgsOpen && (
              <div className="max-h-[240px] overflow-y-auto border-t border-gray-100 bg-gray-50/80 p-4 space-y-3 animate-in slide-in-from-bottom duration-200">
                {QUICK_MESSAGES.map((cat, ci) => (
                  <div key={ci}>
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">{cat.category}</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {cat.messages.map((msg, mi) => (
                        <button
                          key={mi}
                          onClick={() => handleQuickMessage(msg)}
                          disabled={isChatLoading}
                          className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-[10px] font-bold text-gray-600 hover:bg-black hover:text-white hover:border-black transition-all active:scale-95 disabled:opacity-40"
                        >
                          {msg}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Chat Input Bar */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-100 bg-white">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickMsgsOpen(prev => !prev)}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-sm border ${isQuickMsgsOpen ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-black hover:text-white hover:border-black'}`}
                  title="Mensajes rápidos"
                >
                  <Zap size={16} />
                </button>
                <input
                  type="text"
                  placeholder="Escribe tu consulta aquí..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-black outline-none transition-all font-bold text-[11px] text-slate-800"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isChatLoading}
                  className="w-11 h-11 bg-black text-white rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md disabled:opacity-30"
                >
                  <Send size={16} />
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
