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
  Globe, // <--- Icono para Web 1
} from "lucide-react";

interface NavItem {
  id: string;
  name: string;
  icon: LucideIcon;
}

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onPageChange: (page: string) => void;
}

// Configuración de items del menú
const navigationItems: NavItem[] = [
  { id: "wpp", name: "WhatsApp", icon: Bot },
  { id: "precios", name: "Precios", icon: DollarSign },
  { id: "crm", name: "CRM", icon: Users },
  { id: "conversaciones", name: "Conversaciones", icon: MessageSquare },
  { id: "web1", name: "Web 1", icon: Globe }, // <--- Nuevo item Web 1
  { id: "agenda", name: "Agenda", icon: Calendar },
  { id: "asistencia", name: "Asistencia", icon: LifeBuoy },
  { id: "envios", name: "Envíos", icon: Truck },
  { id: "resultados", name: "Resultados", icon: BarChart3 },
  { id: "agente", name: "Agente IA", icon: BrainCircuit }, // <--- Descomentado
];

export const Layout: React.FC<LayoutProps> = ({ children, currentPage, onPageChange }) => {
  const { user, logout } = useAuth();
  
  // Controla si el sidebar está visible en móvil
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Controla si el sidebar está minimizado en escritorio
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Calcula la inicial del usuario para el avatar
  const userInitial = useMemo(() => {
    return (user?.email?.[0] ?? "U").toUpperCase();
  }, [user?.email]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      
      {/* === Mobile overlay === */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
          sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* === Sidebar === */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 bg-white/90 backdrop-blur-xl shadow-2xl border-r border-gray-200/50 
          transform transition-all duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} 
          md:translate-x-0 
          ${isCollapsed ? "w-20" : "w-64"} 
        `}
      >
        <div className="flex flex-col h-full">
          
          {/* -- Header Sidebar -- */}
          <div className={`flex items-center p-6 border-b border-gray-200/50 ${isCollapsed ? "justify-center" : "justify-between"}`}>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shrink-0">
                <Bot className="w-6 h-6 text-white" />
              </div>
              
              {/* Texto Logo (oculto si colapsado) */}
              <span 
                className={`text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent whitespace-nowrap overflow-hidden transition-all duration-300
                ${isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}
              >
                Wiltech
              </span>
            </div>

            {/* Botón Toggle Desktop */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`hidden md:flex absolute -right-3 top-8 bg-white border border-gray-200 rounded-full p-1 shadow-md hover:bg-gray-50 transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`}
              title={isCollapsed ? "Expandir menú" : "Colapsar menú"}
            >
              <ChevronLeft className="w-3 h-3 text-gray-500" />
            </button>

            {/* Botón Cerrar Móvil */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* -- Navigation Items -- */}
          <nav className="flex-1 p-3 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
            {navigationItems.map((item) => {
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
                    ${isCollapsed ? "justify-center px-2 py-3" : "justify-start px-4 py-3 space-x-3"}
                    ${isActive 
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md" 
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"}
                  `}
                >
                  <item.icon
                    className={`w-5 h-5 shrink-0 transition-colors ${
                      isActive ? "text-white" : "text-gray-500 group-hover:text-gray-700"
                    }`}
                  />
                  
                  {/* Texto normal */}
                  {!isCollapsed && (
                    <span className="font-medium whitespace-nowrap animate-fadeIn">
                      {item.name}
                    </span>
                  )}

                  {/* Tooltip Hover (Colapsado) */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-4 px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50">
                      {item.name}
                      <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-gray-800" />
                    </div>
                  )}
                </button>
              );
            })}
          </nav>

          {/* -- User Footer -- */}
          <div className="p-4 border-t border-gray-200/50 bg-gray-50/50">
            <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-9 h-9 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center shadow-sm shrink-0" title={user?.email}>
                  <span className="text-white font-bold text-sm">
                    {userInitial}
                  </span>
                </div>
                
                {!isCollapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-gray-700 truncate block max-w-[100px]">
                      {user?.email || "Usuario"}
                    </span>
                    <span className="text-xs text-green-500 font-medium truncate">
                      Conectado
                    </span>
                  </div>
                )}
              </div>
              
              {!isCollapsed && (
                <button
                  onClick={logout}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              )}
            </div>
            
            {/* Botón Logout (Colapsado) */}
            {isCollapsed && (
              <button
                onClick={logout}
                className="mt-3 w-full p-2 flex justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Cerrar sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* === Main Content Wrapper === */}
      <div className={`transition-all duration-300 ${isCollapsed ? "md:ml-20" : "md:ml-64"}`}>
        
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200/50 h-16 flex items-center px-6 justify-between md:justify-end">
          {/* Botón Menu Móvil */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
        </header>

        {/* Content */}
        <main className="p-4 sm:p-6 lg:p-8 animate-fadeIn">
          {children}
        </main>
      </div>
    </div>
  );
};