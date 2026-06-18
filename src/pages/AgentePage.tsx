// pages/AgentePage.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Save,
  RefreshCw,
  Plus,
  Trash2,
  ChevronRight,
  Edit3,
  Eye,
  Bot,
  Sparkles,
  Command,
  Layers,
  BadgeDollarSign,
  AlertTriangle,
  Tags,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AgenteService, type AgentSource } from "../services/agenteService";

interface Section {
  id: string;
  content: string;
}

type AgentKey = "wiltech" | "crm" | "precios";

type AgentTab = {
  key: AgentKey;
  label: string;
  icon: React.ReactNode;
  subtitle: string;
  source: AgentSource;
};

type AgentState = {
  sections: Section[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  success: boolean;
  dirty: boolean;
  lastLoadedText: string;
};

const uuid = () => crypto.randomUUID();

const parseTextToSections = (text: string): Section[] => {
  if (!text) return [{ id: uuid(), content: "# Nueva Sección" }];
  const rawParts = text.split(/(?=(?:^|\n)#{1,6}\s)/g);
  return rawParts
    .map((part) => ({ id: uuid(), content: part.trim() }))
    .filter((p) => p.content.length > 0);
};

const joinSectionsToText = (currentSections: Section[]): string => {
  return currentSections.map((s) => s.content).join("\n\n");
};

const computeDirty = (sections: Section[], lastLoadedText: string) => {
  const current = joinSectionsToText(sections).trim();
  const loaded = (lastLoadedText || "").trim();
  return current !== loaded;
};

const TABS: AgentTab[] = [
  {
    key: "wiltech",
    label: "Wiltech",
    icon: <Bot className="w-4 h-4" />,
    subtitle: "Prompt de sistema principal",
    source: "Wiltech",
  },
  {
    key: "crm",
    label: "CRM",
    icon: <Layers className="w-4 h-4" />,
    subtitle: "Agente para operaciones de CRM",
    source: "WiltechCRM",
  },
  {
    key: "precios",
    label: "Precios",
    icon: <BadgeDollarSign className="w-4 h-4" />,
    subtitle: "Agente para gestión de precios",
    source: "WiltechPrecios",
  },
];

export const AgentePage: React.FC = () => {
  const initialAgentState: AgentState = useMemo(
    () => ({
      sections: [],
      loading: true,
      saving: false,
      error: null,
      success: false,
      dirty: false,
      lastLoadedText: "",
    }),
    []
  );

  const [activeTab, setActiveTab] = useState<AgentKey>("wiltech");
  const [agents, setAgents] = useState<Record<AgentKey, AgentState>>({
    wiltech: { ...initialAgentState },
    crm: { ...initialAgentState },
    precios: { ...initialAgentState },
  });

  const tabMeta = useMemo(() => TABS.find((t) => t.key === activeTab)!, [activeTab]);
  const current = agents[activeTab];

  const setAgentState = useCallback((key: AgentKey, patch: Partial<AgentState>) => {
    setAgents((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }, []);

  const fetchByTab = useCallback(
    async (key: AgentKey) => {
      try {
        setAgentState(key, { loading: true, error: null });

        const source = TABS.find((t) => t.key === key)!.source;
        const data = await AgenteService.getSystemMessage(source);

        const fullText =
          Array.isArray(data) && data.length > 0 ? (data[0] as any)?.system_message ?? "" : "";

        const parsed = parseTextToSections(fullText);

        setAgentState(key, {
          sections: parsed,
          lastLoadedText: fullText,
          dirty: false,
          error: null,
        });
      } catch (err) {
        setAgentState(key, { error: err instanceof Error ? err.message : "Error al cargar" });
      } finally {
        setAgentState(key, { loading: false });
      }
    },
    [setAgentState]
  );

  const saveByTab = useCallback(
    async (key: AgentKey) => {
      const st = agents[key];
      try {
        setAgentState(key, { saving: true, error: null });

        const source = TABS.find((t) => t.key === key)!.source;
        const textToSave = joinSectionsToText(st.sections);

        await AgenteService.updateSystemMessage(textToSave, source);

        setAgentState(key, {
          success: true,
          lastLoadedText: textToSave,
          dirty: false,
          error: null,
        });

        setTimeout(() => setAgentState(key, { success: false }), 2500);
      } catch (err) {
        setAgentState(key, { error: err instanceof Error ? err.message : "Error guardando" });
      } finally {
        setAgentState(key, { saving: false });
      }
    },
    [agents, setAgentState]
  );

  // Cargar tab activo (lazy)
  useEffect(() => {
    const st = agents[activeTab];
    if (st.loading && st.sections.length === 0) fetchByTab(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Atajo CTRL/CMD + S (guarda tab actual)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const st = agents[activeTab];
        if (!st.saving && !st.loading) saveByTab(activeTab);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [agents, activeTab, saveByTab]);

  // Cambiar tab con advertencia si hay cambios
  const changeTab = (next: AgentKey) => {
    if (next === activeTab) return;
    if (agents[activeTab].dirty) {
      const ok = window.confirm(
        "Tienes cambios sin guardar en este agente.\n\n¿Quieres cambiar de pestaña de todas formas?"
      );
      if (!ok) return;
    }
    setActiveTab(next);
  };

  // Operaciones locales (tab actual)
  const updateSection = (id: string, val: string) => {
    setAgents((prev) => {
      const st = prev[activeTab];
      const nextSections = st.sections.map((s) => (s.id === id ? { ...s, content: val } : s));
      return {
        ...prev,
        [activeTab]: {
          ...st,
          sections: nextSections,
          dirty: computeDirty(nextSections, st.lastLoadedText),
        },
      };
    });
  };

  const removeSection = (id: string) => {
    if (!window.confirm("¿Eliminar esta sección permanentemente?")) return;
    setAgents((prev) => {
      const st = prev[activeTab];
      const nextSections = st.sections.filter((s) => s.id !== id);
      return {
        ...prev,
        [activeTab]: {
          ...st,
          sections: nextSections,
          dirty: computeDirty(nextSections, st.lastLoadedText),
        },
      };
    });
  };

  const addSection = () => {
    setAgents((prev) => {
      const st = prev[activeTab];
      const nextSections = [...st.sections, { id: uuid(), content: "## Nuevo Título\nContenido aquí..." }];
      return {
        ...prev,
        [activeTab]: {
          ...st,
          sections: nextSections,
          dirty: computeDirty(nextSections, st.lastLoadedText),
        },
      };
    });
  };

  return (
    <div className="w-full h-[100dvh] bg-slate-50 flex flex-col font-sans text-slate-900 overflow-hidden">
      {/* Toasts */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
        {current.error && (
          <div className="wt-toast wt-toast-error shadow-xl pointer-events-auto">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">{current.error}</span>
            <button onClick={() => setAgentState(activeTab, { error: null })} className="ml-auto opacity-70 hover:opacity-100">✕</button>
          </div>
        )}
        {current.success && (
          <div className="wt-toast wt-toast-success shadow-xl pointer-events-auto">
            <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="font-medium text-sm">Cambios guardados correctamente</span>
          </div>
        )}
      </div>

      {/* Header fijo */}
      <header className="header-bar mb-0 shadow-none border-b-slate-100 flex-none z-20">
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200/50">
                <Bot className="w-6 h-6" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold text-slate-900 leading-none tracking-tight">
                    Personalidad del Agente
                  </h1>

                  {current.dirty && (
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                      <AlertTriangle className="w-3 h-3" />
                      Sin guardar
                    </span>
                  )}
                </div>

                <p className="text-xs text-indigo-500 font-bold uppercase tracking-wider mt-1.5">{tabMeta.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchByTab(activeTab)}
                className="btn-ghost"
                title="Recargar configuración"
              >
                <RefreshCw className={`w-5 h-5 ${current.loading ? "animate-spin" : ""}`} />
              </button>

              <button
                onClick={() => saveByTab(activeTab)}
                disabled={current.saving}
                className="btn-primary"
                title="Guardar (Ctrl + S)"
              >
                {current.saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Guardar</span>
                <div className="hidden lg:flex items-center gap-1 ml-1 px-1.5 py-0.5 bg-white/20 rounded text-[10px] opacity-70">
                  <Command className="w-2.5 h-2.5" /> S
                </div>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="wt-filter-group w-full sm:w-auto">
                {TABS.map((t) => {
                  const isActive = t.key === activeTab;
                  const st = agents[t.key];
                  return (
                    <button
                      key={t.key}
                      onClick={() => changeTab(t.key)}
                      className={`wt-filter-pill ${isActive ? "wt-filter-pill-active" : ""} flex items-center gap-2`}
                      title={t.subtitle}
                    >
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${isActive ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>
                        {t.icon}
                      </span>
                      <span>{t.label}</span>
                      {st.dirty && <span className="ml-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                    </button>
                  );
                })}
              </div>

              <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-medium ml-2">
                <Tags className="w-4 h-4" />
                <span>
                  Editando: <span className="text-slate-700 font-bold">{tabMeta.label}</span>
                </span>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Markdown + Secciones
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 overflow-y-auto bg-slate-50 custom-scrollbar">
        <div className="max-w-4xl mx-auto px-4 py-8 pb-40 space-y-5">
          {current.loading ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400 opacity-60 animate-pulse">
              <Bot className="w-12 h-12 mb-4 text-slate-300" />
              <p className="font-medium">Cargando instrucciones...</p>
            </div>
          ) : (
            <>
              {current.sections.length === 0 && (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                  <p className="text-slate-500 mb-4">No hay instrucciones definidas aún.</p>
                  <button onClick={addSection} className="text-blue-600 font-medium hover:underline">
                    Crear la primera sección
                  </button>
                </div>
              )}

              {current.sections.map((section, index) => (
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
                className="group w-full py-10 border-2 border-dashed border-slate-200/80 rounded-2xl text-slate-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center gap-3 active:scale-[0.99]"
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-50 group-hover:bg-indigo-100 flex items-center justify-center transition-all group-hover:scale-110 shadow-sm">
                  <Plus className="w-6 h-6" />
                </div>
                <span className="font-bold text-sm uppercase tracking-widest">Añadir nueva sección</span>
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

// --- Tarjeta de Sección ---
const SectionCard: React.FC<{
  section: Section;
  index: number;
  onUpdate: (id: string, val: string) => void;
  onDelete: (id: string) => void;
}> = ({ section, index, onUpdate, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const lines = section.content.split("\n");
  const firstLine = lines.find((l) => l.trim().length > 0) || "";
  const headerMatch = firstLine.match(/^(#{1,6})\s+(.*)/);
  const title = headerMatch ? headerMatch[2] : firstLine.substring(0, 50) || "Sin título";
  const level = headerMatch ? headerMatch[1].length : 0;

  const isMainTitle = level === 1;
  const accentColor = isMainTitle ? "bg-blue-600" : level === 2 ? "bg-indigo-500" : "bg-slate-400";

  return (
    <div
      className={`
        card transition-all duration-300 overflow-hidden
        ${
          isOpen
            ? "shadow-[var(--wt-shadow-md)] border-indigo-200 ring-4 ring-indigo-500/5 translate-y-[-2px]"
            : "border-slate-200/60 hover:border-slate-300 hover:shadow-[var(--wt-shadow-sm)]"
        }
      `}
    >
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center justify-between p-4 cursor-pointer select-none relative bg-white"
      >
        <div className={`wt-strip ${accentColor.replace('bg-', 'bg-')}`} style={{ backgroundColor: isMainTitle ? '#4f46e5' : level === 2 ? '#6366f1' : '#94a3b8' }} />

        <div className="flex items-center gap-4 pl-4 min-w-0 flex-1">
          <div
            className={`
              w-6 h-6 rounded-md flex items-center justify-center transition-all duration-300
              ${
                isOpen
                  ? "bg-blue-100 text-blue-600 rotate-90"
                  : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
              }
            `}
          >
            <ChevronRight className="w-4 h-4" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className={`font-semibold text-slate-800 truncate ${isMainTitle ? "text-lg" : "text-base"}`}>
              {title}
            </h3>

            {!isOpen && (
              <p className="text-xs text-slate-400 truncate font-mono mt-1 opacity-80">
                {section.content.substring(0, 120).replace(/\n/g, " ")}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 pl-2 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
          {isOpen && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(!isEditing);
                setTimeout(() => editorRef.current?.focus(), 0);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border mr-1
                ${
                  isEditing
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
            >
              {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isEditing ? "Vista Previa" : "Editar"}</span>
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(section.id);
            }}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Eliminar sección"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-slate-100 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar bg-slate-50/50">
            {isEditing ? (
              <textarea
                ref={editorRef}
                autoFocus
                value={section.content}
                onChange={(e) => onUpdate(section.id, e.target.value)}
                className="w-full h-full min-h-[320px] p-6 bg-transparent resize-y outline-none font-mono text-sm text-slate-700 leading-relaxed focus:bg-white focus:ring-inset focus:ring-2 focus:ring-blue-50/50 transition-all"
                placeholder="Escribe tu markdown aquí..."
                spellCheck={false}
              />
            ) : (
              <div className="p-6 prose prose-slate prose-sm max-w-none bg-white min-h-[150px]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
              </div>
            )}
          </div>

          {isEditing && (
            <div className="bg-slate-50 px-4 py-2 border-t border-slate-200/50 flex justify-between items-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Markdown Editor</span>
              <span className="text-[10px] font-mono text-slate-400">{section.content.length} chars</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentePage;