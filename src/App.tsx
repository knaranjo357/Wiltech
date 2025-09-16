import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { LoginForm } from './components/LoginForm';
import { Layout } from './components/Layout';
import { PreciosPage } from './pages/PreciosPage';
import { AgentePage } from './pages/AgentePage';
import { CRMPage } from './pages/CRMPage';
import { AgendaPage } from './pages/AgendaPage';

function App() {
  const { user, loading, isAuthenticated } = useAuth();
  const [currentPage, setCurrentPage] = useState(() => {
    const path = window.location.pathname;
    if (path === '/precios') return 'precios';
    if (path === '/agente') return 'agente';
    if (path === '/crm') return 'crm';
    if (path === '/agenda') return 'agenda';
    return 'precios';
  });

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/precios') setCurrentPage('precios');
      else if (path === '/agente') setCurrentPage('agente');
      else if (path === '/crm') setCurrentPage('crm');
      else if (path === '/agenda') setCurrentPage('agenda');
      else if (path === '/login') setCurrentPage('login');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handlePageChange = (page: string) => {
    setCurrentPage(page);
    window.history.pushState(null, '', `/${page}`);
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
    window.history.pushState(null, '', '/login');
    return <LoginForm />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'precios':
        return <PreciosPage />;
      case 'agente':
        return <AgentePage />;
      case 'crm':
        return <CRMPage />;
      case 'agenda':
        return <AgendaPage />;
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