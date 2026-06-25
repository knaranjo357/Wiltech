import { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  Handle,
  Position,
  type NodeProps,
  Panel,
  ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { flowApi, agenteApi, equiposSegundaApi } from '../services/diagnosticadorService';
import type { FlowData, FlowStep, EquipoSegunda } from '../types/diagnosticador';
import { ArrowLeft, Trash2, X, PlusCircle, Hash, Type, List, AlertCircle, Bot, Sparkles, ClipboardList, Search, Edit3, Plus, Loader } from 'lucide-react';

// --- Helper to slugify labels ---
const slugify = (text: string) => text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '_').replace(/^-+|-+$/g, '');

// --- Custom Modal Component ---
const CustomModal = ({ isOpen, title, message, onConfirm, onCancel, type = 'confirm', children, size = 'md' }: {
  isOpen: boolean,
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void,
  type?: 'confirm' | 'alert' | 'custom',
  children?: React.ReactNode,
  size?: 'sm' | 'md' | 'lg' | 'xl' | '5xl'
}) => {
  if (!isOpen) return null;

  let widthClass = 'max-w-sm';
  if (type === 'custom') {
    if (size === '5xl') widthClass = 'max-w-5xl';
    else if (size === 'xl') widthClass = 'max-w-4xl';
    else if (size === 'lg') widthClass = 'max-w-2xl';
    else widthClass = 'max-w-md';
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className={`relative w-full ${widthClass} bg-white rounded-[3rem] p-10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] border border-gray-100 animate-in zoom-in-95 duration-200`}>
        <div className="flex flex-col items-center text-center">
          {!children && (
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-6">
              <AlertCircle size={32} className="text-black" />
            </div>
          )}
          <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-2 leading-none text-slate-800">{title}</h3>
          <p className="text-gray-400 font-bold text-xs uppercase tracking-tight mb-8 leading-relaxed">{message}</p>

          {children && <div className="w-full text-left mb-8">{children}</div>}

          <div className="flex gap-3 w-full">
            {type === 'confirm' && (
              <button
                onClick={onCancel}
                className="flex-1 bg-gray-100 text-gray-400 py-4 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-gray-200 transition-all"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={onConfirm}
              className="flex-1 bg-black text-white py-4 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              {type === 'confirm' ? 'Aceptar' : type === 'custom' ? 'Guardar Cambios' : 'Entendido'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Custom Node Component ---
const DiagnosticNode = ({ data, selected, id }: NodeProps) => {
  const step = data.step as FlowStep;
  const onDeleteRequest = data.onDeleteRequest as (id: string) => void;

  return (
    <div className={`min-w-[220px] bg-white border-2 rounded-2xl shadow-xl transition-all ${selected ? 'border-black ring-4 ring-black/5' : 'border-gray-100'}`}>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-8 !h-8 !bg-gray-200 !border-4 !border-white !shadow-lg hover:!scale-125 !transition-all !cursor-crosshair !-left-4"
      />

      <div className="p-3 border-b border-gray-50 flex items-center justify-between bg-gray-50/50 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${step.type === 'form' ? 'bg-blue-400' : 'bg-black'}`} />
          <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest">{step.type === 'form' ? 'Pregunta' : 'Final'}</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDeleteRequest(id); }}
          className="text-gray-300 hover:text-red-500 transition-colors p-1"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="p-4">
        <h3 className="font-bold text-xs mb-3 text-gray-900 uppercase tracking-tight leading-tight truncate">{step.title || 'Nueva Pregunta'}</h3>

        <div className="space-y-2">
          {step.fields?.map((f, i) => (
            <div key={i} className="relative">
              <div className="text-[10px] font-bold text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-100/50 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  {f.type === 'number' ? <Hash size={10} /> : (f.type === 'select' || f.type === 'multi_select') ? <List size={10} /> : <Type size={10} />}
                  <span className="truncate">{f.label || 'Sin etiqueta'}</span>
                </div>

                {(f.type === 'select') && (
                  <div className="space-y-1 mt-1">
                    {f.options?.map((opt, oIdx) => (
                      <div key={oIdx} className="relative flex items-center justify-between py-1.5 px-2 bg-white border border-gray-100 rounded-lg">
                        <span className="text-[9px] font-bold text-gray-400">{"->"} {opt.label}</span>
                        <Handle
                          type="source"
                          position={Position.Right}
                          id={`field-${i}-opt-${oIdx}`}
                          className="!w-8 !h-8 !bg-black !border-4 !border-white !shadow-lg hover:!scale-125 !transition-all !cursor-crosshair !-right-4 z-10"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {(!step.fields || step.fields.length === 0 || !step.fields.some(f => f.type === 'select')) && step.type !== 'end' && (
            <div className="relative pt-1 flex justify-end items-center">
              <Handle
                type="source"
                position={Position.Right}
                className="!w-8 !h-8 !bg-black !border-4 !border-white !shadow-lg hover:!scale-125 !transition-all !cursor-crosshair !-right-4"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const nodeTypes = {
  diagnostic: DiagnosticNode,
};

function AdminInner() {
  const [activeFlow, setActiveFlow] = useState<FlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // --- AI Agent States ---
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [systemMessage, setSystemMessage] = useState('');
  const [rowNumber, setRowNumber] = useState(1);

  // --- Precios Segunda States ---
  const [isPricesModalOpen, setIsPricesModalOpen] = useState(false);
  const [pricesList, setPricesList] = useState<EquipoSegunda[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPricesLoading, setIsPricesLoading] = useState(false);
  const [editingPrice, setEditingPrice] = useState<Partial<EquipoSegunda> | null>(null);

  // --- Diagram Text States ---
  const [isTextDiagramModalOpen, setIsTextDiagramModalOpen] = useState(false);
  const [textDiagramConfig, setTextDiagramConfig] = useState('');

  const loadPrices = async () => {
    setIsPricesLoading(true);
    try {
      const data = await equiposSegundaApi.getAll();
      setPricesList(data || []);
    } catch (error) {
      console.error('Error loading prices:', error);
    } finally {
      setIsPricesLoading(false);
    }
  };

  useEffect(() => {
    if (isPricesModalOpen) {
      loadPrices();
    }
  }, [isPricesModalOpen]);

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrice || !editingPrice.equipo || !editingPrice.modelo || !editingPrice.componente || !editingPrice.precio) {
      openModal('Campos Requeridos', 'Por favor completa todos los campos requeridos.', () => closeModal(), 'alert');
      return;
    }
    try {
      setIsPricesLoading(true);
      if (editingPrice.id) {
        await equiposSegundaApi.update(editingPrice as EquipoSegunda);
        openModal('¡Éxito!', 'El precio se actualizó correctamente.', () => closeModal(), 'alert');
      } else {
        await equiposSegundaApi.create(editingPrice as Omit<EquipoSegunda, 'id' | 'created_at'>);
        openModal('¡Éxito!', 'El precio se registró correctamente.', () => closeModal(), 'alert');
      }
      setEditingPrice(null);
      loadPrices();
    } catch (error) {
      console.error('Error saving price:', error);
      openModal('Error', 'No se pudo guardar el precio.', () => closeModal(), 'alert');
    } finally {
      setIsPricesLoading(false);
    }
  };

  const handleDeletePrice = (id: number) => {
    openModal(
      '¿Eliminar Registro?',
      'Esta acción eliminará el precio de forma permanente de la base de datos.',
      async () => {
        try {
          setIsPricesLoading(true);
          await equiposSegundaApi.delete(id);
          closeModal();
          loadPrices();
          openModal('¡Eliminado!', 'El precio se eliminó correctamente.', () => closeModal(), 'alert');
        } catch (error) {
          console.error('Error deleting price:', error);
          closeModal();
          openModal('Error', 'No se pudo eliminar el precio.', () => closeModal(), 'alert');
        } finally {
          setIsPricesLoading(false);
        }
      }
    );
  };

  // --- Modal States ---
  const [modal, setModal] = useState<{
    isOpen: boolean,
    title: string,
    message: string,
    onConfirm: () => void,
    type: 'confirm' | 'alert' | 'custom'
  }>({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'confirm' });

  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));
  const openModal = (title: string, message: string, onConfirm: () => void, type: 'confirm' | 'alert' | 'custom' = 'confirm') => {
    setModal({ isOpen: true, title, message, onConfirm, type });
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId)?.data.step as FlowStep | undefined;

  useEffect(() => {
    loadFlows();
    loadSystemMessage();
  }, []);

  const loadFlows = async () => {
    try {
      const data = await flowApi.getAll();
      if (data.length > 0) selectFlow(data[0]);
      else setLoading(false);
    } catch (error) {
      setLoading(false);
    }
  };

  const loadSystemMessage = async () => {
    try {
      const data = await agenteApi.getSystemMessage();
      if (data) {
        setSystemMessage(data.system_message);
        setRowNumber(data.row_number);
      }
    } catch (error) {
      console.error('Error loading system message:', error);
    }
  };

  const selectFlow = (flow: FlowData) => {
    setActiveFlow(flow);
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    flow.configuracion.steps.forEach((step, index) => {
      const position = (step as any).position || { x: 100 + index * 320, y: 150 + (index % 2) * 100 };
      newNodes.push({
        id: step.id,
        type: 'diagnostic',
        position: position,
        data: { step: step, onDeleteRequest: handleDeleteRequest },
      });

      if (step.next) {
        newEdges.push({
          id: `e-${step.id}-${step.next}`,
          source: step.id,
          target: step.next,
          animated: true,
          style: { stroke: '#000', strokeWidth: 2 }
        });
      }

      if (step.branches) {
        step.branches.forEach((branch, bIdx) => {
          if (branch.next && step.fields && step.fields.length > 0) {
            const fieldIdx = step.fields.findIndex(f => f.key === branch.match?.[0]?.field);
            const optIdx = step.fields[fieldIdx]?.options?.findIndex(o => o.value === branch.match?.[0]?.value);

            if (fieldIdx !== -1 && optIdx !== -1) {
              newEdges.push({
                id: `e-${step.id}-${branch.next}-${bIdx}`,
                source: step.id,
                sourceHandle: `field-${fieldIdx}-opt-${optIdx}`,
                target: branch.next,
                animated: true,
                style: { stroke: '#000', strokeWidth: 2 },
              });
            }
          }
        });
      }
    });

    setNodes(newNodes);
    setEdges(newEdges);
    setLoading(false);
  };

  const handleDeleteRequest = (id: string) => {
    openModal(
      '¿Eliminar Bloque?',
      'Se borrarán todas las conexiones vinculadas a esta pregunta de forma permanente.',
      () => {
        setNodes(nds => nds.filter(n => n.id !== id));
        setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
        if (selectedNodeId === id) setSelectedNodeId(null);
        closeModal();
      }
    );
  };

  const onConnect = useCallback((params: any) => {
    setEdges((eds) => addEdge({ ...params, animated: true, style: { strokeWidth: 2 } }, eds));
    setNodes(nds => nds.map(n => {
      if (n.id === params.source) {
        const step = { ...(n.data.step as any) };
        if (params.sourceHandle?.startsWith('field-')) {
          const parts = params.sourceHandle.split('-');
          const fIdx = parseInt(parts[1]);
          const oIdx = parseInt(parts[3]);
          const field = step.fields[fIdx];
          const option = field.options[oIdx];

          if (!step.branches) step.branches = [];
          const matchValue = option.value;
          const existingBranchIdx = step.branches.findIndex((b: any) => b.match?.[0]?.value === matchValue);

          if (existingBranchIdx > -1) {
            step.branches[existingBranchIdx].next = params.target;
          } else {
            step.branches.push({
              next: params.target,
              match: [{ field: field.key, op: 'equals', value: matchValue }]
            });
          }
          delete step.next;
        } else {
          step.next = params.target;
        }
        return { ...n, data: { ...n.data, step } };
      }
      return n;
    }));
  }, [setNodes, setEdges]);

  const onEdgeClick = (_: any, edge: Edge) => {
    openModal(
      '¿Eliminar Conexión?',
      'La lógica de salto entre estas dos preguntas será eliminada.',
      () => {
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
        setNodes(nds => nds.map(n => {
          if (n.id === edge.source) {
            const step = { ...(n.data.step as any) };
            if (edge.sourceHandle?.startsWith('field-')) {
              const parts = edge.sourceHandle.split('-');
              const oIdx = parseInt(parts[3]);
              const matchValue = step.fields[parseInt(parts[1])].options[oIdx].value;
              step.branches = step.branches?.filter((b: any) => b.match?.[0]?.value !== matchValue);
            } else {
              delete step.next;
            }
            return { ...n, data: { ...n.data, step } };
          }
          return n;
        }));
        closeModal();
      }
    );
  };

  const onNodeClick = (_: any, node: Node) => setSelectedNodeId(node.id);

  const addNewStep = () => {
    const newId = `q_${Date.now()}`;
    const newNode: Node = {
      id: newId,
      type: 'diagnostic',
      position: { x: 400, y: 300 },
      data: {
        step: { id: newId, type: 'form', title: 'Nueva Pregunta', fields: [{ key: `f_${Date.now()}`, type: 'select', label: '¿Tu pregunta?', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] }] },
        onDeleteRequest: handleDeleteRequest
      }
    };
    setNodes(nds => [...nds, newNode]);
  };

  const updateSelectedNode = (updates: Partial<FlowStep>) => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.map((node) => {
      if (node.id === selectedNodeId) {
        let updatedStep = { ...(node.data.step as any), ...updates };
        if (updates.fields) {
          updatedStep.fields = updatedStep.fields.map((f: any) => ({
            ...f,
            key: f.key || slugify(f.label || 'campo')
          }));
        }
        return { ...node, data: { ...node.data, step: updatedStep } };
      }
      return node;
    }));
  };

  const saveFlow = async () => {
    if (!activeFlow) return;
    setSaving(true);
    try {
      const updatedSteps = nodes.map(n => ({
        ...(n.data.step as any),
        position: n.position
      }));

      let updatedConfig = { ...activeFlow.configuracion, steps: updatedSteps };
      await flowApi.update(activeFlow.id, updatedConfig);
      openModal('¡Publicado!', 'El diagrama y las posiciones se han guardado con éxito.', () => closeModal(), 'alert');
    } catch (error) {
      openModal('Error', 'No se pudieron guardar los cambios.', () => closeModal(), 'alert');
    } finally {
      setSaving(false);
    }
  };

  const openTextDiagramModal = () => {
    if (!activeFlow) return;
    const currentConfig = {
      ...activeFlow.configuracion,
      steps: nodes.map(n => ({
        ...(n.data.step as any),
        position: n.position
      }))
    };
    setTextDiagramConfig(JSON.stringify(currentConfig, null, 2));
    setIsTextDiagramModalOpen(true);
  };

  const handleSaveTextDiagram = () => {
    try {
      const parsedConfig = JSON.parse(textDiagramConfig);
      if (!parsedConfig || typeof parsedConfig !== 'object') {
        throw new Error('Configuración inválida');
      }
      if (!Array.isArray(parsedConfig.steps)) {
        throw new Error('La propiedad "steps" debe ser un arreglo');
      }

      selectFlow({
        ...activeFlow!,
        configuracion: parsedConfig
      });
      setIsTextDiagramModalOpen(false);
      openModal('¡Diagrama Actualizado!', 'El diagrama en formato texto se ha cargado en el editor. Recuerda publicar para guardar los cambios.', () => closeModal(), 'alert');
    } catch (error: any) {
      openModal('Error de Formato', `No se pudo procesar el JSON: ${error.message}`, () => {}, 'alert');
    }
  };

  const handleSaveAgent = async () => {
    try {
      setSaving(true);
      await agenteApi.updateSystemMessage({ row_number: rowNumber, system_message: systemMessage });
      openModal('¡Agente Actualizado!', 'El mensaje del sistema para la IA ha sido guardado.', () => closeModal(), 'alert');
      setIsAgentModalOpen(false);
    } catch (error) {
      openModal('Error', 'No se pudo actualizar el agente.', () => closeModal(), 'alert');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="h-screen md:h-[calc(100vh-3.5rem)] flex items-center justify-center font-black text-2xl italic animate-pulse">WILTECH...</div>;

  return (
    <div className="h-[calc(100vh-3.5rem)] md:h-screen flex flex-col bg-white text-black font-sans">
      {/* Global Modals */}
      <CustomModal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        onConfirm={modal.onConfirm}
        onCancel={closeModal}
        type={modal.type}
      />

      {/* AI Agent Modal */}
      <CustomModal
        isOpen={isAgentModalOpen}
        title="Personalizar Agente IA"
        message="Configura las instrucciones base (Prompt) que guiarán el comportamiento de la inteligencia artificial."
        onConfirm={handleSaveAgent}
        onCancel={() => setIsAgentModalOpen(false)}
        type="custom"
        size="5xl"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">
            <Bot size={14} /> Instrucciones del Sistema (System Prompt)
          </div>
          <textarea
            value={systemMessage}
            onChange={(e) => setSystemMessage(e.target.value)}
            className="w-full h-[500px] p-6 bg-gray-50 border-2 border-transparent rounded-[2rem] focus:bg-white focus:border-black outline-none transition-all font-medium text-sm leading-relaxed text-slate-800"
            placeholder="Escribe aquí las instrucciones para el agente..."
          />
          <div className="text-[10px] text-gray-300 italic px-2">
            * Este mensaje define la personalidad y los conocimientos base del asistente de diagnóstico.
          </div>
        </div>
      </CustomModal>

      {/* Text Diagram Modal */}
      <CustomModal
        isOpen={isTextDiagramModalOpen}
        title="Editar Diagrama (Texto JSON)"
        message="Puedes copiar, pegar o modificar el flujo completo del diagrama en formato JSON."
        onConfirm={handleSaveTextDiagram}
        onCancel={() => setIsTextDiagramModalOpen(false)}
        type="custom"
        size="5xl"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">
            <List size={14} /> Configuración JSON del Diagrama
          </div>
          <textarea
            value={textDiagramConfig}
            onChange={(e) => setTextDiagramConfig(e.target.value)}
            className="w-full h-[500px] p-6 bg-gray-50 border-2 border-transparent rounded-[2rem] focus:bg-white focus:border-black outline-none transition-all font-mono text-xs leading-relaxed text-slate-850"
            placeholder="Pega aquí el JSON del diagrama..."
          />
          <div className="text-[10px] text-gray-300 italic px-2">
            * Asegúrate de mantener la estructura correcta de los campos, ramas (branches) y posiciones de los nodos.
          </div>
        </div>
      </CustomModal>

      {/* Precios de Segunda Modal */}
      {isPricesModalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { if (!isPricesLoading) setIsPricesModalOpen(false); }} />
          <div className="relative w-full max-w-5xl h-[85vh] bg-white rounded-[3rem] p-10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] border border-gray-100 animate-in zoom-in-95 duration-200 flex flex-col">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-black uppercase italic tracking-tighter leading-none flex items-center gap-2 text-slate-800">
                  <ClipboardList size={24} className="text-black" /> Precios Componentes Segunda
                </h3>
                <p className="text-gray-400 font-bold text-xs uppercase tracking-tight mt-1">
                  Administración de precios de referencia para componentes de segunda mano
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsPricesModalOpen(false);
                  setEditingPrice(null);
                }}
                className="w-10 h-10 bg-gray-50 hover:bg-black hover:text-white rounded-xl flex items-center justify-center transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex gap-8 overflow-hidden min-h-0">
              
              {/* Left Column: List and Search */}
              <div className="flex-1 flex flex-col overflow-hidden">
                
                {/* Search and Add controls */}
                <div className="flex gap-3 mb-4">
                  <div className="flex-1 relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                    <input
                      type="text"
                      placeholder="Buscar por equipo, modelo o componente..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-black outline-none transition-all font-bold text-sm text-slate-800"
                    />
                  </div>
                  {!editingPrice && (
                    <button
                      onClick={() => setEditingPrice({ equipo: '', modelo: '', componente: '', precio: '', nota: '' })}
                      className="bg-black text-white px-5 rounded-xl font-bold text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
                    >
                      <Plus size={16} /> Nuevo Registro
                    </button>
                  )}
                </div>

                {/* Table Container */}
                <div className="flex-1 overflow-y-auto border border-gray-100 rounded-2xl">
                  {isPricesLoading && pricesList.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-400 font-bold text-sm uppercase gap-2">
                      <Loader className="animate-spin" size={18} /> Cargando precios...
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                          <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Equipo</th>
                          <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Modelo</th>
                          <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Componente</th>
                          <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Precio</th>
                          <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Nota</th>
                          <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {pricesList
                          .filter(item => {
                            const query = searchQuery.toLowerCase();
                            return (
                              (item.equipo || '').toLowerCase().includes(query) ||
                                (item.modelo || '').toLowerCase().includes(query) ||
                                (item.componente || '').toLowerCase().includes(query) ||
                                (item.nota || '').toLowerCase().includes(query)
                            );
                          })
                          .map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="p-4 font-black text-xs uppercase text-gray-900">{item.equipo}</td>
                              <td className="p-4 font-bold text-xs text-gray-500 uppercase">{item.modelo}</td>
                              <td className="p-4 font-bold text-xs text-gray-500 uppercase">{item.componente}</td>
                              <td className="p-4 font-black text-xs text-black">
                                ${Number(item.precio).toLocaleString('es-CO')}
                              </td>
                              <td className="p-4 text-[10px] text-gray-400 font-bold uppercase truncate max-w-[150px]" title={item.nota || ''}>
                                {item.nota || '-'}
                              </td>
                              <td className="p-4 text-right">
                                <div className="inline-flex gap-2">
                                  <button
                                    onClick={() => setEditingPrice(item)}
                                    className="p-2 bg-gray-50 hover:bg-black hover:text-white rounded-lg transition-all"
                                    title="Editar"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePrice(item.id)}
                                    className="p-2 bg-gray-50 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                                    title="Eliminar"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        {pricesList.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-gray-300 font-bold text-xs uppercase">
                              No hay registros encontrados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Right Column: Add/Edit Form */}
              {editingPrice && (
                <div className="w-[320px] bg-gray-50/50 border border-gray-100 rounded-[2rem] p-6 flex flex-col justify-between animate-in slide-in-from-right-4 duration-200">
                  <form onSubmit={handleSavePrice} className="space-y-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-black text-xs uppercase tracking-widest text-black">
                          {editingPrice.id ? 'Editar Precio' : 'Nuevo Registro'}
                        </h4>
                        <button
                          type="button"
                          onClick={() => setEditingPrice(null)}
                          className="text-[9px] font-bold uppercase text-gray-400 hover:text-black underline"
                        >
                          Cerrar
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Equipo *</label>
                          <input
                            type="text"
                            required
                            placeholder="Ej. IPHONE"
                            value={editingPrice.equipo || ''}
                            onChange={(e) => setEditingPrice(prev => ({ ...prev!, equipo: e.target.value.toUpperCase() }))}
                            className="w-full p-3 bg-white border border-gray-100 rounded-xl font-bold text-xs uppercase outline-none focus:border-black transition-all text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Modelo *</label>
                          <input
                            type="text"
                            required
                            placeholder="Ej. IPHONE 15 PRO MAX"
                            value={editingPrice.modelo || ''}
                            onChange={(e) => setEditingPrice(prev => ({ ...prev!, modelo: e.target.value }))}
                            className="w-full p-3 bg-white border border-gray-100 rounded-xl font-bold text-xs uppercase outline-none focus:border-black transition-all text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Componente *</label>
                          <input
                            type="text"
                            required
                            placeholder="Ej. PANTALLA ORIGINAL"
                            value={editingPrice.componente || ''}
                            onChange={(e) => setEditingPrice(prev => ({ ...prev!, componente: e.target.value }))}
                            className="w-full p-3 bg-white border border-gray-100 rounded-xl font-bold text-xs uppercase outline-none focus:border-black transition-all text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Precio *</label>
                          <input
                            type="number"
                            required
                            placeholder="Ej. 950000"
                            value={editingPrice.precio || ''}
                            onChange={(e) => setEditingPrice(prev => ({ ...prev!, precio: e.target.value }))}
                            className="w-full p-3 bg-white border border-gray-100 rounded-xl font-bold text-xs outline-none focus:border-black transition-all text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Nota (Opcional)</label>
                          <textarea
                            placeholder="Observaciones adicionales..."
                            value={editingPrice.nota || ''}
                            onChange={(e) => setEditingPrice(prev => ({ ...prev!, nota: e.target.value }))}
                            className="w-full p-3 bg-white border border-gray-100 rounded-xl font-bold text-xs outline-none focus:border-black transition-all h-20 resize-none text-slate-800"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingPrice(null)}
                        className="flex-1 bg-white border border-gray-100 text-gray-400 py-3 rounded-xl font-bold uppercase text-[9px] tracking-widest hover:bg-gray-100 transition-all cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isPricesLoading}
                        className="flex-1 bg-black text-white py-3 rounded-xl font-bold uppercase text-[9px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md disabled:opacity-50 cursor-pointer"
                      >
                        {isPricesLoading ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <header className="border-b border-gray-100 p-6 flex justify-between items-center bg-white z-30 shrink-0">
        <div className="flex items-center gap-6">
          <button
            onClick={() => {
              window.history.pushState(null, "", "/diagnosticador");
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl hover:bg-black hover:text-white transition-all shadow-sm cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tighter uppercase italic leading-none text-slate-850">Constructor Wiltech</h1>
            <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mt-1">Diagrama Dinámico</p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={() => setIsPricesModalOpen(true)}
            className="flex items-center gap-2 bg-gray-50 text-black px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-black hover:text-white transition-all shadow-sm border border-gray-100 cursor-pointer"
          >
            <ClipboardList size={16} /> Precios de Segunda
          </button>
          <button
            onClick={() => setIsAgentModalOpen(true)}
            className="flex items-center gap-2 bg-gray-50 text-black px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-black hover:text-white transition-all shadow-sm border border-gray-100 cursor-pointer"
          >
            <Sparkles size={16} /> Configurar Agente
          </button>
          <button
            onClick={openTextDiagramModal}
            className="flex items-center gap-2 bg-gray-50 text-black px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-black hover:text-white transition-all shadow-sm border border-gray-100 cursor-pointer"
          >
            <List size={16} /> Diagrama (Texto)
          </button>
          <button
            onClick={saveFlow}
            disabled={saving}
            className="bg-black text-white px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Publicando...' : 'Publicar'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative bg-white min-w-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background color="#000" gap={30} size={1} style={{ opacity: 0.02 }} />
            <Controls className="bg-white border-none shadow-xl rounded-xl overflow-hidden p-1" />
            <Panel position="top-right" className="bg-white/90 backdrop-blur-xl p-2 rounded-2xl border border-gray-100 shadow-xl m-4 z-10">
              <button onClick={addNewStep} className="flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-gray-800 transition-all shadow-md cursor-pointer">
                <PlusCircle size={16} /> Nuevo Paso
              </button>
            </Panel>
          </ReactFlow>
        </div>

        <div className="w-[420px] border-l border-gray-50 bg-white p-8 overflow-y-auto z-30 shadow-[-20px_0_40px_rgba(0,0,0,0.01)] hidden xl:block">
          {selectedNode ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex justify-between items-end mb-2">
                <h2 className="text-2xl font-black italic tracking-tighter uppercase leading-none text-slate-800">Configurar</h2>
                <div className="text-[9px] font-bold text-gray-200 uppercase tracking-widest">Paso: {selectedNodeId}</div>
              </div>

              <div className="space-y-3">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Título en el Diagrama</label>
                <input
                  type="text"
                  value={selectedNode.title}
                  onChange={(e) => updateSelectedNode({ title: e.target.value })}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-black outline-none transition-all font-bold text-base text-slate-800"
                />
              </div>

              <div className="space-y-6 pt-6 border-t border-gray-50">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-xs uppercase tracking-widest text-slate-800">Contenido del Paso</h3>
                </div>

                <div className="space-y-6">
                  {(selectedNode.fields || []).map((field, fIdx) => (
                    <div key={fIdx} className="p-6 bg-gray-50/50 rounded-3xl border-2 border-gray-50 space-y-6 relative transition-all hover:bg-white hover:border-gray-100">
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="block text-[9px] font-bold text-gray-300 uppercase tracking-widest">Pregunta Visible</label>
                          <textarea
                            value={field.label}
                            rows={2}
                            onChange={(e) => {
                              const newFields = [...(selectedNode.fields || [])];
                              newFields[fIdx] = { ...field, label: e.target.value };
                              updateSelectedNode({ fields: newFields });
                            }}
                            className="w-full bg-transparent font-bold text-base outline-none placeholder:text-gray-200 resize-none text-slate-800"
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          <label className="block text-[9px] font-bold text-gray-300 uppercase tracking-widest">Tipo de Respuesta</label>
                          <select
                            value={field.type}
                            onChange={(e) => {
                              const newFields = [...(selectedNode.fields || [])];
                              newFields[fIdx] = { ...field, type: e.target.value as any };
                              updateSelectedNode({ fields: newFields });
                            }}
                            className="w-full p-3 text-[10px] font-bold border-2 border-white rounded-xl bg-white outline-none uppercase shadow-sm text-slate-800"
                          >
                            <option value="text">Texto</option>
                            <option value="textarea">Texto Largo</option>
                            <option value="number">Numérico</option>
                            <option value="select">Selección Única</option>
                            <option value="multi_select">Selección Múltiple</option>
                          </select>
                        </div>

                        {(field.type === 'select' || field.type === 'multi_select') && (
                          <div className="pt-6 border-t border-white space-y-4">
                            <div className="flex justify-between items-center">
                              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Opciones de Lista</label>
                              <button
                                onClick={() => {
                                  const newFields = [...(selectedNode.fields || [])];
                                  const options = [...(field.options || []), { label: 'Nueva Opción', value: `val_${Date.now()}` }];
                                  newFields[fIdx] = { ...field, options };
                                  updateSelectedNode({ fields: newFields });
                                }}
                                className="text-[9px] font-bold uppercase text-black underline cursor-pointer"
                              >
                                + Opción
                              </button>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              {field.options?.map((opt, oIdx) => (
                                <div key={oIdx} className="flex gap-2 items-center bg-white p-2 rounded-xl border border-white shadow-sm">
                                  <input
                                    type="text"
                                    value={opt.label}
                                    onChange={(e) => {
                                      const newFields = [...(selectedNode.fields || [])];
                                      const options = [...(field.options || [])];
                                      options[oIdx] = { ...opt, label: e.target.value, value: e.target.value.toLowerCase() === 'sí' || e.target.value.toLowerCase() === 'si' ? true : e.target.value.toLowerCase() === 'no' ? false : e.target.value.toLowerCase().replace(/\s+/g, '_') };
                                      newFields[fIdx] = { ...field, options };
                                      updateSelectedNode({ fields: newFields });
                                    }}
                                    className="flex-1 text-xs font-bold outline-none uppercase text-slate-800"
                                  />
                                  <button onClick={() => {
                                    const newFields = [...(selectedNode.fields || [])];
                                    newFields[fIdx] = { ...field, options: field.options?.filter((_, i) => i !== oIdx) };
                                    updateSelectedNode({ fields: newFields });
                                  }}><X size={14} className="text-gray-300 hover:text-red-500" /></button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-10">
              <PlusCircle size={60} strokeWidth={1} />
              <h2 className="text-xl font-black uppercase tracking-[0.4em] mt-6 italic text-slate-800">Wiltech</h2>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DiagnosticadorAdmin() {
  return (
    <ReactFlowProvider>
      <AdminInner />
    </ReactFlowProvider>
  );
}
