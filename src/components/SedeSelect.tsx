import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown, MapPin } from 'lucide-react';

const PREDEFINED_SEDES = [
  'Bogotá',
  'Barrancabermeja',
  'Barranquilla',
  'Bucaramanga',
  'Medellín'
];

interface SedeSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export const SedeSelect: React.FC<SedeSelectProps> = ({
  value,
  onChange,
  className = '',
  placeholder = 'Selecciona o escribe una sede...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectOption = (opt: string) => {
    onChange(opt);
    setInputValue(opt);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val);
  };

  // Filter options based on typed input
  const filteredOptions = PREDEFINED_SEDES.filter(opt =>
    opt.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full text-sm bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all pl-3 pr-10 py-2.5"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-[200] mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto py-1">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleSelectOption(opt)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  <span>{opt}</span>
                </div>
                {value === opt && <Check className="w-4 h-4 text-blue-600" />}
              </button>
            ))
          ) : (
            <div className="px-4 py-2 text-xs text-gray-400 italic">
              Escribe para crear/usar "{inputValue}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};
