import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { LoginForm } from "./components/LoginForm";
import { Layout } from "./components/Layout";

// Importación de Páginas
import { PreciosPage } from "./pages/PreciosPage";
import { CRMPage } from "./pages/CRMPage";
import { AgendaPage } from "./pages/AgendaPage";
import { EnviosPage } from "./pages/EnviosPage";
import { Resultados } from "./pages/Resultados";
import { WppPage } from "./pages/WppPage";
import { AgentePage } from "./pages/AgentePage";
import ConversacionesPage from "./pages/ConversacionesPage";
import Web1ConversacionesPage from "./pages/Web1ConversacionesPage";
import { AsistenciaPage } from "./pages/AsistenciaPage";
import { UsuariosPage } from "./pages/UsuariosPage";

// 1. DEFINICIÓN DE CLAVES (Deben coincidir con los roles del Backend)
type PageKey = 
  | "precios" 
  | "whatsapp" // IMPORTANTE: Coincide con el rol del backend
  | "crm" 
  | "agenda" 
  | "envios" 
  | "resultados" 
  | "agente" 
  | "conversaciones"
  | "web1" 
  | "asistencia"
  | "usuarios";

function App() {
  const { user, loading, isAuthenticated } = useAuth();

  // 2. MAPEO RUTA -> CLAVE INTERNA
  const pathToPage = useMemo<Record<string, PageKey>>(
    () => ({
      "/precios": "precios",
      "/wpp": "whatsapp", // URL /wpp carga el módulo 'whatsapp'
      "/crm": "crm",
      "/agenda": "agenda",
      "/envios": "envios",
      "/resultados": "resultados",
      "/agente": "agente",
      "/conversaciones": "conversaciones",
      "/web1": "web1",
      "/asistencia": "asistencia",
      "/usuarios": "usuarios",
    }),
    []
  );

  // 3. MAPEO CLAVE INTERNA -> RUTA
  const pageToPath = useMemo<Record<PageKey, string>>(
    () => ({
      precios: "/precios",
      whatsapp: "/wpp",
      crm: "/crm",
      agenda: "/agenda",
      envios: "/envios",
      resultados: "/resultados",
      agente: "/agente",
      conversaciones: "/conversaciones",
      web1: "/web1",
      asistencia: "/asistencia",
      usuarios: "/usuarios",
    }),
    []
  );

  // 4. LÓGICA DE PÁGINA INICIAL SEGÚN ROLES
  const getFirstAllowedPage = (): PageKey => {
    if (!user || !user.role) return "precios"; // Fallback genérico si no hay user
    
    const roles = user.role.split(',').map(r => r.trim().toLowerCase());
    
    // Si es admin, su default puede ser Agenda (o lo que prefieras)
    if (roles.includes('admin')) return "agenda";

    // Si no es admin, buscamos el primer rol que coincida con una página válida
    const validRole = roles.find(r => r in pageToPath) as PageKey | undefined;
    
    // Retornamos el primer rol válido encontrado, o 'precios' como último recurso
    return validRole || "precios";
  };

  // Inicialización del estado
  const [currentPage, setCurrentPage] = useState<PageKey>(() => {
    const path = window.location.pathname;
    // Si la URL es válida, intentamos usarla, si no, calculamos dinámicamente
    if (path in pathToPage) return pathToPage[path];
    return "agenda"; // Valor temporal, el useEffect lo corregirá inmediatamente
  });

  // Manejar navegación del navegador (atrás/adelante)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === "/login") return;
      if (path in pathToPage) {
        setCurrentPage(pathToPage[path]);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [pathToPage]);

  // === GUARD DE SEGURIDAD Y REDIRECCIÓN ===
  useEffect(() => {
    if (loading) return;

    const path = window.location.pathname;

    // A. NO AUTENTICADO
    if (!isAuthenticated) {
      if (path !== "/login") {
        window.history.replaceState(null, "", "/login");
      }
      return;
    }

    // B. AUTENTICADO
    if (isAuthenticated) {
      // 1. Si está en login, sacarlo de ahí
      if (path === "/login") {
        const targetPage = getFirstAllowedPage();
        setCurrentPage(targetPage);
        window.history.replaceState(null, "", pageToPath[targetPage]);
        return;
      }

      // 2. Verificar Permisos
      if (user?.role) {
        const userRoles = user.role.split(',').map(r => r.trim().toLowerCase());
        const pageKeyToCheck = pathToPage[path] || currentPage;

        const isAdmin = userRoles.includes('admin');
        const hasSpecificRole = userRoles.includes(pageKeyToCheck);

        if (!isAdmin && !hasSpecificRole) {
          console.warn(`Acceso denegado a: ${pageKeyToCheck}. Redirigiendo...`);
          
          // Encontrar ruta segura
          const safePage = getFirstAllowedPage();
          
          setCurrentPage(safePage);
          window.history.replaceState(null, "", pageToPath[safePage]);
        } 
        // Caso especial: Si la URL no coincide con el estado actual (sincronización inicial)
        else if (path in pathToPage && pathToPage[path] !== currentPage) {
             setCurrentPage(pathToPage[path]);
        }
      }
    }
  }, [loading, isAuthenticated, user, pathToPage, pageToPath, currentPage]);

  const handlePageChange = (page: string) => {
    const p = page as PageKey;
    if (pageToPath[p]) {
      setCurrentPage(p);
      window.history.pushState(null, "", pageToPath[p]);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Cargando...</div>;
  if (!isAuthenticated) return <LoginForm />;

  // 5. RENDERIZADO SEGURO
  const renderPage = () => {
    // Verificación extra antes de renderizar (Doble check de seguridad)
    if (user?.role) {
      const userRoles = user.role.split(',').map(r => r.trim().toLowerCase());
      const isAdmin = userRoles.includes('admin');
      
      // Si no es admin y no tiene el rol de la página actual, NO renderizar nada (o un error)
      // Esto evita que se vea la Agenda por milisegundos
      if (!isAdmin && !userRoles.includes(currentPage)) {
        return <div className="flex h-full items-center justify-center">Verificando permisos...</div>;
      }
    }

    switch (currentPage) {
      case "precios": return <PreciosPage />;
      case "whatsapp": return <WppPage />; // Clave 'whatsapp'
      case "crm": return <CRMPage />;
      case "agenda": return <AgendaPage />;
      case "envios": return <EnviosPage />;
      case "resultados": return <Resultados />;
      case "agente": return <AgentePage />;
      case "conversaciones": return <ConversacionesPage />;
      case "web1": return <Web1ConversacionesPage />;
      case "asistencia": return <AsistenciaPage />;
      case "usuarios": return <UsuariosPage />;
      default: 
        // En lugar de Agenda, retornamos null o redirección visual si algo falla
        return null;
    }
  };

  return (
    <Layout currentPage={currentPage} onPageChange={handlePageChange}>
      {renderPage()}
    </Layout>
  );
}

export default App;