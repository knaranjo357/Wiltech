import React, { ReactNode, useEffect, useState, useMemo } from "react";
import { AuthService } from '../services/authService';
import { useCountryConfig } from '../hooks/useCountryConfig';
import { canAccessCountryPage } from '../utils/countryConfig';
import { useAuth } from "../hooks/useAuth";
import {
  DollarSign,
  Bot,
  Users,
  Calendar,
  LogOut,
  Menu,
  X,
  Truck,
  MessageSquare,
  BarChart3,
  LucideIcon,
  BrainCircuit,
  ChevronLeft,
  LifeBuoy,
  UserCog,
  Wrench,
  Sliders,
  Globe,
  ChevronDown,
} from "lucide-react";

interface NavItem {
  id: string;
  name: string;
  icon: LucideIcon;
  group: "core" | "comms" | "ops" | "config";
  badge?: number | string;
}

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onPageChange: (page: string) => void;
}

const GROUP_LABELS: Record<string, string> = {
  core: "Principal",
  comms: "Comunicaciones",
  ops: "Operaciones",
  config: "Configuración",
};



const navigationItems: NavItem[] = [
  { id: "agenda", name: "Agenda", icon: Calendar, group: "core" },
  { id: "crm", name: "CRM", icon: Users, group: "core" },
  { id: "precios", name: "Precios", icon: DollarSign, group: "core" },
  { id: "whatsapp", name: "WhatsApp", icon: Bot, group: "comms" },
  { id: "conversaciones", name: "Conversaciones", icon: MessageSquare, group: "comms" },
  { id: "asistencia", name: "Asistencia", icon: LifeBuoy, group: "ops" },
  { id: "envios", name: "Envíos", icon: Truck, group: "ops" },
  { id: "resultados", name: "Resultados", icon: BarChart3, group: "ops" },
  { id: "reparaciones", name: "Reparaciones", icon: Wrench, group: "ops" },
  { id: "agente", name: "Agente IA", icon: BrainCircuit, group: "config" },
  { id: "diagnosticador_admin", name: "AI Diagnosticador", icon: Sliders, group: "config" },
  { id: "usuarios", name: "Usuarios", icon: UserCog, group: "config" },
  { id: "paises", name: "Configurar país", icon: Globe, group: "config" },
];

export const Layout: React.FC<LayoutProps> = ({ children, currentPage, onPageChange }) => {
  const { user, logout } = useAuth();
  const { config } = useCountryConfig();
  const countries = AuthService.getAllowedCountries();
  let activeCountry = '';
  try { activeCountry = AuthService.getPaisSede(); } catch { /* Select before mounting pages. */ }
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const desktopExpanded = sidebarPinned || sidebarHovered;
  const isCollapsed = !desktopExpanded && !sidebarOpen;

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const userInitial = useMemo(() => {
    return (user?.email?.[0] ?? "U").toUpperCase();
  }, [user?.email]);

  const filteredNavItems = useMemo(() => {
    return navigationItems.filter(item => canAccessCountryPage(item.id, user?.role, config));
  }, [user, config]);

  // Agrupar items por grupo
  const groupedItems = useMemo(() => {
    const groups: Record<string, NavItem[]> = {};
    for (const item of filteredNavItems) {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    }
    return groups;
  }, [filteredNavItems]);

  const currentNavItem = useMemo(
    () => navigationItems.find((item) => item.id === (currentPage === 'web1' ? 'conversaciones' : currentPage)),
    [currentPage],
  );

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900">

      {/* === Mobile Overlay === */}
      <div
        className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* === Sidebar === */}
      <aside
        onMouseEnter={() => {
          if (!sidebarPinned) setSidebarHovered(true);
        }}
        onMouseLeave={() => setSidebarHovered(false)}
        className={`
          fixed inset-y-0 left-0 z-50 bg-zinc-950 text-white shadow-[18px_0_60px_-36px_rgba(0,0,0,0.65)]
          border-r border-white/10
          transform transition-all duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
          ${isCollapsed ? "w-[72px]" : "w-[260px]"}
        `}
      >
        <div className="flex flex-col h-full">

          {/* Sidebar Header */}
          <div className={`flex min-h-[56px] items-center p-3 border-b border-white/10 ${isCollapsed ? "justify-center" : "justify-between"}`}>
            <div className={`flex min-w-0 items-center ${isCollapsed ? "w-11 justify-start overflow-hidden" : "gap-3"}`}>
              <img
                src="/images/logowiltech.png"
                alt="Wiltech"
                width="1024"
                height="576"
                className={`shrink-0 object-contain ${isCollapsed ? "h-11 w-11" : "h-11 w-24"}`}
              />
              {!isCollapsed && (
                <a
                  href="https://alliasoft.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-[9px] font-semibold tracking-[0.08em] text-zinc-500 transition hover:text-zinc-200"
                  onClick={(event) => event.stopPropagation()}
                >
                  alliasoft.com
                </a>
              )}
            </div>

            {/* Collapse toggle (Desktop) */}
            <button
              onClick={() => {
                setSidebarPinned((pinned) => !pinned);
                setSidebarHovered(false);
              }}
              className={`hidden md:flex absolute -right-3 top-7 bg-zinc-900 border border-zinc-700 rounded-full p-1.5 shadow-lg hover:bg-white hover:text-black transition-all duration-300 z-50 ${isCollapsed ? "rotate-180" : ""
                }`}
              aria-label={sidebarPinned ? "Permitir cierre automático" : "Mantener navegación abierta"}
              aria-pressed={sidebarPinned}
              aria-expanded={desktopExpanded}
              title={sidebarPinned ? "Cerrar y volver a apertura automática" : "Mantener abierto"}
            >
              <ChevronLeft className="w-3 h-3" />
            </button>

            {/* Close (Mobile) */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-2 hover:bg-white/10 rounded-xl transition-colors"
              aria-label="Cerrar navegación"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>

          {AuthService.isRoot() && countries.length > 1 && (
            <div className="shrink-0 border-b border-white/10 p-3">
              <div className={`group relative rounded-xl border border-white/[0.08] bg-white/[0.04] transition-colors hover:border-white/20 hover:bg-white/[0.07] focus-within:ring-2 focus-within:ring-white/40 ${isCollapsed ? "h-11" : "px-3 py-1"}`}>
                {isCollapsed && (
                  <Globe aria-hidden="true" className="pointer-events-none absolute inset-0 m-auto h-[18px] w-[18px] text-zinc-400 group-hover:text-white" />
                )}
                <select
                  id="sidebar-country"
                  aria-label="País de trabajo"
                  title={`País de trabajo: ${activeCountry}`}
                  value={activeCountry}
                  onChange={event => {
                    if (event.target.value === activeCountry) return;
                    const destination = new URL(window.location.href);
                    destination.searchParams.set('pais_trabajo', event.target.value);
                    window.location.assign(destination.toString());
                  }}
                  className={isCollapsed
                    ? "absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    : "w-full cursor-pointer appearance-none bg-transparent py-2 pr-6 text-sm font-medium text-zinc-100 outline-none"}
                  style={{ colorScheme: 'dark' }}
                >
                  {countries.map(country => <option className="bg-zinc-900 text-zinc-100" key={country} value={country}>{country}</option>)}
                </select>
                {!isCollapsed && <ChevronDown aria-hidden="true" className="pointer-events-none absolute bottom-3.5 right-3 h-3.5 w-3.5 text-zinc-500" />}
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden custom-scrollbar space-y-1" aria-label="Navegación principal">
            {Object.entries(groupedItems).map(([groupKey, items], groupIdx) => (
              <div key={groupKey}>
                {/* Group separator */}
                {!isCollapsed && groupIdx > 0 && (
                  <div className="pt-4 pb-2 px-3">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">
                      {GROUP_LABELS[groupKey] || groupKey}
                    </span>
                  </div>
                )}
                {isCollapsed && groupIdx > 0 && (
                  <div className="my-3 mx-3 border-t border-white/10" />
                )}

                {items.map((item) => {
                  const isActive = currentPage === item.id || (currentPage === 'web1' && item.id === 'conversaciones');
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onPageChange(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`
                        group relative flex items-center w-full rounded-xl transition-all duration-200
                        ${isCollapsed ? "justify-center px-2 py-3" : "justify-start px-3 py-2.5 gap-3"}
                        ${isActive
                          ? "bg-white text-zinc-950 shadow-[0_10px_25px_-12px_rgba(255,255,255,0.42)]"
                          : "text-zinc-400 hover:bg-white/[0.07] hover:text-white"
                        }
                      `}
                      aria-current={isActive ? "page" : undefined}
                      aria-label={item.name}
                    >
                      <item.icon
                        className={`w-[18px] h-[18px] shrink-0 transition-colors ${isActive ? "text-black" : "text-zinc-500 group-hover:text-white"
                          }`}
                      />

                      {!isCollapsed && (
                        <div className="flex items-center justify-between flex-1 min-w-0">
                          <span className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                            {item.name}
                          </span>
                          {item.badge && (
                            <span className={`
                              px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0
                              ${isActive
                                ? 'bg-black/10 text-black'
                                : 'bg-white/10 text-zinc-300 group-hover:bg-white/15'}
                            `}>
                              {item.badge}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Tooltip collapsed */}
                      {isCollapsed && (
                        <div className="absolute left-full ml-3 px-3 py-2 bg-black text-white text-xs font-semibold rounded-xl shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 whitespace-nowrap z-50 translate-x-1 group-hover:translate-x-0 ring-1 ring-white/10">
                          {item.name}
                          <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-black" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

            {filteredNavItems.length === 0 && (
              <div className="p-4 text-center text-zinc-500 text-sm italic">
                {!isCollapsed && "No tienes permisos disponibles."}
              </div>
            )}
          </nav>

          {/* User Footer */}
          <div className="p-3 border-t border-white/10 bg-black/20">
            <div className={`rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2.5 ${isCollapsed ? "px-2" : ""}`}>
            <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0 ring-1 ring-white/20"
                  title={user?.email}
                >
                  <span className="text-black font-black text-xs">{userInitial}</span>
                </div>

                {!isCollapsed && (
                  <div className="flex flex-col min-w-0">
                    <span
                      className="text-xs font-semibold text-zinc-200 truncate block max-w-[120px]"
                      title={user?.email}
                    >
                      {user?.email || "Usuario"}
                    </span>
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1.5 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Conectado
                    </span>
                  </div>
                )}
              </div>

              {!isCollapsed && (
                <button
                  onClick={logout}
                  className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>

            {isCollapsed && (
              <button
                onClick={logout}
                className="mt-2 w-full p-2 flex justify-center text-zinc-500 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
            </div>
          </div>
        </div>
      </aside>

      {/* === Main Content === */}
      <div className={`transition-[margin] duration-300 ${sidebarPinned ? "md:ml-[260px]" : "md:ml-[72px]"}`}>

        <a href="#main-content" className="wt-skip-link">Saltar al contenido</a>

        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-30 bg-zinc-950/95 text-white backdrop-blur-xl shadow-lg border-b border-white/10 h-16 flex items-center px-4 justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-1 text-zinc-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            aria-label="Abrir navegación"
            aria-expanded={sidebarOpen}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/images/logowiltech.png" alt="Wiltech" width="1024" height="576" className="h-8 w-auto max-w-[94px] object-contain" />
            <span className="truncate text-sm font-bold tracking-tight">{currentNavItem?.name ?? "Wiltech"}</span>
          </div>
          <div className="w-9" />
        </header>

        {/* Page Content */}
        <main id="main-content" tabIndex={-1} className="wt-workspace w-full min-w-0 flex-1 outline-none">
          {activeCountry ? children : <p role="alert" className="p-6">Tu sesión no tiene países asignados. Vuelve a iniciar sesión.</p>}
        </main>
      </div>
    </div>
  );
};
