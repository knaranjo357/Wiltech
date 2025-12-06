// pages/AgentePage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, RefreshCw, MapPin, Plus, Trash2, 
  ChevronRight, Edit3, Eye, FileText
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AgenteService, AgentSource } from '../services/agenteService';

const SOURCE_LABEL: Record<AgentSource, string> = {
  Wiltech: 'Bogotá',
  WiltechBga: 'Bucaramanga',
};

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
  
  // Estado global para controlar si queremos ver todo expandido
  const [expandAll, setExpandAll] = useState(false);

  const [source, setSource] = useState<AgentSource>(() => {
    try {
      return (localStorage.getItem('agente:selectedSource') as AgentSource) || 'Wiltech';
    } catch { return 'Wiltech'; }
  });

  const persistSource = (s: AgentSource) => {
    try { localStorage.setItem('agente:selectedSource', s); } catch {}
  };

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
  const fetchSystemMessage = async (s: AgentSource = source) => {
    try {
      setLoading(true);
      const data = await AgenteService.getSystemMessage(s);
      const fullText = Array.isArray(data) && data.length > 0 ? data[0].system_message : '';
      setSections(parseTextToSections(fullText));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await AgenteService.updateSystemMessage(joinSectionsToText(sections), source);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando');
    } finally {
      setSaving(false);
    }
  };

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

  useEffect(() => { fetchSystemMessage(source); }, [source]);

  return (
    <div className="w-full h-[100dvh] bg-slate-100 flex flex-col font-sans text-slate-900 overflow-hidden">
      
      {/* Alertas (Toasts) */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
        {error && (
          <div className="pointer-events-auto p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg shadow-xl flex justify-between animate-in slide-in-from-top-2">
            <span>{error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}
        {success && (
          <div className="pointer-events-auto px-4 py-3 bg-green-600 text-white rounded-lg shadow-xl animate-in slide-in-from-top-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="font-medium">Guardado correctamente</span>
          </div>
        )}
      </div>

      {/* HEADER FIJO */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex-none z-20 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => { setSource('Wiltech'); persistSource('Wiltech'); }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${source === 'Wiltech' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Bogotá
              </button>
              <button
                onClick={() => { setSource('WiltechBga'); persistSource('WiltechBga'); }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${source === 'WiltechBga' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Bucaramanga
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => fetchSystemMessage(source)}
              className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors"
              title="Recargar"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Guardar Cambios</span>
            </button>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL SCROLLABLE */}
      <main className="flex-1 overflow-y-auto bg-slate-100 custom-scrollbar">
        <div className="max-w-4xl mx-auto px-4 py-8 pb-40 space-y-4">
          
          {loading ? (
            <div className="text-center py-20 text-slate-400">
              <RefreshCw className="w-10 h-10 animate-spin mx-auto mb-4 text-blue-300" />
              <p>Cargando secciones...</p>
            </div>
          ) : (
            <>
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
                className="w-full py-6 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
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

  // Colores según nivel de header
  const accentColor = level === 1 ? 'bg-blue-600' : level === 2 ? 'bg-indigo-500' : 'bg-slate-400';

  return (
    <div className={`bg-white rounded-xl border transition-all duration-200 ${isOpen ? 'shadow-lg border-blue-200 ring-1 ring-blue-100' : 'shadow-sm border-slate-200'}`}>
      
      {/* HEADER DE LA TARJETA (Siempre visible) */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/50 select-none relative overflow-hidden rounded-t-xl"
      >
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor}`} />
        
        <div className="flex items-center gap-3 pl-3 overflow-hidden">
          <div className={`transition-transform duration-200 text-slate-400 ${isOpen ? 'rotate-90 text-blue-500' : ''}`}>
            <ChevronRight className="w-5 h-5" />
          </div>
          
          <div className="min-w-0">
            <h3 className={`font-semibold text-slate-800 truncate ${level === 1 ? 'text-lg' : 'text-base'}`}>
              {title}
            </h3>
            {!isOpen && (
              <p className="text-xs text-slate-400 truncate font-mono mt-0.5 opacity-80">
                {section.content.substring(0, 80).replace(/\n/g, ' ')}...
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 pl-2">
          {isOpen && (
            <div 
              onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border
                ${isEditing 
                  ? 'bg-blue-50 text-blue-700 border-blue-200' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isEditing ? 'Ver Vista Previa' : 'Editar Markdown'}</span>
            </div>
          )}
           
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(section.id); }}
            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CUERPO DE LA TARJETA (Colapsable) */}
      {isOpen && (
        <div className="border-t border-slate-100 animate-in fade-in slide-in-from-top-1 duration-200">
          
          {/* 
              AQUÍ ESTÁ LA SOLUCIÓN DEL SCROLL:
              'max-h-[60vh]' limita la altura al 60% de la pantalla.
              'overflow-y-auto' añade scroll si el contenido es mayor.
          */}
          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar bg-slate-50/30">
            
            {isEditing ? (
              // MODO EDITOR
              <textarea
                autoFocus
                value={section.content}
                onChange={(e) => onUpdate(section.id, e.target.value)}
                className="w-full h-full min-h-[300px] p-6 bg-transparent resize-y outline-none font-mono text-sm text-slate-700 leading-relaxed focus:bg-white transition-colors"
                placeholder="Escribe tu markdown aquí..."
                spellCheck={false}
              />
            ) : (
              // MODO VISTA PREVIA
              <div className="p-6 prose prose-slate prose-sm max-w-none bg-white min-h-[150px]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {section.content}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Footer de información */}
          {isEditing && (
            <div className="bg-slate-50 px-4 py-2 border-t border-slate-200/50 flex justify-end">
              <span className="text-[10px] font-mono text-slate-400">
                {section.content.length} caracteres
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentePage;