import React from 'react';
import { X } from 'lucide-react';
import { PrecioItem } from '../types/precios';

interface PrecioModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PrecioItem | null;
  categoryName: string;
}

export const PrecioModal: React.FC<PrecioModalProps> = ({
  isOpen,
  onClose,
  item,
  categoryName,
}) => {
  if (!isOpen || !item) return null;

  // Quita row_number y conserva el resto
  const fields = Object.entries(item).filter(([key]) => key !== 'row_number');

  // Título seguro (evita undefined)
  const title =
    (item as any).MODELO ??
    (item as any).modelo ??
    (item as any).REFERENCIA ??
    (item as any).referencia ??
    'Detalle';

  // Render de valor a prueba de objetos/undefined
  const renderValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') return 'No disponible';
    if (typeof value === 'object') {
      try { return JSON.stringify(value); } catch { return String(value); }
    }
    return String(value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/40 w-full max-w-5xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-bold truncate">{title}</h2>
              <p className="text-blue-100 truncate">{categoryName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-xl transition-colors"
              aria-label="Cerrar"
              title="Cerrar"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6 overflow-auto max-h-[75vh]">
          {/* Grid más denso para ver más campos a la vez */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {fields.map(([key, value]) => {
              const label = key.replace(/[_\n]/g, ' ').trim();
              const val = renderValue(value);
              // Si es texto largo (descripción/notas), que ocupe más ancho
              const isLong =
                typeof value === 'string' &&
                (value.length > 80 || /descripcion|detalle|observacion|nota/i.test(key));
              const colSpan = isLong ? 'sm:col-span-2 lg:col-span-2' : '';

              return (
                <div key={key} className={`bg-gray-50 rounded-xl p-4 border border-gray-100 ${colSpan}`}>
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                    {label}
                  </h3>
                  <p className="text-lg font-bold text-gray-900 break-words">
                    {val}
                  </p>
                </div>
              );
            })}
          </div>

          {fields.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              No hay datos para mostrar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
