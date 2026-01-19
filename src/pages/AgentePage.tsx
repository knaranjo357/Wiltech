// pages/AgentePage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Save, RefreshCw, Plus, Trash2, 
  ChevronRight, Edit3, Eye, Bot, Sparkles, Command
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AgenteService } from '../services/agenteService';

// Definimos el origen fijo según tu requerimiento
const TARGET_SOURCE = 'Wiltech'; 

interface Section {
  id: string;
  content: string;
}

export const AgentePage: React.FC = () => {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // --- PARSEO (Dividir por # Headers) ---
  const parseTextToSections = (text: string): Section[] => {
    if (!text) return [{ id: crypto.randomUUID(), content: '# Nueva Sección' }];
    const rawParts = text.split(/(?=(?:^|\n)#{1,6}\s)/g);
    return rawParts
      .map(part => ({ id: crypto.randomUUID(), content: part.trim() }))
      .filter(p => p.content.length > 0);
  };

  const joinSectionsToText = (currentSections: Section[]): string => {
    return currentSections.map(s => s.content).join('\n\n');
  };

  // --- API ---
  const fetchSystemMessage = useCallback(async () => {
    try {
      setLoading(true);
      // Siempre usamos TARGET_SOURCE (Bogotá implícito)
      const data = await AgenteService.getSystemMessage(TARGET_SOURCE);
      const fullText = Array.isArray(data) && data.length > 0 ? data[0].system_message : '';
      setSections(parseTextToSections(fullText));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      await AgenteService.updateSystemMessage(joinSectionsToText(sections), TARGET_SOURCE);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando');
    } finally {
      setSaving(false);
    }
  }, [sections]);

  // --- ATAJO DE TECLADO (CTRL + S) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!saving && !loading) handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, saving, loading]);

  // Operaciones locales
  const updateSection = (id: string, val: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, content: val } : s));
  };
  const removeSection = (id: string) => {
    if (window.confirm('¿Eliminar esta sección permanentemente?')) setSections(prev => prev.filter(s => s.id !== id));
  };
  const addSection = () => {
    setSections(prev => [...prev, { id: crypto.randomUUID(), content: '## Nuevo Título\nContenido aquí...' }]);
  };

  useEffect(() => { fetchSystemMessage(); }, [fetchSystemMessage]);

  return (
    <div className="w-full h-[100dvh] bg-slate-50 flex flex-col font-sans text-slate-900 overflow-hidden">
      
      {/* Alertas (Toasts) */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
        {error && (
          <div className="pointer-events-auto p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-xl flex justify-between animate-in slide-in-from-top-2">
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}
        {success && (
          <div className="pointer-events-auto px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-xl animate-in slide-in-from-top-2 flex items-center gap-3">
            <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
               <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="font-medium text-sm">Cambios guardados correctamente</span>
          </div>
        )}
      </div>

      {/* HEADER FIJO */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex-none z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          
          {/* Título (Ya no hay Tabs) */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-blue-200 shadow-md text-white">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-tight">Personalidad del Agente</h1>
              <p className="text-xs text-slate-500 font-medium">Configuración del prompt de sistema</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={fetchSystemMessage}
              className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200"
              title="Recargar configuración original"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={handleSave}
              disabled={saving}
              className="group flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-blue-600 text-white font-medium rounded-xl shadow-lg shadow-slate-200 hover:shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              title="Guardar (Ctrl + S)"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
              )}
              <span>Guardar</span>
              <div className="hidden lg:flex items-center gap-1 ml-1 px-1.5 py-0.5 bg-white/20 rounded text-[10px] opacity-70">
                <Command className="w-2.5 h-2.5" /> S
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL SCROLLABLE */}
      <main className="flex-1 overflow-y-auto bg-slate-50 custom-scrollbar">
        <div className="max-w-4xl mx-auto px-4 py-8 pb-40 space-y-5">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400 opacity-60 animate-pulse">
              <Bot className="w-12 h-12 mb-4 text-slate-300" />
              <p className="font-medium">Cargando instrucciones...</p>
            </div>
          ) : (
            <>
              {sections.length === 0 && (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                  <p className="text-slate-500 mb-4">No hay instrucciones definidas aún.</p>
                  <button onClick={addSection} className="text-blue-600 font-medium hover:underline">
                    Crear la primera sección
                  </button>
                </div>
              )}

              {sections.map((section, index) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  index={index}
                  onUpdate={updateSection}
                  onDelete={removeSection}
                />
              ))}

              <button
                onClick={addSection}
                className="group w-full py-6 border-2 border-dashed border-slate-300 rounded-2xl text-slate-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="font-medium">Añadir nueva sección</span>
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

// --- COMPONENTE DE TARJETA INDIVIDUAL ---
const SectionCard: React.FC<{
  section: Section;
  index: number;
  onUpdate: (id: string, val: string) => void;
  onDelete: (id: string) => void;
}> = ({ section, index, onUpdate, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Analizar header para el título de la tarjeta
  const lines = section.content.split('\n');
  const firstLine = lines.find(l => l.trim().length > 0) || '';
  const headerMatch = firstLine.match(/^(#{1,6})\s+(.*)/);
  const title = headerMatch ? headerMatch[2] : (firstLine.substring(0, 50) || 'Sin título');
  const level = headerMatch ? headerMatch[1].length : 0;

  // Estilos según importancia (Nivel Markdown)
  const isMainTitle = level === 1;
  const accentColor = isMainTitle ? 'bg-blue-600' : level === 2 ? 'bg-indigo-500' : 'bg-slate-400';

  return (
    <div className={`
      bg-white rounded-2xl border transition-all duration-300 overflow-hidden
      ${isOpen 
        ? 'shadow-xl shadow-blue-900/5 border-blue-200 ring-1 ring-blue-100' 
        : 'shadow-sm border-slate-200 hover:border-slate-300 hover:shadow-md'}
    `}>
      
      {/* HEADER TARJETA */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center justify-between p-4 cursor-pointer select-none relative"
      >
        {/* Indicador de nivel */}
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accentColor} opacity-80`} />
        
        <div className="flex items-center gap-4 pl-4 min-w-0 flex-1">
          <div className={`
            w-6 h-6 rounded-md flex items-center justify-center transition-all duration-300
            ${isOpen ? 'bg-blue-100 text-blue-600 rotate-90' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}
          `}>
            <ChevronRight className="w-4 h-4" />
          </div>
          
          <div className="min-w-0 flex-1">
            <h3 className={`font-semibold text-slate-800 truncate ${isMainTitle ? 'text-lg' : 'text-base'}`}>
              {title}
            </h3>
            {!isOpen && (
              <p className="text-xs text-slate-400 truncate font-mono mt-1 opacity-80">
                {section.content.substring(0, 120).replace(/\n/g, ' ')}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 pl-2 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
          {isOpen && (
            <button 
              onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border mr-1
                ${isEditing 
                  ? 'bg-blue-50 text-blue-700 border-blue-200' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isEditing ? 'Vista Previa' : 'Editar'}</span>
            </button>
          )}
           
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(section.id); }}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Eliminar sección"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CUERPO TARJETA */}
      {isOpen && (
        <div className="border-t border-slate-100 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar bg-slate-50/50">
            {isEditing ? (
              <textarea
                autoFocus
                value={section.content}
                onChange={(e) => onUpdate(section.id, e.target.value)}
                className="w-full h-full min-h-[300px] p-6 bg-transparent resize-y outline-none font-mono text-sm text-slate-700 leading-relaxed focus:bg-white focus:ring-inset focus:ring-2 focus:ring-blue-50/50 transition-all"
                placeholder="Escribe tu markdown aquí..."
                spellCheck={false}
              />
            ) : (
              <div className="p-6 prose prose-slate prose-sm max-w-none bg-white min-h-[150px]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {section.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
          
          {/* Footer del editor */}
          {isEditing && (
            <div className="bg-slate-50 px-4 py-2 border-t border-slate-200/50 flex justify-between items-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Markdown Editor</span>
              <span className="text-[10px] font-mono text-slate-400">
                {section.content.length} chars
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentePage;