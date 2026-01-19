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
  Tag,
  Filter,
  ChevronRight,
  Database
} from 'lucide-react';
import { PreciosService } from '../services/preciosService';
import { PrecioItem } from '../types/precios';
import { PrecioModal } from '../components/PrecioModal';

// --- CONFIGURACIÓN VISUAL ---
const categories = [
  { 
    name: 'IPHONE', 
    icon: Smartphone, 
    color: 'bg-blue-600',
    gradient: 'from-slate-900 via-blue-900 to-slate-900', 
    image: 'https://images.pexels.com/photos/788946/pexels-photo-788946.jpeg?auto=compress&cs=tinysrgb&w=600' 
  },
  { 
    name: 'WATCH', 
    icon: Watch, 
    color: 'bg-emerald-600',
    gradient: 'from-slate-900 via-emerald-900 to-slate-900', 
    image: 'https://images.pexels.com/photos/437037/pexels-photo-437037.jpeg?auto=compress&cs=tinysrgb&w=600' 
  },
  { 
    name: 'PC', 
    icon: Monitor, 
    color: 'bg-violet-600',
    gradient: 'from-slate-900 via-violet-900 to-slate-900', 
    image: 'https://images.pexels.com/photos/2148217/pexels-photo-2148217.jpeg?auto=compress&cs=tinysrgb&w=600' 
  },
  { 
    name: 'IPAD', 
    icon: Tablet, 
    color: 'bg-orange-600',
    gradient: 'from-slate-900 via-orange-900 to-slate-900', 
    image: 'https://images.pexels.com/photos/1334597/pexels-photo-1334597.jpeg?auto=compress&cs=tinysrgb&w=600' 
  },
  { 
    name: 'UGREEN', 
    icon: Zap, 
    color: 'bg-amber-500',
    gradient: 'from-slate-900 via-amber-900 to-slate-900', 
    image: 'https://images.pexels.com/photos/163100/circuit-circuit-board-resistor-computer-163100.jpeg?auto=compress&cs=tinysrgb&w=600' 
  },
  { 
    name: 'PELICULAS', 
    icon: Shield, 
    color: 'bg-cyan-600',
    gradient: 'from-slate-900 via-cyan-900 to-slate-900', 
    image: 'https://images.pexels.com/photos/1476321/pexels-photo-1476321.jpeg?auto=compress&cs=tinysrgb&w=600' 
  },
];

/** Helper para formatear moneda y texto */
const formatCell = (key: string, value: any) => {
  if (value === null || value === undefined || value === '') return <span className="text-gray-300">-</span>;
  
  const keyLower = key.toLowerCase();
  
  // Detectar columnas de dinero
  if ((keyLower.includes('precio') || keyLower.includes('valor') || keyLower.includes('costo')) && !isNaN(Number(value))) {
    const formatted = new Intl.NumberFormat('es-CO', { 
      style: 'currency', 
      currency: 'COP', 
      maximumFractionDigits: 0 
    }).format(Number(value));

    // Renderizar con fuente tabular para mejor alineación numérica
    return <span className="font-mono font-medium tracking-tight text-slate-700">{formatted}</span>;
  }
  
  // Si es un estado (ejemplo simple)
  if (String(value).toLowerCase() === 'disponible') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Disponible</span>
  }

  return <span className="text-slate-600">{String(value)}</span>;
};

export const PreciosPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [precios, setPrecios] = useState<PrecioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalItem, setModalItem] = useState<PrecioItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  const columns = useMemo(() => {
    if (precios.length === 0) return [];
    const allKeys = new Set<string>();
    precios.forEach(item => {
      Object.keys(item).forEach(key => {
        if (key !== 'row_number') allKeys.add(key);
      });
    });
    return Array.from(allKeys).sort((a, b) => {
      const priority = ['MODELO', 'REFERENCIA', 'PRODUCTO', 'PRECIO'];
      const aP = priority.indexOf(a.toUpperCase());
      const bP = priority.indexOf(b.toUpperCase());
      if (aP !== -1 && bP !== -1) return aP - bP; // Ambos tienen prioridad
      if (aP !== -1) return -1; // A tiene prioridad
      if (bP !== -1) return 1; // B tiene prioridad
      return a.localeCompare(b);
    });
  }, [precios]);

  const filteredPrecios = useMemo(() => {
    if (!searchTerm) return precios;
    const lowerQ = searchTerm.toLowerCase();
    return precios.filter(item => 
      Object.values(item).some(val => 
        String(val).toLowerCase().includes(lowerQ)
      )
    );
  }, [precios, searchTerm]);

  // --- VISTA: SELECCIÓN DE CATEGORÍA ---
  if (!selectedCategory) {
    return (
      <div className="min-h-full w-full p-6 animate-in fade-in duration-500">
        <div className="max-w-7xl mx-auto space-y-10">
          
          {/* Hero Header */}
          <div className="text-center space-y-4 py-8">
            <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight">
              Catálogo de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600">Servicios y Repuestos</span>
            </h1>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto font-light leading-relaxed">
              Selecciona una categoría para acceder a la base de datos actualizada de precios, diagnósticos y disponibilidad.
            </p>
          </div>

          {/* Grid de Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => {
              const IconComponent = category.icon;
              return (
                <button
                  key={category.name}
                  onClick={() => handleCategorySelect(category.name)}
                  className="group relative h-60 w-full rounded-3xl overflow-hidden shadow-md hover:shadow-2xl hover:shadow-slate-200 transition-all duration-300 transform hover:-translate-y-1 text-left"
                >
                  {/* Background Image & Overlay */}
                  <div className="absolute inset-0">
                    <img
                      src={category.image}
                      alt={category.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className={`absolute inset-0 bg-gradient-to-t ${category.gradient} opacity-80 group-hover:opacity-90 transition-opacity duration-300`} />
                  </div>
                  
                  {/* Content */}
                  <div className="absolute inset-0 p-6 flex flex-col justify-between z-10">
                    <div className="flex justify-between items-start">
                      <div className={`p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg group-hover:bg-white/20 transition-colors`}>
                        <IconComponent className="w-6 h-6 text-white" />
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/20 p-2 rounded-full backdrop-blur-sm">
                        <ChevronRight className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-2xl font-bold text-white tracking-wide">
                        {category.name.replace(/_/g, ' ')}
                      </h3>
                      <div className="h-0 group-hover:h-6 overflow-hidden transition-all duration-300">
                        <span className="text-slate-200 text-sm font-medium mt-2 flex items-center gap-2">
                          Ver inventario <ArrowLeft className="w-3 h-3 rotate-180" />
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // --- VISTA: TABLA DE DATOS ---
  return (
    <div className="h-[calc(100vh-100px)] flex flex-col p-4 md:p-6 animate-in slide-in-from-right-4 duration-500">
      
      {/* Header flotante */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0 z-20">
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedCategory(null)}
            className="group flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-all"
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                Categoría
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              {selectedCategory.replace(/_/g, ' ')}
            </h2>
          </div>
        </div>

        {/* Barra de búsqueda mejorada */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-80 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm
                         placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Buscar por modelo, ref, precio..."
              autoFocus
            />
            {searchTerm && (
               <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400">
                 {filteredPrecios.length} res.
               </div>
            )}
          </div>
          
          <button 
            className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
            title="Filtros avanzados (Proximamente)"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Contenedor de la Tabla (Card Principal) */}
      <div className="flex-1 bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden relative flex flex-col">
        
        {loading ? (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-4" />
            <p className="text-slate-500 font-medium animate-pulse">Obteniendo datos en tiempo real...</p>
          </div>
        ) : (
          <div className="overflow-auto flex-1 custom-scrollbar">
            {filteredPrecios.length > 0 ? (
              <table className="min-w-full divide-y divide-slate-100 border-separate border-spacing-0">
                <thead className="bg-slate-50 sticky top-0 z-30">
                  <tr>
                    {columns.map((column, colIndex) => (
                      <th
                        key={column}
                        scope="col"
                        className={`
                          px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap border-b border-slate-200
                          ${colIndex === 0 
                            ? 'sticky left-0 z-40 bg-slate-50 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]' // Sticky Col Header
                            : ''}
                        `}
                      >
                        <div className="flex items-center gap-1">
                          {column.replace(/[_\n]/g, ' ')}
                          {/* Pequeño indicador visual si es precio */}
                          {column.toLowerCase().includes('precio') && <Tag className="w-3 h-3 text-emerald-500 ml-1" />}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-50">
                  {filteredPrecios.map((item, index) => (
                    <tr
                      key={item.row_number || index}
                      onClick={() => setModalItem(item)}
                      className="group hover:bg-blue-50/40 transition-colors duration-150 cursor-pointer"
                    >
                      {columns.map((column, colIndex) => {
                        const isPrice = column.toLowerCase().includes('precio') || column.toLowerCase().includes('valor');
                        return (
                          <td 
                            key={column} 
                            className={`
                              px-6 py-3.5 whitespace-nowrap text-sm
                              ${colIndex === 0 
                                ? 'sticky left-0 z-20 bg-white group-hover:bg-blue-50/60 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)] font-semibold text-slate-800' 
                                : ''}
                              ${isPrice ? 'bg-slate-50/30' : ''}
                            `}
                          >
                            {/* Aquí inyectamos el resaltado visual si es precio */}
                            {isPrice ? (
                              <div className="px-2.5 py-1 rounded-md bg-emerald-50/80 border border-emerald-100/50 inline-block">
                                {formatCell(column, item[column as keyof PrecioItem])}
                              </div>
                            ) : (
                              formatCell(column, item[column as keyof PrecioItem])
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-12 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <Database className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Sin resultados</h3>
                <p className="text-slate-500 max-w-xs mx-auto">
                  No encontramos "{searchTerm}" en la categoría {selectedCategory}.
                </p>
                <button 
                  onClick={() => setSearchTerm('')}
                  className="mt-6 text-blue-600 hover:text-blue-800 text-sm font-medium hover:underline"
                >
                  Limpiar búsqueda
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Footer pequeño de la tabla */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-2 text-xs text-slate-400 flex justify-between items-center">
          <span>Mostrando {filteredPrecios.length} registros</span>
          <span>Actualizado recientemente</span>
        </div>
      </div>

      {/* Modal Detalle */}
      <PrecioModal
        isOpen={!!modalItem}
        onClose={() => setModalItem(null)}
        item={modalItem}
        categoryName={selectedCategory || ''}
      />
      
      <style>{`
        /* Personalización de scrollbar fina */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #94a3b8;
        }
      `}</style>
    </div>
  );
};