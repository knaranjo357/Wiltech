import React, { useState, useEffect } from 'react';
import { Settings, Eye, EyeOff } from 'lucide-react';

interface ColumnSelectorProps {
  columns: string[];
  visibleColumns: string[];
  onToggleColumn: (column: string) => void;
  storageKey: string;
}

export const ColumnSelector: React.FC<ColumnSelectorProps> = ({
  columns,
  visibleColumns,
  onToggleColumn,
  storageKey
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const showAll = () => {
    columns.forEach(column => {
      if (!visibleColumns.includes(column)) {
        onToggleColumn(column);
      }
    });
  };

  const hideAll = () => {
    visibleColumns.forEach(column => {
      onToggleColumn(column);
    });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
      >
        <Settings className="w-4 h-4" />
        <span className="text-sm font-medium">Columnas</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-80 overflow-y-auto">
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
                {columns.map((column) => (
                  <label
                    key={column}
                    className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(column)}
                      onChange={() => onToggleColumn(column)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex items-center space-x-2 flex-1">
                      {visibleColumns.includes(column) ? (
                        <Eye className="w-4 h-4 text-green-500" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="text-sm text-gray-700">{column.replace('_', ' ')}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};