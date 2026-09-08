import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { LoginForm } from "./components/LoginForm";
import { Layout } from "./components/Layout";
import { SessionReset } from './components/SessionReset';

// Importación de Páginas
const PreciosPage = lazy(() => import("./pages/PreciosPage").then((module) => ({ default: module.PreciosPage })));
const CRMPage = lazy(() => import("./pages/CRMPage").then((module) => ({ default: module.CRMPage })));
const AgendaPage = lazy(() => import("./pages/AgendaPage").then((module) => ({ default: module.AgendaPage })));
const EnviosPage = lazy(() => import("./pages/EnviosPage").then((module) => ({ default: module.EnviosPage })));
const Resultados = lazy(() => import("./pages/Resultados/index").then((module) => ({ default: module.Resultados })));
const WppPage = lazy(() => import("./pages/WppPage").then((module) => ({ default: module.WppPage })));
const AgentePage = lazy(() => import("./pages/AgenteWorkspacePage").then((module) => ({ default: module.AgentePage })));
const ConversacionesPage = lazy(() => import("./pages/ConversacionesPage"));
const Web1ConversacionesPage = lazy(() => import("./pages/Web1ConversacionesPage"));
const AsistenciaPage = lazy(() => import("./pages/AsistenciaPage").then((module) => ({ default: module.AsistenciaPage })));
const UsuariosPage = lazy(() => import("./pages/UsuariosPage").then((module) => ({ default: module.UsuariosPage })));
const Diagnosticador = lazy(() => import("./pages/Diagnosticador"));
const DiagnosticadorAdmin = lazy(() => import("./pages/DiagnosticadorAdmin"));
const ReparacionesPage = lazy(() => import("./pages/ReparacionesPage"));

import { CountryProvider, useCountryConfig } from './hooks/useCountryConfig';
import { canAccessCountryPage, COUNTRY_MODULES } from './utils/countryConfig';
import { AuthService } from './services/authService';
import { RepairLoader } from './components/RepairLoader';
const PaisesPage = lazy(() => import('./pages/PaisesPage'));


const pageToPath: Record<string, string> = {
  precios: '/precios', whatsapp: '/wpp', crm: '/crm', agenda: '/agenda',
  envios: '/envios', resultados: '/resultados', agente: '/agente',
  conversaciones: '/conversaciones', web1: '/web1', asistencia: '/asistencia',
  usuarios: '/usuarios', reparaciones: '/reparaciones', diagnosticador: '/diagnosticador',
  diagnosticador_admin: '/diagnosticador-admin', paises: '/paises',
};
const pathToPage = Object.fromEntries(Object.entries(pageToPath).map(([page, path]) => [path, page]));

function Workspace() {
  const { user } = useAuth();
  const { config } = useCountryConfig();
  const [currentPage, setCurrentPage] = useState(() => pathToPage[window.location.pathname] ?? 'agenda');
  const allowedPages = useMemo(() => [...COUNTRY_MODULES.map(module => module.page), 'paises'].filter(page => canAccessCountryPage(page, user?.role, config)), [config, user?.role]);
  const canOpen = (page: string) => allowedPages.includes(page);
  useEffect(() => {
    const onPop = () => {
      const next = pathToPage[window.location.pathname] ?? allowedPages[0];
      if (next !== currentPage && !window.dispatchEvent(new Event('app:before-navigate', { cancelable: true }))) {
        window.history.pushState(null, '', pageToPath[currentPage]); return;
      }
      if (next) setCurrentPage(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [currentPage, allowedPages]);
  useEffect(() => {
    if (!allowedPages.includes(currentPage) && allowedPages[0]) {
      setCurrentPage(allowedPages[0]);
      window.history.replaceState(null, '', pageToPath[allowedPages[0]]);
    } else if (allowedPages.includes(currentPage) && !pathToPage[window.location.pathname]) {
      window.history.replaceState(null, '', pageToPath[currentPage]);
    }
  }, [allowedPages, currentPage]);
  const handlePageChange = (page: string) => {
    if (!canOpen(page) || page === currentPage) return;
    if (!window.dispatchEvent(new Event('app:before-navigate', { cancelable: true }))) return;
    setCurrentPage(page);
    window.history.pushState(null, '', pageToPath[page]);
  };
  const renderPage = () => {
    if (!canOpen(currentPage)) return <div className="p-8 text-center text-slate-500">No hay módulos disponibles para tu usuario en este país. Contacta a root.</div>;
    switch (currentPage) {
      case 'precios': return <PreciosPage />;
      case 'whatsapp': return <WppPage />;
      case 'crm': return <CRMPage />;
      case 'agenda': return <AgendaPage />;
      case 'envios': return <EnviosPage />;
      case 'resultados': return <Resultados />;
      case 'agente': return <AgentePage />;
      case 'conversaciones': return <ConversacionesPage onOpenWeb={() => handlePageChange('web1')} />;
      case 'web1': return <Web1ConversacionesPage onOpenConversations={() => handlePageChange('conversaciones')} />;
      case 'asistencia': return <AsistenciaPage />;
      case 'usuarios': return <UsuariosPage />;
      case 'reparaciones': return <ReparacionesPage />;
      case 'diagnosticador': return <Diagnosticador />;
      case 'diagnosticador_admin': return <DiagnosticadorAdmin />;
      case 'paises': return <PaisesPage />;
      default: return null;
    }
  };
  return <Layout currentPage={currentPage} onPageChange={handlePageChange}><Suspense fallback={<RepairLoader variant="panel" label="Cargando módulo" />}>{renderPage()}</Suspense></Layout>;
}

function App() {
  const { loading, isAuthenticated } = useAuth();
  if (loading) return <RepairLoader />;
  if (!isAuthenticated) return <LoginForm />;
  let country: string;
  try { country = AuthService.getPaisSede(); }
  catch { return <SessionReset />; }
  return <CountryProvider key={country}><Workspace /></CountryProvider>;
}
export default App;
