import React, { useState, useMemo } from 'react';
import { 
  Smartphone, 
  Watch, 
  Monitor, 
  Tablet, 
  Zap, 
  Shield, 
  ArrowLeft, 
  Search, 
  Tag 
} from 'lucide-react';
import { PreciosService } from '../services/preciosService';
import { PrecioItem } from '../types/precios';
import { PrecioModal } from '../components/PrecioModal';

// Definición de categorías
const categories = [
  { 
    name: 'IPHONE', 
    icon: Smartphone, 
    gradient: 'from-blue-500 to-indigo-600', 
    image: 'https://images.pexels.com/photos/788946/pexels-photo-788946.jpeg?auto=compress&cs=tinysrgb&w=600' 
  },
  { 
    name: 'WATCH', 
    icon: Watch, 
    gradient: 'from-emerald-500 to-teal-600', 
    image: 'https://images.pexels.com/photos/437037/pexels-photo-437037.jpeg?auto=compress&cs=tinysrgb&w=600' 
  },
  { 
    name: 'PC', 
    icon: Monitor, 
    gradient: 'from-violet-500 to-fuchsia-600', 
    image: 'https://images.pexels.com/photos/2148217/pexels-photo-2148217.jpeg?auto=compress&cs=tinysrgb&w=600' 
  },
  { 
    name: 'IPAD', 
    icon: Tablet, 
    gradient: 'from-orange-500 to-rose-600', 
    image: 'https://images.pexels.com/photos/1334597/pexels-photo-1334597.jpeg?auto=compress&cs=tinysrgb&w=600' 
  },
  { 
    name: 'UGREEN', 
    icon: Zap, 
    gradient: 'from-amber-400 to-orange-500', 
    image: 'https://images.pexels.com/photos/163100/circuit-circuit-board-resistor-computer-163100.jpeg?auto=compress&cs=tinysrgb&w=600' 
  },
  { 
    name: 'PELICULAS DE SEGURIDAD', 
    icon: Shield, 
    gradient: 'from-cyan-500 to-blue-600', 
    image: 'https://images.pexels.com/photos/1476321/pexels-photo-1476321.jpeg?auto=compress&cs=tinysrgb&w=600' 
  },
];

/** Helper para formatear moneda si la columna parece ser un precio */
const formatCell = (key: string, value: any) => {
  if (value === null || value === undefined || value === '') return '-';
  
  const keyLower = key.toLowerCase();
  // Detectar columnas de dinero
  if ((keyLower.includes('precio') || keyLower.includes('valor') || keyLower.includes('costo')) && !isNaN(Number(value))) {
    return new Intl.NumberFormat('es-CO', { 
      style: 'currency', 
      currency: 'COP', 
      maximumFractionDigits: 0 
    }).format(Number(value));
  }
  
  return String(value);
};

export const PreciosPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [precios, setPrecios] = useState<PrecioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalItem, setModalItem] = useState<PrecioItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Cargar datos
  const fetchPrecios = async (category: string) => {
    setLoading(true);
    setPrecios([]); 
    try {
      const data = await PreciosService.getPrecios(category as any);
      setPrecios(data);
    } catch (error) {
      console.error('Error fetching precios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (categoryName: string) => {
    setSelectedCategory(categoryName);
    setSearchTerm('');
    fetchPrecios(categoryName);
  };

  // Obtener columnas dinámicas
  const columns = useMemo(() => {
    if (precios.length === 0) return [];
    const allKeys = new Set<string>();
    precios.forEach(item => {
      Object.keys(item).forEach(key => {
        if (key !== 'row_number') {
          allKeys.add(key);
        }
      });
    });
    // Ordenar para que 'MODELO' o 'REFERENCIA' salgan primero si existen
    return Array.from(allKeys).sort((a, b) => {
      const priority = ['MODELO', 'REFERENCIA', 'PRODUCTO'];
      const aP = priority.indexOf(a.toUpperCase());
      const bP = priority.indexOf(b.toUpperCase());
      if (aP !== -1 && bP !== -1) return aP - bP;
      if (aP !== -1) return -1;
      if (bP !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [precios]);

  // Filtrar datos en tiempo real
  const filteredPrecios = useMemo(() => {
    if (!searchTerm) return precios;
    const lowerQ = searchTerm.toLowerCase();
    return precios.filter(item => 
      Object.values(item).some(val => 
        String(val).toLowerCase().includes(lowerQ)
      )
    );
  }, [precios, searchTerm]);

  // ------------------- VISTA DE CATEGORÍAS -------------------
  if (!selectedCategory) {
    return (
      <div className="space-y-8 animate-fadeIn pb-10">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Lista de Precios
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Selecciona una categoría para consultar repuestos, servicios y diagnósticos actualizados.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 px-2">
          {categories.map((category) => {
            const IconComponent = category.icon;
            return (
              <div
                key={category.name}
                onClick={() => handleCategorySelect(category.name)}
                className="group relative cursor-pointer h-64 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1"
              >
                <div className="absolute inset-0">
                  <img
                    src={category.image}
                    alt={category.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t ${category.gradient} opacity-80 group-hover:opacity-90 transition-opacity duration-300`} />
                </div>
                
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 z-10">
                  <div className="bg-white/20 backdrop-blur-md p-4 rounded-2xl mb-4 group-hover:scale-110 transition-transform duration-300 shadow-inner border border-white/30">
                    <IconComponent className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-center tracking-wide">
                    {category.name.replace(/_/g, ' ')}
                  </h3>
                  <div className="mt-2 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
                      Ver precios <Tag className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ------------------- VISTA DE TABLA -------------------
  return (
    <div className="space-y-6 animate-fadeIn h-[calc(100vh-140px)] flex flex-col">
      {/* Header de la Tabla */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-sm border border-gray-200/50 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedCategory(null)}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 hover:text-blue-600 transition-colors group border border-transparent hover:border-gray-200"
            title="Volver a categorías"
          >
            <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              {selectedCategory.replace(/_/g, ' ')}
            </h2>
            <p className="text-sm text-gray-500">
              {loading ? 'Cargando datos...' : `${filteredPrecios.length} resultados encontrados`}
            </p>
          </div>
        </div>

        {/* Buscador */}
        <div className="relative w-full md:w-96 group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200"
            placeholder="Buscar modelo, referencia..."
            autoFocus
          />
        </div>
      </div>

      {/* Contenido / Tabla */}
      <div className="flex-1 relative bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/40 overflow-hidden flex flex-col">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm z-20">
            <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <span className="text-gray-500 font-medium animate-pulse">Sincronizando precios...</span>
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            {filteredPrecios.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-100 border-separate border-spacing-0">
                <thead className="bg-gray-50/95 backdrop-blur sticky top-0 z-30">
                  <tr>
                    {columns.map((column, colIndex) => (
                      <th
                        key={column}
                        scope="col"
                        className={`
                          px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap
                          border-b border-gray-200
                          ${colIndex === 0 
                            ? 'sticky left-0 z-40 bg-gray-50 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.05)]' // Sticky primer col Header
                            : ''}
                        `}
                      >
                        {column.replace(/[_\n]/g, ' ').trim()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-50">
                  {filteredPrecios.map((item, index) => (
                    <tr
                      key={item.row_number || index}
                      onClick={() => setModalItem(item)}
                      className="hover:bg-blue-50/50 transition-colors duration-150 cursor-pointer group"
                    >
                      {columns.map((column, colIndex) => (
                        <td 
                          key={column} 
                          className={`
                            px-6 py-4 whitespace-nowrap
                            ${colIndex === 0 
                              ? 'sticky left-0 z-20 bg-white group-hover:bg-blue-50/50 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.05)] font-semibold text-gray-900' // Sticky primer col Body
                              : ''}
                          `}
                        >
                          <div className={`text-sm ${
                             // Resaltar si es precio (y no es la primera columna, para no sobrecargar)
                             colIndex !== 0 && column.toLowerCase().includes('precio') 
                               ? 'text-emerald-600 font-bold bg-emerald-50 inline-block px-2 py-0.5 rounded' 
                               : 'text-gray-700 group-hover:text-gray-900'
                           }`}>
                            {formatCell(column, item[column as keyof PrecioItem])}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-10">
                <div className="bg-gray-50 p-4 rounded-full mb-4">
                  <Search className="w-8 h-8 text-gray-300" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">No se encontraron resultados</h3>
                <p className="text-gray-500">Intenta con otro término de búsqueda.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Detalle */}
      <PrecioModal
        isOpen={!!modalItem}
        onClose={() => setModalItem(null)}
        item={modalItem}
        categoryName={selectedCategory || ''}
      />
    </div>
  );
};