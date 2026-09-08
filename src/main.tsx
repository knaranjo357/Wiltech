import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthService } from './services/authService';

// Apply the country only after navigation completes, so cancelling an unsaved-work
// warning cannot change the country underneath the current screen.
const startupUrl = new URL(window.location.href);
const requestedCountry = startupUrl.searchParams.get('pais_trabajo');
if (requestedCountry !== null) {
  if (AuthService.getAllowedCountries().includes(requestedCountry)) AuthService.setPaisSede(requestedCountry);
  startupUrl.searchParams.delete('pais_trabajo');
  window.history.replaceState(null, '', startupUrl.pathname + startupUrl.search + startupUrl.hash);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
