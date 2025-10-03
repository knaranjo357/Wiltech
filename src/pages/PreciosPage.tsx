import React, { useState, useEffect } from 'react';
import { Smartphone, Watch, Monitor, Tablet, Zap, Shield, Wrench, DollarSign, Edit2, Save, X } from 'lucide-react';
import { PreciosService } from '../services/preciosService';
import { PrecioItem } from '../types/precios';
import { PrecioModal } from '../components/PrecioModal';

const categories = [
  { name: 'IPHONE', icon: Smartphone, color: 'from-blue-500 to-purple-600', image: 'https://images.pexels.com/photos/788946/pexels-photo-788946.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { name: 'WATCH', icon: Watch, color: 'from-green-500 to-teal-600', image: 'https://images.pexels.com/photos/437037/pexels-photo-437037.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { name: 'PC', icon: Monitor, color: 'from-purple-500 to-pink-600', image: 'https://images.pexels.com/photos/2148217/pexels-photo-2148217.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { name: 'IPAD', icon: Tablet, color: 'from-orange-500 to-red-600', image: 'https://images.pexels.com/photos/1334597/pexels-photo-1334597.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { name: 'UGREEN', icon: Zap, color: 'from-yellow-500 to-orange-600', image: 'https://images.pexels.com/photos/163100/circuit-circuit-board-resistor-computer-163100.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { name: 'DIAGNOSTICO', icon: Wrench, color: 'from-indigo-500 to-blue-600', image: 'https://images.pexels.com/photos/159298/gears-cogs-machine-machinery-159298.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { name: 'PELICULAS DE SEGURIDAD', icon: Shield, color: 'from-teal-500 to-cyan-600', image: 'https://images.pexels.com/photos/1476321/pexels-photo-1476321.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { name: 'PRECIOS PARA REPARACIONES ELECT', icon: DollarSign, color: 'from-pink-500 to-rose-600', image: 'https://images.pexels.com/photos/5380664/pexels-photo-5380664.jpeg?auto=compress&cs=tinysrgb&w=400' },
];

export const PreciosPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [precios, setPrecios] = useState<PrecioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalItem, setModalItem] = useState<PrecioItem | null>(null);

  const fetchPrecios = async (category: string) => {
    setLoading(true);
    try {
      const data = await PreciosService.getPrecios(category);
      setPrecios(data);
    } catch (error) {
      console.error('Error fetching precios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (categoryName: string) => {
    setSelectedCategory(categoryName);
    fetchPrecios(categoryName);
  };

  const handleItemClick = (item: PrecioItem) => {
    setModalItem(item);
  };

  const getAllColumns = () => {
    if (precios.length === 0) return [];
    const allKeys = new Set<string>();
    precios.forEach(item => {
      Object.keys(item).forEach(key => {
        if (key !== 'row_number') {
          allKeys.add(key);
        }
      });
    });
    return Array.from(allKeys);
  };

  const columns = getAllColumns();

  if (!selectedCategory) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Lista de Precios
          </h1>
          <p className="text-gray-600 text-lg">Selecciona una categoría para ver los precios</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {categories.map((category) => {
            const IconComponent = category.icon;
            return (
              <div
                key={category.name}
                onClick={() => handleCategorySelect(category.name)}
                className="group cursor-pointer transform hover:scale-105 transition-all duration-300"
              >
                <div className="relative overflow-hidden rounded-3xl shadow-xl bg-white/90 backdrop-blur-sm border border-white/40 hover:shadow-2xl transition-all duration-300">
                  <div className="aspect-w-16 aspect-h-9 relative">
                    <img
                      src={category.image}
                      alt={category.name}
                      className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className={`absolute inset-0 bg-gradient-to-t ${category.color} opacity-80 group-hover:opacity-90 transition-opacity duration-300`} />
                  </div>
                  
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6">
                    <IconComponent className="w-12 h-12 mb-4 group-hover:scale-110 transition-transform duration-300" />
                    <h3 className="text-lg font-bold text-center leading-tight">
                      {category.name.replace(/_/g, ' ')}
                    </h3>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => setSelectedCategory(null)}
            className="text-blue-600 hover:text-blue-700 font-medium mb-2 transition-colors"
          >
            ← Volver a categorías
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {selectedCategory?.replace(/_/g, ' ')}
          </h1>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-white/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-blue-50">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column}
                      className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider"
                    >
                      {column.replace(/[_\n]/g, ' ').trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {precios.map((item, index) => (
                  <tr
                    key={item.row_number}
                    className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 transition-all duration-300 cursor-pointer"
                    onClick={() => handleItemClick(item)}
                  >
                    {columns.map((column) => (
                      <td key={column} className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {item[column as keyof PrecioItem] || '-'}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PrecioModal
        isOpen={!!modalItem}
        onClose={() => setModalItem(null)}
        item={modalItem}
        categoryName={selectedCategory || ''}
      />
    </div>
  );
};