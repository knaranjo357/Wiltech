import React, { useId, useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { CLIENT_STAGE_OPTIONS } from '../utils/clientHelpers';

interface StageAutocompleteProps {
  value: unknown;
  onChange: (value: string) => void;
  placeholder?: string;
}

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/_/g, ' ')
  .toLowerCase()
  .trim();

export const StageAutocomplete: React.FC<StageAutocompleteProps> = ({
  value,
  onChange,
  placeholder = 'Escribe o elige una etapa',
}) => {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const textValue = String(value ?? '');

  const filteredOptions = useMemo(() => {
    const query = normalize(textValue);
    if (!query) return CLIENT_STAGE_OPTIONS;
    return CLIENT_STAGE_OPTIONS.filter(({ value: optionValue, label }) =>
      normalize(optionValue).includes(query) || normalize(label).includes(query)
    );
  }, [textValue]);

  const selectOption = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    setActiveIndex(0);
  };

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <div className="relative">
        <input
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && filteredOptions[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
          autoComplete="off"
          value={textValue}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-10 text-sm text-slate-900 outline-none transition focus:border-slate-600 focus:bg-white focus:ring-2 focus:ring-slate-900/10 placeholder:text-slate-400"
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) => Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) => Math.max(current - 1, 0));
            } else if (event.key === 'Enter' && open && filteredOptions[activeIndex]) {
              event.preventDefault();
              selectOption(filteredOptions[activeIndex].value);
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
        <button
          type="button"
          aria-label="Mostrar etapas sugeridas"
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 transition hover:text-slate-900"
        >
          <ChevronsUpDown className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-[90] mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl shadow-slate-900/15"
        >
          {filteredOptions.length > 0 ? filteredOptions.map((option, index) => {
            const selected = normalize(textValue) === normalize(option.value);
            return (
              <button
                id={`${listboxId}-${index}`}
                type="button"
                role="option"
                aria-selected={selected}
                key={option.value}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option.value)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                  index === activeIndex ? 'bg-slate-950 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="font-semibold">{option.label}</span>
                {selected && <Check className="h-4 w-4" />}
              </button>
            );
          }) : (
            <div className="px-3 py-3 text-sm text-slate-500">
              Sin coincidencias. Puedes guardar “{textValue}” como valor personalizado.
            </div>
          )}
        </div>
      )}

      <p className="mt-1.5 px-0.5 text-[10px] font-medium text-slate-400">
        Campo abierto · elige una sugerencia para mantener los datos consistentes.
      </p>
    </div>
  );
};
