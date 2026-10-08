import { useContext } from 'react';
import { CountryContext } from './countryContext';
export function useCountryConfig() {
  const context = useContext(CountryContext);
  if (!context) throw new Error('No se ha cargado la configuración del país.');
  return context;
}
