import { RepairLoader } from '../components/RepairLoader';
import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BadgeDollarSign,
  Bold,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Columns2,
  Command,
  Copy,
  Edit3,
  Eye,
  FileText,
  Layers,
  List,
  Minus,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Type,
  X,
  Globe,
  Maximize2,
  ExternalLink,
} from 'lucide-react';
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AgenteService, type AgentSource } from "../services/agenteService";
import { splitAgentSections } from '../utils/agentSections';
import { agenteApi } from "../services/diagnosticadorService";
import { useCountryConfig } from '../hooks/useCountryConfig';
import { ModalPortal } from '../components/ModalPortal';
import { selectAgentDocument } from '../utils/agentDocument';
import type { SystemMessage } from '../types/precios';

interface Section {
  id: string;
  content: string;
}

type AgentKey = "wiltech" | "crm" | "precios" | "diagnosticador";
type EditorMode = "edit" | "preview" | "split";

type AgentTab = {
  key: AgentKey;
  label: string;
  icon: React.ReactNode;
  subtitle: string;
  description: string;
  source?: AgentSource;
};

type AgentState = {
  sections: Section[];
  loading: boolean;
  loaded: boolean;
  loadFailed: boolean;
  saving: boolean;
  error: string | null;
  success: boolean;
  dirty: boolean;
  lastLoadedText: string;
  lastSavedAt: Date | null;
  rowNumber?: number;
  promptRecord?: SystemMessage;
  pricesRecord?: SystemMessage;
};

const uuid = () => crypto.randomUUID();

const parseTextToSections = (text: string): Section[] =>
  splitAgentSections(text).map(content => ({ id: uuid(), content }));

const joinSectionsToText = (sections: Section[]) => sections.map((section) => section.content).join("\n\n");

const computeDirty = (sections: Section[], lastLoadedText: string) =>
  joinSectionsToText(sections).trim() !== (lastLoadedText || "").trim();

const countWords = (value: string) => {
  const clean = value.trim();
  return clean ? clean.split(/\s+/).length : 0;
};

const makeAgentState = (): AgentState => ({
  sections: [],
  loading: false,
  loaded: false,
  loadFailed: false,
  saving: false,
  error: null,
  success: false,
  dirty: false,
  lastLoadedText: "",
  lastSavedAt: null,
});

const TABS: AgentTab[] = [
  {
    key: "wiltech",
    label: "Wiltech",
    icon: <Bot className="h-4 w-4" />,
    subtitle: "Agente principal",
    description: "Personalidad, reglas generales y forma de responder a los clientes.",
    source: "Wiltech",
  },
  {
    key: "crm",
    label: "CRM",
    icon: <Layers className="h-4 w-4" />,
    subtitle: "Operación comercial",
    description: "Criterios para gestionar contactos, etapas, agenda y seguimiento.",
    source: "WiltechCRM",
  },
  {
    key: "precios",
    label: "Precios",
    icon: <BadgeDollarSign className="h-4 w-4" />,
    subtitle: "Cotización y catálogo",
    description: "Instrucciones para consultar, explicar y presentar precios.",
    source: "WiltechPrecios",
  },
  {
    key: "diagnosticador",
    label: "Diagnosticador",
    icon: <ClipboardCheck className="h-4 w-4" />,
    subtitle: "Soporte técnico",
    description: "Guía de diagnóstico, reparación y comunicación técnica.",
  },
];

export const AgentePage: React.FC = () => {
  const { country, config } = useCountryConfig();
  const [documentOpen, setDocumentOpen] = useState(false);
  const [pricesOpen, setPricesOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [documentView, setDocumentView] = useState<'preview' | 'text'>('preview');
  const [sectionDisplay, setSectionDisplay] = useState<{ expanded: boolean; revision: number }>({ expanded: false, revision: 0 });
  const [activeTab, setActiveTab] = useState<AgentKey>("wiltech");
  const [agents, setAgents] = useState<Record<AgentKey, AgentState>>({
    wiltech: makeAgentState(),
    crm: makeAgentState(),
    precios: makeAgentState(),
    diagnosticador: makeAgentState(),
  });
  const [search, setSearch] = useState("");
  const [copyResult, setCopyResult] = useState<{ key: AgentKey; text: string; status: 'copying' | 'copied' | 'error' } | null>(null);
  const deferredSearch = useDeferredValue(search);
  const [focusRequest, setFocusRequest] = useState(0);
  const [focusedSection, setFocusedSection] = useState<string | null>(null);
  const [newSectionId, setNewSectionId] = useState<string | null>(null);
  const [discardArmed, setDiscardArmed] = useState(false);
  const [removedSection, setRemovedSection] = useState<{ key: AgentKey; section: Section; index: number } | null>(null);

  const tabMeta = useMemo(() => TABS.find((tab) => tab.key === activeTab)!, [activeTab]);
  const current = agents[activeTab];

  const setAgentState = useCallback((key: AgentKey, patch: Partial<AgentState>) => {
    setAgents((previous) => ({
      ...previous,
      [key]: { ...previous[key], ...patch },
    }));
  }, []);

  const fetchByTab = useCallback(async (key: AgentKey, force = false) => {
    try {
      setAgentState(key, { loading: true, error: null, success: false });
      const tab = TABS.find((item) => item.key === key)!;
      const data: any = key === "diagnosticador"
        ? await agenteApi.getSystemMessage({ force })
        : await AgenteService.getSystemMessage(tab.source!, { force });
      const document = selectAgentDocument(data, country, key === 'precios');
      const fullText = document.prompt?.system_message ?? '';

      setAgentState(key, {
        sections: parseTextToSections(fullText),
        lastLoadedText: fullText,
        rowNumber: document.prompt?.row_number,
        promptRecord: document.prompt,
        pricesRecord: document.prices,
        dirty: false,
        loaded: true,
        loadFailed: !document.prompt,
        error: document.prompt ? null : `No se recibió un prompt editable para ${country}.`,
      });
    } catch (error) {
      setAgentState(key, {
        loaded: true,
        loadFailed: true,
        error: error instanceof Error ? error.message : "No fue posible cargar este agente.",
      });
    } finally {
      setAgentState(key, { loading: false });
    }
  }, [setAgentState, country]);

  const saveByTab = useCallback(async (key: AgentKey) => {
    const state = agents[key];
    if (!state.dirty || state.loading || state.saving) return;

    try {
      setAgentState(key, { saving: true, error: null, success: false });
      const tab = TABS.find((item) => item.key === key)!;
      const textToSave = joinSectionsToText(state.sections);
      if (state.loadFailed || !state.promptRecord) throw new Error('No se puede guardar sin identificar el prompt del país. Recarga el documento.');

      if (key === "diagnosticador") {
        await agenteApi.updateSystemMessage({
          row_number: state.promptRecord.row_number,
          pais_sede: state.promptRecord.pais_sede,
          system_message: textToSave,
        });
      } else {
        await AgenteService.updateSystemMessage(textToSave, tab.source!, state.promptRecord);
      }

      setAgents((previous) => ({
        ...previous,
        [key]: {
          ...previous[key],
          success: true,
          lastLoadedText: textToSave,
          lastSavedAt: new Date(),
          dirty: computeDirty(previous[key].sections, textToSave),
          error: null,
        },
      }));
      window.setTimeout(() => setAgentState(key, { success: false }), 2600);
    } catch (error) {
      setAgentState(key, {
        error: error instanceof Error ? error.message : "No fue posible guardar los cambios.",
      });
    } finally {
      setAgentState(key, { saving: false });
    }
  }, [agents, setAgentState]);

  useEffect(() => {
    if (!current.loaded && !current.loading) void fetchByTab(activeTab);
  }, [activeTab, current.loaded, current.loading, fetchByTab]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveByTab(activeTab);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTab, saveByTab]);

  useEffect(() => {
    const hasUnsavedChanges = Object.values(agents).some((agent) => agent.dirty);
    if (!hasUnsavedChanges) return;
    const preventAccidentalExit = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventAccidentalExit);
    const preventNavigation = (event: Event) => {
      if (!window.confirm('Hay cambios sin guardar en el Agente IA. ¿Quieres salir y descartarlos?')) event.preventDefault();
    };
    window.addEventListener('app:before-navigate', preventNavigation);
    return () => {
      window.removeEventListener("beforeunload", preventAccidentalExit);
      window.removeEventListener('app:before-navigate', preventNavigation);
    };
  }, [agents]);

  useEffect(() => {
    setDiscardArmed(false);
    setSearch("");
    setFocusedSection(null);
  }, [activeTab]);

  useEffect(() => {
    if (!discardArmed) return;
    const timeout = window.setTimeout(() => setDiscardArmed(false), 4000);
    return () => window.clearTimeout(timeout);
  }, [discardArmed]);

  const updateSections = useCallback((updater: (sections: Section[]) => Section[]) => {
    setAgents((previous) => {
      const state = previous[activeTab];
      const sections = updater(state.sections);
      return {
        ...previous,
        [activeTab]: {
          ...state,
          sections,
          dirty: computeDirty(sections, state.lastLoadedText),
        },
      };
    });
  }, [activeTab]);

  const updateSection = (id: string, content: string) => {
    updateSections((sections) => sections.map((section) => section.id === id ? { ...section, content } : section));
  };

  const removeSection = (id: string) => {
    const index = current.sections.findIndex((section) => section.id === id);
    if (index < 0) return;
    setRemovedSection({ key: activeTab, section: current.sections[index], index });
    updateSections((sections) => sections.filter((section) => section.id !== id));
  };

  const addSection = () => {
    const id = uuid();
    updateSections((sections) => [
      ...sections,
      { id, content: "## Nueva sección\n\nDescribe aquí la regla, contexto o comportamiento esperado." },
    ]);
    setSearch("");
    setNewSectionId(id);
    setFocusedSection(id);
    setFocusRequest(value => value + 1);
  };

  const duplicateSection = (id: string) => {
    const copyId = uuid();
    updateSections((sections) => {
      const index = sections.findIndex((section) => section.id === id);
      if (index < 0) return sections;
      const next = [...sections];
      const copiedContent = sections[index].content.replace(
        /^(#{1,6}\s+)(.+)$/m,
        (_match, heading, title) => `${heading}${title} (copia)`,
      );
      next.splice(index + 1, 0, { id: copyId, content: copiedContent });
      return next;
    });
    setNewSectionId(copyId);
  };

  const moveSection = (id: string, direction: -1 | 1) => {
    updateSections((sections) => {
      const index = sections.findIndex((section) => section.id === id);
      const destination = index + direction;
      if (index < 0 || destination < 0 || destination >= sections.length) return sections;
      const next = [...sections];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  };

  const handleReload = () => {
    if (current.dirty && !discardArmed) {
      setDiscardArmed(true);
      return;
    }
    setDiscardArmed(false);
    setNewSectionId(null);
    void fetchByTab(activeTab, true);
  };

  const fullText = useMemo(() => joinSectionsToText(current.sections), [current.sections]);
  const copyStatus = copyResult?.key === activeTab && copyResult.text === fullText ? copyResult.status : null;
  const copyFullPrompt = async () => {
    if (current.loading || !fullText.trim() || copyStatus === 'copying') return;
    const document = { key: activeTab, text: fullText };
    setCopyResult({ ...document, status: 'copying' });
    try {
      await navigator.clipboard.writeText(fullText);
      setCopyResult({ ...document, status: 'copied' });
    } catch {
      setCopyResult({ ...document, status: 'error' });
    }
  };
  const filteredSections = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase("es");
    if (!query) return current.sections;
    return current.sections.filter((section) => section.content.toLocaleLowerCase("es").includes(query));
  }, [current.sections, deferredSearch]);
  const sectionIndices = useMemo(() => new Map(current.sections.map((section, index) => [section.id, index])), [current.sections]);
  const wordCount = useMemo(() => countWords(fullText), [fullText]);
  const pendingAgents = TABS.filter(tab => agents[tab.key].dirty);
  const navigateToSection = (id: string) => {
    setSearch('');
    setFocusedSection(id);
    setFocusRequest(value => value + 1);
  };

  return (
    <div className="page-container wt-agent-page min-w-0 min-h-screen space-y-4 sm:space-y-5 pb-28 text-slate-900">
      <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 max-w-full rounded-full bg-slate-900/[0.035] blur-3xl" />

      <div className="fixed left-1/2 top-20 z-[80] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4 pointer-events-none">
        {removedSection?.key === activeTab && (
          <div className="wt-toast pointer-events-auto flex items-center gap-3 bg-slate-950 text-white" role="status">
            <span className="flex-1 text-sm">Sección eliminada</span>
            <button type="button" className="rounded-lg bg-white/15 px-3 py-2 text-sm font-bold hover:bg-white/25" onClick={() => {
              const removed = removedSection;
              updateSections((sections) => {
                if (sections.some((section) => section.id === removed.section.id)) return sections;
                const restored = [...sections];
                restored.splice(Math.min(removed.index, restored.length), 0, removed.section);
                return restored;
              });
              setRemovedSection(null);
            }}>Deshacer</button>
            <button type="button" aria-label="Cerrar aviso" onClick={() => setRemovedSection(null)}><X className="h-4 w-4" /></button>
          </div>
        )}
        {current.error && (
          <div className="wt-toast wt-toast-error pointer-events-auto">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span className="min-w-0 flex-1 text-sm font-semibold">{current.error}</span>
            <button
              type="button"
              onClick={() => setAgentState(activeTab, { error: null })}
              className="rounded-lg p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
              aria-label="Cerrar mensaje"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {current.success && (
          <div className="wt-toast wt-toast-success pointer-events-auto">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span className="text-sm font-semibold">Agente actualizado correctamente.</span>
          </div>
        )}
      </div>

      <header className="header-bar max-lg:static">
        <div className="flex w-full flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-lg shadow-slate-900/15">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="wt-page-title">
                  Agente IA
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600"><Globe className="h-3.5 w-3.5" />{country}</span>
                <StatusBadge failed={current.loadFailed} loaded={current.loaded} dirty={current.dirty} loading={current.loading} saving={current.saving} />
              </div>
              <p className="mt-1.5 text-xs font-medium text-slate-500">
                Define las instrucciones y el comportamiento de cada asistente de Wiltech.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            {config.chat_webhook_url ? (
              <a href={config.chat_webhook_url} target="_blank" rel="noopener noreferrer" className="btn-secondary flex-1 sm:flex-none" title={`Abrir el chat de ${country} en n8n`}>
                <ExternalLink className="h-4 w-4" /> Probar chat
              </a>
            ) : (
              <span className="text-xs text-slate-500">Chat sin configurar para {country}. Solicita la URL a root.</span>
            )}
            <button
              type="button"
              onClick={handleReload}
              disabled={current.loading || current.saving}
              className={`btn-secondary flex-1 sm:flex-none ${discardArmed ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100" : ""}`}
            >
              {current.loading ? <RepairLoader variant="icon" /> : <RefreshCw className="h-4 w-4" />}
              <span>{discardArmed ? "Confirmar descarte" : current.dirty ? "Descartar" : "Recargar"}</span>
            </button>
            <button
              type="button"
              onClick={() => void saveByTab(activeTab)}
              disabled={!current.dirty || current.loading || current.saving}
              className="btn-primary flex-1 sm:flex-none"
            >
              {current.saving ? (
                <RepairLoader variant="icon" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{current.saving ? "Guardando" : <>Guardar<span className="hidden sm:inline"> cambios</span></>}</span>
              <span className="hidden items-center gap-1 rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] text-white/70 lg:inline-flex">
                <Command className="h-2.5 w-2.5" />S
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-3 lg:space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto custom-scrollbar">
          <section className="card p-2">
            <div className="px-3 pb-2 pt-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Agentes disponibles</p>
            </div>
            <div className="grid min-w-0 grid-cols-2 gap-2 pb-1 sm:grid-cols-4 lg:grid-cols-1">
              {TABS.map((tab) => {
                const state = agents[tab.key];
                const active = tab.key === activeTab;
                return (
                  <button
                    type="button"
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    aria-current={active ? "page" : undefined}
                    className={`wt-agent-tab group min-w-0 rounded-xl border p-2.5 text-left transition lg:p-3 ${
                      active
                        ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-900/15"
                        : "border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 lg:items-start lg:gap-3">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg lg:h-9 lg:w-9 ${active ? "bg-white text-slate-950" : "bg-slate-100 text-slate-500 group-hover:bg-white"}`}>
                        {tab.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <strong className="block break-words text-xs font-bold lg:text-sm lg:font-extrabold">{tab.label}</strong>
                          {state.loading ? (
                            <RepairLoader variant="icon" />
                          ) : state.dirty ? (
                            <span className="h-2 w-2 rounded-full bg-amber-400" title="Cambios sin guardar" />
                          ) : state.loaded ? (
                            <Check className={`h-3.5 w-3.5 ${active ? "text-emerald-300" : "text-emerald-500"}`} />
                          ) : null}
                        </span>
                        <span className={`mt-0.5 hidden text-[11px] font-medium lg:block ${active ? "text-slate-300" : "text-slate-400"}`}>
                          {tab.subtitle}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="card p-4">
            <button type="button" onClick={() => setSummaryOpen(open => !open)} aria-expanded={summaryOpen} aria-controls="agent-document-summary" className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm font-bold text-slate-800 lg:hidden">
              <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Documento y herramientas</span>
              <ChevronDown className={`h-4 w-4 shrink-0 transition ${summaryOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className="hidden items-center gap-2 text-slate-800 lg:flex">
              <FileText className="h-4 w-4" />
              <h2 className="text-sm font-extrabold">Resumen del documento</h2>
            </div>
            <div id="agent-document-summary" className={summaryOpen ? 'block' : 'hidden lg:block'}>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <DocumentMetric label="Secciones" value={current.sections.length} />
              <DocumentMetric label="Palabras" value={wordCount} />
              <DocumentMetric label="Caracteres" value={fullText.length} />
            </div>
            <button
              type="button"
              onClick={copyFullPrompt}
              disabled={current.loading || !fullText.trim() || copyStatus === 'copying'}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
              title="Copia todas las secciones del agente actual, incluidos los cambios sin guardar"
            >
              {copyStatus === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copyStatus === 'copied' ? 'Prompt copiado' : copyStatus === 'copying' ? 'Copiando...' : 'Copiar prompt completo'}
            </button>
            <p role="status" aria-live="polite" className={copyStatus === 'error' ? 'mt-2 text-xs text-red-600' : 'sr-only'}>
              {copyStatus === 'error' ? 'No se pudo copiar. Revisa el permiso del portapapeles e inténtalo de nuevo.' : copyStatus === 'copied' ? 'Prompt completo copiado al portapapeles.' : ''}
            </p>
            <button type="button" onClick={() => setDocumentOpen(true)} disabled={current.loading || !fullText.trim()} className="btn-secondary mt-2 w-full justify-center text-xs">
              <Maximize2 className="h-3.5 w-3.5" /> Leer prompt completo
            </button>
            <div className="mt-4 hidden rounded-xl border border-slate-100 bg-slate-50 p-3 lg:block">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Objetivo</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{tabMeta.description}</p>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] font-medium text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              <span>{current.lastSavedAt ? `Guardado a las ${current.lastSavedAt.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}` : current.dirty ? "Hay cambios pendientes" : current.loadFailed ? "Sin conexión con el documento" : current.loaded ? "Documento sincronizado" : "Pendiente de cargar"}</span>
            </div>
            </div>
          </section>
          {current.sections.length > 0 && (
            <nav aria-label="Secciones del agente" className="card hidden p-3 lg:block">
              <p className="section-title px-2 py-2">En este documento</p>
              <div className="max-h-[35dvh] overflow-y-auto custom-scrollbar">
                {current.sections.map((section, index) => {
                  const title = section.content.split("\n").find(line => line.trim())?.replace(/^#{1,6}\s+/, '') || 'Sin título';
                  return (
                    <button key={section.id} type="button" onClick={() => navigateToSection(section.id)}
                      aria-current={focusedSection === section.id ? "location" : undefined}
                      className={"flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition hover:bg-slate-100 " + (focusedSection === section.id ? "bg-slate-100 font-semibold text-slate-950" : "text-slate-500")}>
                      <span className="w-5 shrink-0 text-[10px] tabular-nums text-slate-400">{index + 1}</span>
                      <span className="truncate">{title}</span>
                    </button>
                  );
                })}
              </div>
            </nav>
          )}
        </aside>

        <main className="min-w-0 space-y-4">
          {activeTab === 'precios' && (
            <section className="grid gap-3 sm:grid-cols-2" aria-label="Contenido del agente de precios">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold text-slate-900">Prompt</h2><span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">Editable</span></div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">{current.loading ? 'Cargando instrucciones...' : current.promptRecord ? `Instrucciones del agente para ${current.promptRecord.pais_sede}. Edita sus secciones debajo.` : `No se recibió el prompt de ${country}. Recarga para volver a intentarlo.`}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold text-slate-900">Precios</h2><span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">Solo lectura</span></div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">{current.loading ? 'Cargando precios...' : current.pricesRecord?.system_message?.trim() ? `Datos de precios de ${country}. Se consultan por separado del prompt.` : 'Precios vacíos: no se recibió contenido de tipo precios para este país.'}</p>
                <button type="button" onClick={() => setPricesOpen(true)} disabled={current.loading || !current.pricesRecord?.system_message?.trim()} className="btn-secondary mt-3 text-xs"><Eye className="h-3.5 w-3.5" /> Ver precios</button>
              </div>
            </section>
          )}
          <section className="card overflow-hidden">
            <div className="border-b border-slate-100 bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">{tabMeta.icon}</span>
                    <div className="min-w-0">
                      <h2 className="text-lg font-extrabold leading-tight text-slate-950">Instrucciones de {tabMeta.label}</h2>
                      <p className="text-xs text-slate-500">Organiza las reglas por bloques claros y fáciles de mantener.</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="wt-input-wrap min-w-0 flex-1 xl:w-72 xl:flex-none">
                    <Search className="wt-input-icon" />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar en instrucciones..."
                      aria-label="Buscar en instrucciones"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                        aria-label="Limpiar búsqueda"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <button type="button" onClick={addSection} aria-label="Nueva sección" className="btn-primary shrink-0" disabled={current.loading || current.loadFailed}>
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Nueva sección</span>
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <p role="status" className="text-xs text-slate-500">{search ? `${filteredSections.length} de ${current.sections.length} secciones coinciden` : 'Abre una sección para leerla o editarla.'}</p>
                <div className="flex items-center gap-1">
                  <button type="button" disabled={!current.sections.length || current.loading} onClick={() => setSectionDisplay(previous => ({ expanded: true, revision: previous.revision + 1 }))} className="rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40">Expandir todo</button>
                  <span aria-hidden="true" className="text-slate-200">/</span>
                  <button type="button" disabled={!current.sections.length || current.loading} onClick={() => setSectionDisplay(previous => ({ expanded: false, revision: previous.revision + 1 }))} className="rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40">Contraer todo</button>
                </div>
              </div>
              {current.sections.length > 0 && <select aria-label="Ir a una sección" value={focusedSection ?? ''} onChange={event => navigateToSection(event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 lg:hidden">
                <option value="" disabled>Ir a una sección...</option>
                {current.sections.map((section, index) => <option key={section.id} value={section.id}>{index + 1}. {section.content.split('\n').find(line => line.trim())?.replace(/^#{1,6}\s+/, '') || 'Sin título'}</option>)}
              </select>}
            </div>

            <div className="bg-slate-50/70 p-3 sm:p-5">
              {current.loading ? (
                <AgentLoading />
              ) : current.loadFailed && current.sections.length === 0 ? (
                <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-rose-200 bg-white p-8 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><AlertTriangle className="h-6 w-6" /></span>
                  <h3 className="mt-4 text-base font-extrabold text-slate-900">No pudimos cargar este agente</h3>
                  <p className="mt-1 max-w-sm text-sm text-slate-500">Revisa la conexión e inténtalo nuevamente. No se modificó ningún contenido.</p>
                  <button type="button" onClick={() => void fetchByTab(activeTab, true)} className="btn-secondary mt-5">
                    <RefreshCw className="h-4 w-4" /> Reintentar
                  </button>
                </div>
              ) : filteredSections.length > 0 ? (
                <div className="space-y-3">
                  {filteredSections.map((section) => {
                    const realIndex = sectionIndices.get(section.id) ?? 0;
                    return (
                      <SectionCard
                        key={section.id}
                        section={section}
                        index={realIndex}
                        total={current.sections.length}
                        autoEdit={newSectionId === section.id}
                        focused={focusedSection === section.id}
                        focusRequest={focusRequest}
                        display={sectionDisplay}
                        onUpdate={updateSection}
                        onDelete={removeSection}
                        onDuplicate={duplicateSection}
                        onMove={moveSection}
                      />
                    );
                  })}

                  {!search && (
                    <button
                      type="button"
                      onClick={addSection}
                      className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-7 text-slate-500 transition hover:border-slate-500 hover:text-slate-950"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 transition group-hover:bg-slate-950 group-hover:text-white"><Plus className="h-4 w-4" /></span>
                      <span className="text-sm font-extrabold">Añadir otra sección</span>
                    </button>
                  )}
                </div>
              ) : search ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
                  <Search className="h-7 w-7 text-slate-300" />
                  <h3 className="mt-3 text-sm font-extrabold text-slate-800">Sin coincidencias</h3>
                  <p className="mt-1 text-xs text-slate-500">No encontramos “{search}” dentro de este agente.</p>
                  <button type="button" onClick={() => setSearch("")} className="mt-4 text-xs font-bold text-slate-900 underline underline-offset-4">Limpiar búsqueda</button>
                </div>
              ) : (
                <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950 text-white"><Bot className="h-6 w-6" /></span>
                  <h3 className="mt-4 text-base font-extrabold text-slate-900">Este agente todavía no tiene instrucciones</h3>
                  <p className="mt-1 max-w-sm text-sm text-slate-500">Crea el primer bloque para definir su personalidad y comportamiento.</p>
                  <button type="button" onClick={addSection} className="btn-primary mt-5"><Plus className="h-4 w-4" /> Crear primera sección</button>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
      {pendingAgents.length > 0 && <div className="sticky bottom-3 z-30 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:p-4" role="region" aria-label="Cambios pendientes">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><span className="h-2 w-2 rounded-full bg-amber-400" />{current.dirty ? `Cambios sin guardar en ${tabMeta.label}` : 'Hay cambios en otros agentes'}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{country}</span>
              {pendingAgents.filter(tab => tab.key !== activeTab).map(tab => <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className="rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-800 hover:bg-amber-100">Revisar {tab.label}</button>)}
            </div>
          </div>
          <button type="button" onClick={() => void saveByTab(activeTab)} disabled={!current.dirty || current.loading || current.saving} className="btn-primary"><Save className="h-4 w-4" />{current.saving ? 'Guardando...' : 'Guardar cambios'}</button>
        </div>
      </div>}
      <ModalPortal open={pricesOpen && activeTab === 'precios'} onClose={() => setPricesOpen(false)} ariaLabel={`Precios de ${country}, solo lectura`} className="flex h-[85dvh] max-w-5xl flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 p-5">
          <div><h2 className="text-lg font-bold text-slate-900">Precios · {country}</h2><p className="mt-1 text-xs text-slate-500">Solo lectura. Este contenido no se modifica al guardar el prompt.</p></div>
          <button type="button" onClick={() => setPricesOpen(false)} aria-label="Cerrar precios" className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <PriceReference content={current.pricesRecord?.system_message ?? ''} />
      </ModalPortal>
      <ModalPortal open={documentOpen} onClose={() => setDocumentOpen(false)} ariaLabel={`Prompt completo de ${tabMeta.label}`} className="flex h-[88dvh] max-w-5xl flex-col">
        <div className="shrink-0 border-b border-slate-200 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="text-lg font-bold text-slate-950">Prompt completo · {tabMeta.label}</h2><p className="mt-1 text-xs text-slate-500">{country} · {wordCount.toLocaleString('es')} palabras{current.dirty ? ' · Incluye cambios sin guardar' : ''}</p></div>
            <button type="button" onClick={() => setDocumentOpen(false)} aria-label="Cerrar prompt completo" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <ModeButton active={documentView === 'preview'} onClick={() => setDocumentView('preview')} icon={<Eye className="h-3.5 w-3.5" />} label="Lectura" />
              <ModeButton active={documentView === 'text'} onClick={() => setDocumentView('text')} icon={<AlignLeft className="h-3.5 w-3.5" />} label="Texto original" />
            </div>
            <button type="button" onClick={copyFullPrompt} disabled={!fullText.trim() || copyStatus === 'copying'} className="btn-primary"><Copy className="h-4 w-4" />{copyStatus === 'copied' ? 'Prompt copiado' : copyStatus === 'copying' ? 'Copiando...' : 'Copiar todo'}</button>
          </div>
          <p role="status" className={copyStatus === 'error' ? 'mt-2 text-xs text-red-600' : 'sr-only'}>{copyStatus === 'error' ? 'No se pudo copiar. Puedes seleccionar el texto original y copiarlo manualmente.' : copyStatus === 'copied' ? 'Prompt copiado al portapapeles.' : ''}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-4 sm:p-8">
          {documentView === 'preview' ? <div className="agent-markdown mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 sm:p-8"><SectionPreview content={fullText} /></div> : <textarea readOnly aria-label="Texto completo del prompt" value={fullText} className="h-full min-h-64 w-full resize-none rounded-xl border border-slate-200 bg-white p-5 font-mono text-sm leading-7 text-slate-700 outline-none focus:ring-2 focus:ring-slate-300" />}
        </div>
      </ModalPortal>
    </div>
  );
};

const StatusBadge: React.FC<{ dirty: boolean; loading: boolean; saving: boolean; failed: boolean; loaded: boolean }> = ({ dirty, loading, saving, failed, loaded }) => {
  if (failed && !loading) return <span className="badge badge-danger"><AlertTriangle className="h-3 w-3" /> Error de carga</span>;
  if (!loaded && !loading) return <span className="badge">Pendiente de cargar</span>;
  if (loading) return <span className="badge"><RepairLoader variant="icon" /> Cargando</span>;
  if (saving) return <span className="badge"><RepairLoader variant="icon" /> Guardando</span>;
  if (dirty) return <span className="badge badge-warning"><AlertTriangle className="h-3 w-3" /> Cambios sin guardar</span>;
  return <span className="badge badge-success"><CheckCircle2 className="h-3 w-3" /> Sincronizado</span>;
};

const DocumentMetric: React.FC<{ label: string; value: number; compact?: boolean }> = ({ label, value, compact = false }) => (
  <div className={`rounded-xl border border-slate-100 bg-slate-50 text-center ${compact ? "min-w-24 px-3 py-2" : "px-2 py-2.5"}`}>
    <strong className="block text-sm font-black tracking-tight text-slate-900">{value.toLocaleString("es-CO")}</strong>
    <span className="mt-0.5 block text-[8px] font-black uppercase tracking-wider text-slate-400">{label}</span>
  </div>
);

const AgentLoading = () => <RepairLoader variant="panel" label="Cargando instrucciones" />;

const SectionCard: React.FC<{
  section: Section;
  index: number;
  total: number;
  autoEdit: boolean;
  focused: boolean;
  focusRequest: number;
  display: { expanded: boolean; revision: number };
  onUpdate: (id: string, value: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
}> = ({ section, index, total, autoEdit, focused, focusRequest, display, onUpdate, onDelete, onDuplicate, onMove }) => {
  const [open, setOpen] = useState(autoEdit || display.expanded);
  const [mode, setMode] = useState<EditorMode>(autoEdit ? "edit" : "preview");
  const [deleteArmed, setDeleteArmed] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const previewContent = useDeferredValue(section.content);

  useEffect(() => {
    if (display.revision > 0) setOpen(display.expanded);
  }, [display]);

  useEffect(() => {
    if (!focused) return;
    setOpen(true);
    cardRef.current?.scrollIntoView({ block: "start" });
  }, [focused, focusRequest]);

  const lines = section.content.split("\n");
  const firstLine = lines.find((line) => line.trim().length > 0) || "";
  const headerMatch = firstLine.match(/^(#{1,6})\s+(.*)/);
  const title = headerMatch ? headerMatch[2] : firstLine.substring(0, 60) || "Sección sin título";
  const level = headerMatch ? headerMatch[1].length : 0;
  const words = countWords(section.content);

  useEffect(() => {
    if (!autoEdit) return;
    setOpen(true);
    setMode("edit");
    window.setTimeout(() => editorRef.current?.focus(), 0);
  }, [autoEdit]);

  useEffect(() => {
    if (!deleteArmed) return;
    const timeout = window.setTimeout(() => setDeleteArmed(false), 3500);
    return () => window.clearTimeout(timeout);
  }, [deleteArmed]);

  const openEditor = () => {
    setOpen(true);
    setMode("edit");
    window.setTimeout(() => editorRef.current?.focus(), 0);
  };

  const insertMarkdown = (before: string, after = "", fallback = "texto") => {
    const editor = editorRef.current;
    if (!editor) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = section.content.slice(start, end) || fallback;
    const next = `${section.content.slice(0, start)}${before}${selected}${after}${section.content.slice(end)}`;
    onUpdate(section.id, next);
    window.requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  return (
    <article ref={cardRef} data-collapsed={!open} className={`wt-section-card card scroll-mt-24 overflow-hidden transition ${focused ? "ring-2 ring-slate-300 ring-offset-2" : ""} ${open ? "border-slate-300 shadow-[var(--wt-shadow-md)]" : "hover:border-slate-300 hover:shadow-[var(--wt-shadow-sm)]"}`}>
      <div className="flex flex-wrap items-center gap-2 bg-white p-3 sm:flex-nowrap sm:p-4">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 basis-full items-center gap-3 rounded-xl text-left focus-visible:ring-2 focus-visible:ring-slate-950 sm:flex-1 sm:basis-auto"
          aria-expanded={open}
        >
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-black transition ${open ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <strong className="truncate text-sm font-extrabold text-slate-900 sm:text-base">{title}</strong>
              {level > 0 && <span className="hidden rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-500 sm:inline">H{level}</span>}
            </span>
            <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-400">
              {words} palabras · {section.content.length} caracteres
            </span>
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
        </button>

        <div className={`${open ? 'flex' : 'hidden sm:flex'} wt-section-actions shrink-0 items-center gap-0.5`}>
          <button type="button" onClick={() => onMove(section.id, -1)} disabled={index === 0} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-25" aria-label={`Subir ${title}`}><ArrowUp className="h-4 w-4" /></button>
          <button type="button" onClick={() => onMove(section.id, 1)} disabled={index === total - 1} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-25" aria-label={`Bajar ${title}`}><ArrowDown className="h-4 w-4" /></button>
          <button type="button" onClick={() => onDuplicate(section.id)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900" aria-label={`Duplicar ${title}`}><Copy className="h-4 w-4" /></button>
          <button type="button" onClick={openEditor} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900" aria-label={`Editar ${title}`}><Edit3 className="h-4 w-4" /></button>
          <button
            type="button"
            onClick={() => deleteArmed ? onDelete(section.id) : setDeleteArmed(true)}
            className={`rounded-lg p-2 transition ${deleteArmed ? "bg-rose-600 text-white" : "text-slate-400 hover:bg-rose-50 hover:text-rose-600"}`}
            aria-label={deleteArmed ? `Confirmar eliminación de ${title}` : `Eliminar ${title}`}
            title={deleteArmed ? "Haz clic nuevamente para eliminar" : "Eliminar sección"}
          >
            {deleteArmed ? <Check className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50/70">
          <div className="flex flex-col gap-3 border-b border-slate-200/70 bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div className="wt-editor-modes inline-flex max-w-full rounded-xl bg-slate-100 p-1 sm:w-fit">
              <ModeButton active={mode === "edit"} onClick={() => setMode("edit")} icon={<AlignLeft className="h-3.5 w-3.5" />} label="Editar" />
              <ModeButton active={mode === "preview"} onClick={() => setMode("preview")} icon={<Eye className="h-3.5 w-3.5" />} label="Vista previa" />
              <ModeButton active={mode === "split"} onClick={() => setMode("split")} icon={<Columns2 className="h-3.5 w-3.5" />} label="Dividido" />
            </div>

            {(mode === "edit" || mode === "split") && (
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                <FormatButton label="Título" icon={<Type className="h-3.5 w-3.5" />} onClick={() => insertMarkdown("## ", "", "Título")} />
                <FormatButton label="Negrita" icon={<Bold className="h-3.5 w-3.5" />} onClick={() => insertMarkdown("**", "**")} />
                <FormatButton label="Lista" icon={<List className="h-3.5 w-3.5" />} onClick={() => insertMarkdown("- ", "", "Elemento")} />
                <FormatButton label="Separador" icon={<Minus className="h-3.5 w-3.5" />} onClick={() => insertMarkdown("\n---\n", "", "")} />
              </div>
            )}
          </div>

          <div className={mode === "split" ? "grid lg:grid-cols-2" : "block"}>
            {(mode === "edit" || mode === "split") && (
              <div className={mode === "split" ? "border-b border-slate-200 lg:border-b-0 lg:border-r" : ""}>
                <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-medium text-slate-500">
                  <span>Editor Markdown</span>
                  <span>Los cambios se guardan al pulsar Guardar</span>
                </div>
                <textarea
                  ref={editorRef}
                  aria-label={`Instrucciones de ${title}`}
                  value={section.content}
                  onChange={(event) => onUpdate(section.id, event.target.value)}
                  className="wt-agent-editor min-h-[300px] sm:min-h-[360px] w-full resize-y border-0 bg-white p-3 sm:p-5 font-mono text-base sm:text-sm leading-7 text-slate-700 shadow-none outline-none focus:ring-0"
                  placeholder="Escribe las instrucciones del agente en Markdown..."
                  spellCheck={false}
                />
              </div>
            )}

            {(mode === "preview" || mode === "split") && (
              <div className="min-h-[360px] bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                  <span>Vista previa del documento</span>
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="agent-markdown min-w-0 min-h-[240px] p-3 sm:min-h-[320px] sm:p-6">
                  <SectionPreview content={previewContent} />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-white px-4 py-2.5 text-[10px] font-medium text-slate-400">
            <span>{words} palabras · {section.content.length} caracteres</span>
            <span className="inline-flex items-center gap-1.5"><FileText className="h-3 w-3" /> Markdown compatible</span>
          </div>
        </div>
      )}
    </article>
  );
};

const PriceReference = ({ content }: { content: string }) => {
  const formatted = useMemo(() => {
    try { return JSON.stringify(JSON.parse(content), null, 2); } catch { return content; }
  }, [content]);
  return <div className="min-h-0 flex-1 bg-slate-50 p-4">
    {content.trim() ? <textarea readOnly aria-label="Datos de precios, solo lectura" value={formatted} className="h-full w-full resize-none rounded-xl border border-slate-200 bg-white p-4 font-mono text-xs leading-6 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300" /> : <p className="p-5 text-sm text-slate-500">Precios vacíos.</p>}
  </div>;
};

const SectionPreview = memo(({ content }: { content: string }) => <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>);
SectionPreview.displayName = "SectionPreview";

const ModeButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button type="button" onClick={onClick} aria-pressed={active} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition ${active ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>
    {icon}<span>{label}</span>
  </button>
);

const FormatButton: React.FC<{ label: string; icon: React.ReactNode; onClick: () => void }> = ({ label, icon, onClick }) => (
  <button type="button" onClick={onClick} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 transition hover:border-slate-400 hover:text-slate-950" title={label}>
    {icon}<span className="hidden sm:inline">{label}</span>
  </button>
);

export default AgentePage;
