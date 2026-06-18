import React, { ReactNode, useState, useMemo } from "react";
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
  Globe,
  UserCog,
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
  { id: "web1", name: "Web 1", icon: Globe, group: "comms" },
  { id: "asistencia", name: "Asistencia", icon: LifeBuoy, group: "ops" },
  { id: "envios", name: "Envíos", icon: Truck, group: "ops" },
  { id: "resultados", name: "Resultados", icon: BarChart3, group: "ops" },
  { id: "agente", name: "Agente IA", icon: BrainCircuit, group: "config" },
  { id: "usuarios", name: "Usuarios", icon: UserCog, group: "config" },
];

export const Layout: React.FC<LayoutProps> = ({ children, currentPage, onPageChange }) => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const userInitial = useMemo(() => {
    return (user?.email?.[0] ?? "U").toUpperCase();
  }, [user?.email]);

  const filteredNavItems = useMemo(() => {
    if (!user || !user.role) return [];
    const userRoles = user.role.split(",").map((r) => r.trim().toLowerCase());
    if (userRoles.includes("admin")) return navigationItems;
    return navigationItems.filter((item) => userRoles.includes(item.id));
  }, [user]);

  // Agrupar items por grupo
  const groupedItems = useMemo(() => {
    const groups: Record<string, NavItem[]> = {};
    for (const item of filteredNavItems) {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    }
    return groups;
  }, [filteredNavItems]);

  return (
    <div className="min-h-screen bg-slate-50">

      {/* === Mobile Overlay === */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* === Sidebar === */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 bg-white shadow-2xl
          border-r border-slate-200/60
          transform transition-all duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
          ${isCollapsed ? "w-[72px]" : "w-[260px]"}
        `}
      >
        <div className="flex flex-col h-full">

          {/* Sidebar Header */}
          <div className={`flex items-center p-5 border-b border-slate-100 ${isCollapsed ? "justify-center" : "justify-between"}`}>
            <div className="flex items-center gap-3">
              <div className={`bg-black rounded-xl flex items-center justify-center shadow-md shrink-0 overflow-hidden ${isCollapsed ? "w-10 h-10 p-1.5" : "w-10 h-10 p-1.5"}`}>
                <img
                  src="/images/logowiltech.png"
                  alt="Wiltech"
                  className="w-full h-full object-contain"
                />
              </div>
              {!isCollapsed && (
                <div>
                  <span className="font-extrabold text-slate-900 text-base tracking-tight leading-none">Wiltech</span>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Panel de Control</p>
                </div>
              )}
            </div>

            {/* Collapse toggle (Desktop) */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`hidden md:flex absolute -right-3 top-7 bg-white border border-slate-200 rounded-full p-1.5 shadow-md hover:bg-slate-50 hover:shadow-lg transition-all duration-300 z-50 ${isCollapsed ? "rotate-180" : ""
                }`}
            >
              <ChevronLeft className="w-3 h-3 text-slate-500" />
            </button>

            {/* Close (Mobile) */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 pb-3 overflow-y-auto overflow-x-hidden custom-scrollbar space-y-1">
            {Object.entries(groupedItems).map(([groupKey, items], groupIdx) => (
              <div key={groupKey}>
                {/* Group separator */}
                {!isCollapsed && groupIdx > 0 && (
                  <div className="pt-4 pb-2 px-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-300">
                      {GROUP_LABELS[groupKey] || groupKey}
                    </span>
                  </div>
                )}
                {isCollapsed && groupIdx > 0 && (
                  <div className="my-2 mx-3 border-t border-slate-100" />
                )}

                {items.map((item) => {
                  const isActive = currentPage === item.id;
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
                          ? "bg-slate-900 text-white shadow-[0_4px_14px_rgb(0,0,0,0.25)]"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        }
                      `}
                    >
                      <item.icon
                        className={`w-[18px] h-[18px] shrink-0 transition-colors ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600"
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
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'}
                            `}>
                              {item.badge}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Tooltip collapsed */}
                      {isCollapsed && (
                        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 whitespace-nowrap z-50 translate-x-1 group-hover:translate-x-0">
                          {item.name}
                          <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-slate-800" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

            {filteredNavItems.length === 0 && (
              <div className="p-4 text-center text-slate-400 text-sm italic">
                {!isCollapsed && "No tienes permisos disponibles."}
              </div>
            )}
          </nav>

          {/* User Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/30">
            <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-sm shrink-0 ring-2 ring-white"
                  title={user?.email}
                >
                  <span className="text-white font-bold text-xs">{userInitial}</span>
                </div>

                {!isCollapsed && (
                  <div className="flex flex-col min-w-0">
                    <span
                      className="text-sm font-semibold text-slate-700 truncate block max-w-[120px]"
                      title={user?.email}
                    >
                      {user?.email || "Usuario"}
                    </span>
                    <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Conectado
                    </span>
                  </div>
                )}
              </div>

              {!isCollapsed && (
                <button
                  onClick={logout}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>

            {isCollapsed && (
              <button
                onClick={logout}
                className="mt-3 w-full p-2 flex justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* === Main Content === */}
      <div className={`transition-all duration-300 ${isCollapsed ? "md:ml-[72px]" : "md:ml-[260px]"}`}>

        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-30 bg-white/85 backdrop-blur-xl shadow-sm border-b border-slate-200/50 h-14 flex items-center px-4 justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="bg-black p-1.5 rounded-lg flex items-center justify-center shadow-md">
            <img
              src="/images/logowiltech.png"
              alt="Wiltech"
              className="h-5 w-auto object-contain"
            />
          </div>
          <div className="w-9" />
        </header>

        {/* Page Content */}
        <main className="w-full flex-1">
          {children}
        </main>
      </div>
    </div>
  );
};