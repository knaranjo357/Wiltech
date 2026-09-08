import React from 'react';
import { X } from 'lucide-react';
import { PrecioItem } from '../types/precios';
import { ModalPortal } from './ModalPortal';

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
    <ModalPortal open={isOpen} onClose={onClose} className="max-w-5xl flex flex-col" ariaLabel={`Detalle de ${title}`}>
        {/* Header */}
        <div className="bg-zinc-950 px-5 py-5 text-white sm:px-7">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-black tracking-tight truncate">{title}</h2>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500 truncate">{categoryName}</p>
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
        <div className="p-5 sm:p-7 overflow-auto flex-1 custom-scrollbar">
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
                <div key={key} className={`bg-slate-50 rounded-2xl p-4 border border-slate-200/70 ${colSpan}`}>
                  <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.16em] mb-2">
                    {label}
                  </h3>
                  <p className="text-sm font-bold text-slate-900 break-words">
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
    </ModalPortal>
  );
};
