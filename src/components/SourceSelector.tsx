import React from 'react';
import { MapPin } from 'lucide-react';

export const SOURCE_TO_SEDE: Record<string, string> = {
  Wiltech: 'Bogotá',
  WiltechBga: 'Bucaramanga',
};

export const SOURCE_OPTIONS: Array<{ value: string; label: string; hint?: string }> = [
  { value: 'Wiltech', label: 'Wiltech', hint: 'Bogotá' },
  { value: 'WiltechBga', label: 'WiltechBga', hint: 'Bucaramanga' },
];

export type SourceSelectorProps = {
  value: string | null | undefined;
  onChange: (next: string) => void;
  compact?: boolean;
};

export const SourceSelector: React.FC<SourceSelectorProps> = ({ value, onChange, compact }) => {
  const current = value ?? '';
  return (
    <div className={`inline-flex items-center gap-2 ${compact ? '' : 'px-2 py-1.5'} rounded-xl border border-neutral-300 bg-white shadow-sm`}>
      <span className="text-xs text-neutral-500 hidden sm:inline">Source</span>
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm bg-transparent focus:outline-none"
        title="Selecciona el agente origen"
      >
        <option value="" disabled>Seleccionar…</option>
        {SOURCE_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}{opt.hint ? ` (${opt.hint})` : ''}
          </option>
        ))}
      </select>
      {!!current && SOURCE_TO_SEDE[current] && (
        <span className="inline-flex items-center gap-1 text-[11px] text-neutral-600">
          <MapPin className="w-3 h-3" /> {SOURCE_TO_SEDE[current]}
        </span>
      )}
    </div>
  );
};
