import React, { useState, useMemo, useCallback, useEffect } from "react";
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
  Database,
  RefreshCw,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { PreciosService } from "../services/preciosService";
import { ApiService } from "../services/apiService";
import { PrecioItem } from "../types/precios";
import { PrecioModal } from "../components/PrecioModal";

// --- CONFIGURACIÓN VISUAL ---
const categories = [
  {
    name: "IPHONE",
    icon: Smartphone,
    color: "bg-blue-600",
    gradient: "from-slate-900 via-blue-900 to-slate-900",
    image:
      "https://images.pexels.com/photos/788946/pexels-photo-788946.jpeg?auto=compress&cs=tinysrgb&w=600",
  },
  {
    name: "WATCH",
    icon: Watch,
    color: "bg-emerald-600",
    gradient: "from-slate-900 via-emerald-900 to-slate-900",
    image:
      "https://images.pexels.com/photos/437037/pexels-photo-437037.jpeg?auto=compress&cs=tinysrgb&w=600",
  },
  {
    name: "PC",
    icon: Monitor,
    color: "bg-violet-600",
    gradient: "from-slate-900 via-violet-900 to-slate-900",
    image:
      "https://images.pexels.com/photos/2148217/pexels-photo-2148217.jpeg?auto=compress&cs=tinysrgb&w=600",
  },
  {
    name: "IPAD",
    icon: Tablet,
    color: "bg-orange-600",
    gradient: "from-slate-900 via-orange-900 to-slate-900",
    image:
      "https://images.pexels.com/photos/1334597/pexels-photo-1334597.jpeg?auto=compress&cs=tinysrgb&w=600",
  },
  {
    name: "UGREEN",
    icon: Zap,
    color: "bg-amber-500",
    gradient: "from-slate-900 via-amber-900 to-slate-900",
    image:
      "https://images.pexels.com/photos/163100/circuit-circuit-board-resistor-computer-163100.jpeg?auto=compress&cs=tinysrgb&w=600",
  },
  {
    name: "PELICULAS DE SEGURIDAD",
    icon: Shield,
    color: "bg-cyan-600",
    gradient: "from-slate-900 via-cyan-900 to-slate-900",
    image:
      "https://images.pexels.com/photos/1476321/pexels-photo-1476321.jpeg?auto=compress&cs=tinysrgb&w=600",
  },
];

/** Helper para formatear moneda y texto */
const formatCell = (key: string, value: any) => {
  if (value === null || value === undefined || value === "")
    return <span className="text-gray-300">-</span>;

  const keyLower = key.toLowerCase();

  // Detectar columnas de dinero
  if (
    (keyLower.includes("precio") || keyLower.includes("valor") || keyLower.includes("costo")) &&
    !isNaN(Number(value))
  ) {
    const formatted = new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Number(value));

    return <span className="font-mono font-medium tracking-tight text-slate-700">{formatted}</span>;
  }

  // Estado simple
  if (String(value).toLowerCase() === "disponible") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
        Disponible
      </span>
    );
  }

  return <span className="font-medium text-slate-600">{String(value)}</span>;
};

export const PreciosPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0].name);
  const [precios, setPrecios] = useState<PrecioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalItem, setModalItem] = useState<PrecioItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // ✅ BOTÓN GLOBAL (UNA SOLA ACCIÓN)
  const [syncingAgent, setSyncingAgent] = useState(false);
  const [toastError, setToastError] = useState<string | null>(null);
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);

  const showSuccess = useCallback((msg: string) => {
    setToastSuccess(msg);
    setTimeout(() => setToastSuccess(null), 2500);
  }, []);

  const showError = useCallback((msg: string) => {
    setToastError(msg);
    setTimeout(() => setToastError(null), 3500);
  }, []);

  const fetchPrecios = useCallback(
    async (category: string) => {
      setLoading(true);
      setPrecios([]);
      try {
        const data = await PreciosService.getPrecios(category as any);
        // Aseguramos que data sea un array para evitar crashes
        setPrecios(Array.isArray(data) ? data : []);
        if (!Array.isArray(data)) {
          console.error("API did not return an array:", data);
          showError("La respuesta del servidor no es válida.");
        }
      } catch (error) {
        console.error("Error fetching precios:", error);
        showError(error instanceof Error ? error.message : "Error cargando precios");
      } finally {
        setLoading(false);
      }
    },
    [showError]
  );

  const handleCategorySelect = useCallback(
    (categoryName: string) => {
      setSelectedCategory(categoryName);
      setSearchTerm("");
      fetchPrecios(categoryName);
    },
    [fetchPrecios]
  );

  // Load initial category on mount
  useEffect(() => {
    fetchPrecios(categories[0].name);
  }, [fetchPrecios]);

  // ✅ Acción GLOBAL: Actualizar precios dentro del agente (una vez)
  const handleSyncAgentPrices = useCallback(async () => {
    const ok = window.confirm(
      "Esto sincroniza los precios del Google Sheets dentro del agente.\n\n¿Deseas continuar?"
    );
    if (!ok) return;

    try {
      setSyncingAgent(true);
      // Pasa por ApiService (incluye Bearer token)
      await ApiService.post<any>("/actualizar-precios-agente", {});
      showSuccess("Precios del agente actualizados correctamente");
    } catch (err) {
      console.error("Error actualizando precios del agente:", err);
      showError(err instanceof Error ? err.message : "Error actualizando precios del agente");
    } finally {
      setSyncingAgent(false);
    }
  }, [showError, showSuccess]);

  const columns = useMemo(() => {
    if (!Array.isArray(precios) || precios.length === 0) return [];
    const allKeys = new Set<string>();
    precios.forEach((item) => {
      if (!item) return;
      Object.keys(item).forEach((key) => {
        if (key !== "row_number") allKeys.add(key);
      });
    });
    return Array.from(allKeys).sort((a, b) => {
      const priority = ["MODELO", "REFERENCIA", "PRODUCTO", "PRECIO"];
      const aP = priority.indexOf(a.toUpperCase());
      const bP = priority.indexOf(b.toUpperCase());
      if (aP !== -1 && bP !== -1) return aP - bP;
      if (aP !== -1) return -1;
      if (bP !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [precios]);

  const filteredPrecios = useMemo(() => {
    if (!Array.isArray(precios)) return [];
    if (!searchTerm) return precios;
    const lowerQ = searchTerm.toLowerCase();
    return precios.filter((item) =>
      Object.values(item).some((val) => String(val).toLowerCase().includes(lowerQ))
    );
  }, [precios, searchTerm]);

  return (
    <div className="page-container relative overflow-hidden flex flex-col space-y-8 min-h-[calc(100vh-100px)]">
      
      {/* Background Decorations */}
      <div className="absolute top-[-10%] right-[-5%] w-[45%] h-[45%] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-5%] left-[-5%] w-[35%] h-[35%] bg-slate-800/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Toasts (global) */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
        {toastError && (
          <div className="wt-toast-error flex items-center gap-3 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl shadow-xl pointer-events-auto animate-in fade-in slide-in-from-top-4">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-bold flex-1">{toastError}</span>
            <button onClick={() => setToastError(null)} className="opacity-70 hover:opacity-100 font-bold">✕</button>
          </div>
        )}
        {toastSuccess && (
          <div className="wt-toast-success flex items-center gap-3 p-4 bg-emerald-600 text-white rounded-2xl shadow-xl pointer-events-auto animate-in fade-in slide-in-from-top-4">
            <Sparkles className="w-5 h-5 shrink-0" />
            <span className="font-bold text-sm flex-1">{toastSuccess}</span>
            <button onClick={() => setToastSuccess(null)} className="opacity-70 hover:opacity-100 font-bold">✕</button>
          </div>
        )}
      </div>

      {/* HEADER DASHBOARD */}
      <div className="relative z-10 flex flex-col gap-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
               <div className="absolute inset-0 bg-slate-900 blur-xl opacity-15 animate-pulse" />
               <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-black text-white flex items-center justify-center shadow-xl shadow-slate-900/30 relative z-10 border border-white/20">
                 <Tag className="w-7 h-7" />
               </div>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 leading-tight tracking-tight">Catálogo de Precios</h1>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">Sincronizado con Google Sheets</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <button
                onClick={handleSyncAgentPrices}
                disabled={syncingAgent}
                className="group flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900 hover:bg-emerald-600 text-white font-bold shadow-xl hover:shadow-emerald-200 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {syncingAgent ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                )}
                <span className="text-xs uppercase tracking-widest">{syncingAgent ? "Actualizando Agente..." : "Sincronizar Agente"}</span>
              </button>
          </div>
        </div>

        {/* CATEGORY TABS & SEARCH */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 flex items-center gap-1.5 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/30 backdrop-blur-sm overflow-x-auto no-scrollbar">
             {categories.map((cat) => {
                const Icon = cat.icon;
                const isActive = selectedCategory === cat.name;
                return (
                  <button
                    key={cat.name}
                    onClick={() => handleCategorySelect(cat.name)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap
                      ${isActive 
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200 ring-1 ring-slate-100' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'}
                    `}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'opacity-60'}`} />
                    {cat.name.replace(/_/g, " ")}
                  </button>
                );
             })}
          </div>

          <div className="flex items-center gap-3">
            <div className="wt-input-wrap w-full md:w-[300px]">
              <Search className="wt-input-icon" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar modelo o referencia..."
                className="bg-white/60 backdrop-blur-sm border-white/40 shadow-sm"
                type="search"
              />
            </div>
            <button 
              onClick={() => fetchPrecios(selectedCategory)} 
              disabled={loading} 
              className="flex items-center justify-center w-11 h-11 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/40 text-slate-500 hover:text-blue-600 hover:bg-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* MAIN DATA TABLE */}
      <div className="flex-1 flex flex-col min-h-0 bg-white/70 backdrop-blur-xl rounded-[32px] border border-white/40 shadow-2xl shadow-slate-200/50 overflow-hidden relative animate-in fade-in slide-in-from-bottom-6 duration-700">
        {loading ? (
          <div className="absolute inset-0 bg-white/40 backdrop-blur-md z-30 flex flex-col items-center justify-center space-y-6">
            <div className="relative">
               <div className="w-16 h-16 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
               <Database className="absolute inset-0 m-auto w-6 h-6 text-slate-700/50" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm font-black text-slate-800 uppercase tracking-widest">Cargando Precios</span>
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-slate-800 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-slate-800 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-slate-800 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-auto flex-1 custom-scrollbar">
            {filteredPrecios.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-30">
                  <tr className="bg-slate-900 text-white">
                    {columns.map((column, colIndex) => (
                      <th
                        key={column}
                        scope="col"
                        className={`
                          px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap
                          ${colIndex === 0 ? "sticky left-0 z-40 bg-slate-900" : ""}
                        `}
                      >
                        <div className="flex items-center gap-2">
                          {column.replace(/[_\n]/g, " ")}
                          {column.toLowerCase().includes("precio") && (
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredPrecios.map((item, index) => (
                    <tr
                      key={item.row_number || index}
                      onClick={() => setModalItem(item)}
                      className="cursor-pointer group hover:bg-slate-50 transition-colors"
                    >
                      {columns.map((column, colIndex) => {
                        const val = item[column as keyof PrecioItem];
                        const isPrice =
                          column.toLowerCase().includes("precio") ||
                          column.toLowerCase().includes("valor") ||
                           column.toLowerCase().includes("costo");
                        
                        return (
                          <td
                            key={column}
                            className={`
                              px-8 py-5 whitespace-nowrap transition-colors
                              ${colIndex === 0 ? "font-black text-slate-900 sticky left-0 z-20 bg-white group-hover:bg-slate-50/80 shadow-[1px_0_0_0_#f1f5f9]" : "text-slate-600 font-medium text-sm"}
                            `}
                          >
                            {isPrice ? (
                              <div className="inline-flex items-center px-4 py-2 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100/50 font-black text-xs tracking-tight shadow-sm">
                                {formatCell(column, val)}
                              </div>
                            ) : (
                              formatCell(column, val)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-24 text-center">
                <div className="w-24 h-24 rounded-[40px] bg-slate-50 flex items-center justify-center mb-8 border border-white shadow-xl shadow-slate-200/50 relative group">
                  <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-5 group-hover:opacity-10 transition-opacity" />
                  <Database className="w-10 h-10 text-slate-200 relative z-10" />
                </div>
                <h3 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Sin Resultados</h3>
                <p className="text-slate-500 max-w-xs font-semibold leading-relaxed">
                  No pudimos encontrar nada que coincida con "{searchTerm}" en {selectedCategory}.
                </p>
                <button
                  onClick={() => setSearchTerm("")}
                  className="mt-10 px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-xl shadow-slate-200 hover:bg-black hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95"
                >
                  Limpiar Búsqueda
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer de la tabla */}
        <div className="bg-slate-50/80 backdrop-blur-sm border-t border-slate-100 px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
               <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
               {filteredPrecios.length} Productos
            </span>
          </div>
          <span className="opacity-60">{syncingAgent ? "Actualizando agente..." : "Catálogo actualizado"}</span>
        </div>
      </div>

      <PrecioModal
        isOpen={!!modalItem}
        onClose={() => setModalItem(null)}
        item={modalItem}
        categoryName={selectedCategory || ""}
      />
    </div>
  );
};