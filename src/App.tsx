import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { LoginForm } from "./components/LoginForm";
import { Layout } from "./components/Layout";
import { PreciosPage } from "./pages/PreciosPage";
import { CRMPage } from "./pages/CRMPage";
import { AgendaPage } from "./pages/AgendaPage";
import { EnviosPage } from "./pages/EnviosPage";
import { Resultados } from "./pages/Resultados";
import { WppPage } from "./pages/WppPage";
import { AgentePage } from "./pages/AgentePage";
import ConversacionesPage from "./pages/ConversacionesPage";
import Web1ConversacionesPage from "./pages/Web1ConversacionesPage"; // <--- Importado
import { AsistenciaPage } from "./pages/AsistenciaPage";

type PageKey = 
  | "precios" 
  | "wpp" 
  | "crm" 
  | "agenda" 
  | "envios" 
  | "resultados" 
  | "agente" 
  | "conversaciones"
  | "web1" // <--- Agregado
  | "asistencia";

function App() {
  const { loading, isAuthenticated } = useAuth();

  // Mapeos ruta <-> página
  const pathToPage = useMemo<Record<string, PageKey>>(
    () => ({
      "/precios": "precios",
      "/wpp": "wpp",
      "/crm": "crm",
      "/agenda": "agenda",
      "/envios": "envios",
      "/resultados": "resultados",
      "/agente": "agente",
      "/conversaciones": "conversaciones",
      "/web1": "web1", // <--- Ruta mapeada
      "/asistencia": "asistencia",
    }),
    []
  );

  const pageToPath = useMemo<Record<PageKey, string>>(
    () => ({
      precios: "/precios",
      wpp: "/wpp",
      crm: "/crm",
      agenda: "/agenda",
      envios: "/envios",
      resultados: "/resultados",
      agente: "/agente",
      conversaciones: "/conversaciones",
      web1: "/web1", // <--- Path mapeado
      asistencia: "/asistencia",
    }),
    []
  );

  const DEFAULT_PAGE: PageKey = "precios";

  // Página inicial según URL
  const initialPage: PageKey = useMemo(() => {
    const path = window.location.pathname;
    if (path in pathToPage) return pathToPage[path];
    return DEFAULT_PAGE;
  }, [pathToPage]);

  const [currentPage, setCurrentPage] = useState<PageKey>(initialPage);

  // Manejar navegación con botón atrás/adelante
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === "/login") return;
      const page = pathToPage[path] ?? DEFAULT_PAGE;
      setCurrentPage(page);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [pathToPage]);

  // Guard de autenticación
  useEffect(() => {
    if (loading) return;
    const path = window.location.pathname;

    if (!isAuthenticated) {
      if (path !== "/login") {
        window.history.pushState(null, "", "/login");
      }
      return;
    }

    if (isAuthenticated && path === "/login") {
      const target = pageToPath[currentPage] ?? pageToPath[DEFAULT_PAGE];
      window.history.pushState(null, "", target);
    }
  }, [loading, isAuthenticated, currentPage, pageToPath]);

  const handlePageChange = (page: string) => {
    const p = (page as PageKey) ?? DEFAULT_PAGE;
    setCurrentPage(p);
    const target = pageToPath[p] ?? pageToPath[DEFAULT_PAGE];
    window.history.pushState(null, "", target);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
          <span className="text-gray-600">Cargando...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case "precios":
        return <PreciosPage />;
      case "wpp":
        return <WppPage />;
      case "crm":
        return <CRMPage />;
      case "agenda":
        return <AgendaPage />;
      case "envios":
        return <EnviosPage />;
      case "resultados":
        return <Resultados />;
      case "agente":
        return <AgentePage />;
      case "conversaciones":
        return <ConversacionesPage />;
      case "web1":
        return <Web1ConversacionesPage />; // <--- Renderizado Web 1
      case "asistencia":
        return <AsistenciaPage />;
      default:
        return <PreciosPage />;
    }
  };

  return (
    <Layout currentPage={currentPage} onPageChange={handlePageChange}>
      {renderPage()}
    </Layout>
  );
}

export default App;