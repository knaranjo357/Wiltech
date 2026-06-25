import { useState, useEffect, useRef } from 'react';
import { flowApi, agenteApi } from '../services/diagnosticadorService';
import type { FlowStepField } from '../types/diagnosticador';
import { ArrowRight, Bot, Cpu, CheckCircle2, RotateCcw, AlertCircle, CheckSquare, Square, Send, Loader, X, Zap } from 'lucide-react';
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

export default function Diagnosticador() {
  const [activeFlow, setActiveFlow] = useState<any | null>(null);
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
  }, []);

  const loadFlow = async () => {
    try {
      const data = await flowApi.getAll();
      if (data && data.length > 0) {
        const flow = data[0];
        setActiveFlow(flow);
        const steps = (flow as any).steps || flow.configuracion?.steps || [];
        if (steps.length > 0) {
          setCurrentStepId(steps[0].id);
          setCurrentFieldIndex(0);
        }
      }
    } catch (error) {
      console.error('Error loading flow:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStep = (id: string | null) => {
    if (!id || !activeFlow) return null;
    const steps = activeFlow.steps || activeFlow.configuracion?.steps || [];
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
      default:
        return <p className="text-red-500 text-xs font-bold uppercase p-4 bg-red-50 rounded-xl">Formato "{field.type}" no soportado todavía.</p>;
    }
  };

  const currentStep = getStep(currentStepId);
  const flowStepsList = activeFlow ? (activeFlow.steps || activeFlow.configuracion?.steps || []) : [];
  const currentStepIndex = currentStepId ? flowStepsList.findIndex((s: any) => s.id === currentStepId) : -1;
  const currentStepFieldsCount = currentStep?.fields?.length || 0;

  if (loading) return <div className="h-screen md:h-[calc(100vh-3.5rem)] flex items-center justify-center font-black text-xl animate-pulse italic">WILTECH...</div>;

  return (
    <div className="h-[calc(100vh-3.5rem)] md:h-screen bg-gray-50 flex flex-col font-sans selection:bg-black selection:text-white overflow-hidden">
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
          <button onClick={() => openModal('¿Reiniciar?', 'Se perderá el progreso del diagnóstico actual.', () => { sessionStorage.removeItem('wiltech_sessionId'); window.location.reload(); })} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl hover:bg-black hover:text-white transition-all shadow-sm shrink-0 cursor-pointer">
            <RotateCcw size={18} />
          </button>
          <div>
            <h1 className="text-base font-black uppercase tracking-tighter italic leading-none text-slate-800">Diagnosticador</h1>
            {activeFlow && currentStepId && currentStep?.type !== 'end' && (
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mt-1">
                Paso {currentStepIndex + 1} de {flowStepsList.length}
                {currentStepFieldsCount > 1 && ` • Pregunta ${currentFieldIndex + 1} de ${currentStepFieldsCount}`}
              </span>
            )}
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
            {!currentStep ? (
              <div className="bg-white p-10 rounded-[2.5rem] shadow-xl max-w-md border border-gray-100 text-center mx-auto">
                <h2 className="text-2xl font-black uppercase italic mb-4 text-slate-800">Paso no encontrado</h2>
                <button
                  onClick={() => {
                    window.history.pushState(null, "", "/diagnosticador-admin");
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  className="inline-block bg-black text-white px-8 py-4 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer"
                >
                  Revisar Administrador
                </button>
              </div>
            ) : currentStep.type === 'end' ? (
              <div className="bg-white rounded-[3rem] p-10 shadow-2xl border border-gray-100 text-center">
                <div className="w-20 h-20 bg-black text-white rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-xl">
                  <CheckCircle2 size={40} />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tighter italic mb-8 text-slate-800">Diagnóstico Listo</h2>
                <div className="bg-gray-50 rounded-3xl p-8 text-left space-y-4 mb-8 border border-gray-100 max-h-[300px] overflow-y-auto">
                  {Object.entries(formData).map(([key, val]) => (
                    <div key={key} className="border-b border-gray-200 pb-3 last:border-0">
                      <span className="block text-[8px] font-black text-gray-300 uppercase tracking-widest mb-1">{key}</span>
                      <span className="text-base font-bold text-gray-900 uppercase italic">
                        {Array.isArray(val) ? val.join(', ') : (val === true ? 'SÍ' : val === false ? 'NO' : String(val))}
                      </span>
                    </div>
                  ))}
                </div>
                <button onClick={() => openModal('Nuevo Diagnóstico', '¿Estás seguro de iniciar un nuevo proceso?', () => { sessionStorage.removeItem('wiltech_sessionId'); window.location.reload(); })} className="w-full bg-black text-white py-6 rounded-2xl font-bold uppercase text-[11px] tracking-widest shadow-xl cursor-pointer">Nuevo Diagnóstico</button>
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
                    <Loader className="animate-spin" size={14} /> Pensando...
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
