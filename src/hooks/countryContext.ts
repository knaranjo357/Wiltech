import { createContext } from 'react';
import type { CountryRecord } from '../services/countryService';
import type { CountryConfig } from '../utils/countryConfig';

interface CountryState {
  country: string;
  record: CountryRecord | null;
  config: CountryConfig;
  reload: () => Promise<void>;
}

export const CountryContext = createContext<CountryState | null>(null);
