import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings, Eye, EyeOff } from 'lucide-react';

interface ColumnSelectorProps {
  columns: string[];
  visibleColumns: string[];
  onToggleColumn: (column: string) => void;
  storageKey: string; // lo recibe, la persistencia la maneja el padre
}

type Rect = { top: number; left: number; width: number; height: number };

// micro turno para permitir re-render del padre entre toggles
const microTick = () =>
  new Promise<void>((r) => {
    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      requestAnimationFrame(() => r());
    } else {
      setTimeout(r, 0);
    }
  });

export const ColumnSelector: React.FC<ColumnSelectorProps> = ({
  columns,
  visibleColumns,
  onToggleColumn,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<Rect | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  /** === Medición del botón para portal === */
  const measure = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setAnchorRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    measure();
    const onScroll = () => measure();
    const onResize = () => measure();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [isOpen]);

  /** === Bulk helpers (secuenciales) === */
  const showAll = async () => {
    for (const col of columns) {
      if (!visibleColumns.includes(col)) {
        onToggleColumn(col);
        // eslint-disable-next-line no-await-in-loop
        await microTick();
      }
    }
  };

  const hideAll = async () => {
    const current = [...visibleColumns]; // snapshot
    for (const col of current) {
      onToggleColumn(col);
      // eslint-disable-next-line no-await-in-loop
      await microTick();
    }
  };

  /** === Cerrar con click fuera === */
  useEffect(() => {
    if (!isOpen) return;

    const onDocPointerDown = (e: MouseEvent | PointerEvent) => {
      const target = e.target as HTMLElement | null;
      // Ignorar clics en el botón
      if (btnRef.current && target && btnRef.current.contains(target)) return;
      // Ignorar clics dentro del panel
      if (panelRef.current && target && panelRef.current.contains(target)) return;
      setIsOpen(false);
    };

    document.addEventListener('mousedown', onDocPointerDown);
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => {
      document.removeEventListener('mousedown', onDocPointerDown);
      document.removeEventListener('pointerdown', onDocPointerDown);
    };
  }, [isOpen]);

  /** === Cerrar con Escape y manejo de foco inicial === */
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKey);

    // intentar enfocar el primer checkbox para accesibilidad
    const t = setTimeout(() => {
      panelRef.current?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.focus();
    }, 0);

    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  /** === UI === */
  const panel = isOpen && anchorRect ? (
    <div
      className="fixed inset-0 z-[100]"
      style={{ pointerEvents: 'none' }} // overlay sin bloquear scroll
      aria-hidden={!isOpen}
    >
      <div
        ref={panelRef}
        role="menu"
        aria-label="Selector de columnas"
        className="absolute z-[101] w-64 bg-white rounded-xl shadow-xl border border-gray-200 max-h-80 overflow-y-auto"
        style={{
          top: anchorRect.top + anchorRect.height + 8,
          left: Math.min(
            Math.max(8, anchorRect.left + anchorRect.width - 256), // 256px = w-64
            window.innerWidth - 8 - 256
          ),
          pointerEvents: 'auto', // el panel sí captura clics
        }}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Mostrar columnas</h3>
            <div className="flex space-x-1">
              <button
                onClick={showAll}
                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                Todas
              </button>
              <button
                onClick={hideAll}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                Ninguna
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {columns.map((column) => {
              const checked = visibleColumns.includes(column);
              return (
                <label
                  key={column}
                  className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleColumn(column)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex items-center space-x-2 flex-1">
                    {checked ? (
                      <Eye className="w-4 h-4 text-green-500" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-700">
                      {column.replace(/_/g, ' ')}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center space-x-2 px-4 py-2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls="column-selector-panel"
      >
        <Settings className="w-4 h-4" />
        <span className="text-sm font-medium">Columnas</span>
      </button>

      {typeof document !== 'undefined' ? createPortal(panel, document.body) : null}
    </div>
  );
};
