// src/pages/CRMPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { 
  ArrowUpDown, Phone, Calendar, Edit2, Save, X, Bot, Eye, 
  Search, Filter, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, 
  CheckCircle2, Users, AlertCircle, Globe, Smartphone
} from 'lucide-react';

// Importaciones de servicios, tipos y componentes externos
import { ClientService } from '../services/clientService';
import { Client, EstadoEtapa, CategoriaContacto, SortField, SortOrder } from '../types/client';
import { getEtapaColor, getCategoriaColor, formatDate, formatWhatsApp } from '../utils/clientHelpers';
import { ColumnSelector } from '../components/ColumnSelector';
import { ClientModal } from '../components/ClientModal';
import { NuevoCliente } from '../components/NuevoCliente';

// ============================================================================
// HELPERS & UTILS (Lógica de ListView Blindada)
// ============================================================================

// Transforma null/undefined en string vacío seguro
const safeText = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  return (s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') ? '' : s;
};

const labelize = (v?: string) => safeText(v).replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
const normalize = (s: string) => safeText(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\-\s]+/g, ' ').trim();

const sourceLabel = (s?: string) => {
  const safe = safeText(s);
  if (safe === 'Wiltech') return 'Bogotá';
  if (safe === 'WiltechBga') return 'Bucaramanga';
  if (safe.toLowerCase() === 'web1') return 'Web 1';
  return labelize(safe);
};

const getEtapaColorSafe = (v: string) => getEtapaColor(v as EstadoEtapa) || 'bg-gray-100 text-gray-700 border border-gray-200';
const getCategoriaColorSafe = (v: string) => getCategoriaColor(v as CategoriaContacto) || 'bg-gray-100 text-gray-700 border border-gray-200';

function collectUnique<T extends keyof Client>(rows: Client[], key: T): string[] {
  const s = new Set<string>();
  for (const c of rows) {
    const val = (c as any)[key];
    const str = safeText(val); // Usamos safeText para evitar nulos
    if (str) s.add(str);
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

// ============================================================================
// COMPONENTE INTERNO: ListView
// ============================================================================

interface ListViewProps {
  clients: Client[];
  onUpdate: (client: Partial<Client>) => Promise<boolean>;
}

const ListView: React.FC<ListViewProps> = ({ clients, onUpdate }) => {
  /** ===== UI State ===== */
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<Client>>({});
  const [sortField, setSortField] = useState<SortField>('fecha_agenda');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [savingRow, setSavingRow] = useState<number | null>(null);
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // ===== Pagination =====
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem('crm-page-size') || '50', 10);
    return Number.isFinite(saved) && saved > 0 ? saved : 50;
  });
  const [page, setPage] = useState<number>(1);
  const pageSizeOptions = [10, 25, 50, 100, 200];

  const goToPage = (n: number) => setPage(n);

  // Column visibility
  const allColumns = clients.length > 0 ? Object.keys(clients[0]).filter(k => k !== 'row_number') : [];
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('crm-visible-columns');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    if (allColumns.length > 0 && visibleColumns.length === 0) {
      const defaults = allColumns.slice(0, 8); // Mostrar las primeras 8 por defecto
      setVisibleColumns(defaults);
      localStorage.setItem('crm-visible-columns', JSON.stringify(defaults));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients]);

  const handleToggleColumn = (column: string) => {
    setVisibleColumns(prev => {
      const newVisible = prev.includes(column)
        ? prev.filter(col => col !== column)
        : [...prev, column];
      localStorage.setItem('crm-visible-columns', JSON.stringify(newVisible));
      return newVisible;
    });
  };

  /** ===== Options ===== */
  const etapasOptions     = useMemo(() => collectUnique(clients, 'estado_etapa'), [clients]);
  const categoriasOptions = useMemo(() => collectUnique(clients, 'categoria_contacto'), [clients]);
  const ciudadOptions     = useMemo(() => collectUnique(clients, 'agenda_ciudad_sede'), [clients]);
  const sourceOptions     = useMemo(() => collectUnique(clients, 'source'), [clients]);

  /** ===== Filters ===== */
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEtapas, setSelectedEtapas] = useState<string[]>([]);
  const [selectedCategorias, setSelectedCategorias] = useState<string[]>([]);
  const [selectedCiudades, setSelectedCiudades] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  useEffect(() => {
    const id = setTimeout(() => setSearchTerm(normalize(searchInput)), 220);
    return () => clearTimeout(id);
  }, [searchInput]);

  const toggleEtapa = (et: string) => setSelectedEtapas(p => p.includes(et) ? p.filter(x => x !== et) : [...p, et]);
  const toggleCategoria = (cat: string) => setSelectedCategorias(p => p.includes(cat) ? p.filter(x => x !== cat) : [...p, cat]);
  const toggleCiudad = (city: string) => setSelectedCiudades(p => p.includes(city) ? p.filter(x => x !== city) : [...p, city]);
  const toggleSource = (src: string) => setSelectedSources(p => p.includes(src) ? p.filter(x => x !== src) : [...p, src]);

  const clearFilters = () => {
    setSearchInput(''); setSearchTerm('');
    setSelectedEtapas([]); setSelectedCategorias([]); setSelectedCiudades([]); setSelectedSources([]);
  };

  /** ===== Logic: Filter & Sort (BLINDADO) ===== */
  const filteredAndSorted = useMemo(() => {
    let data = [...clients];

    // 1. Busqueda General
    if (searchTerm) {
      data = data.filter((c) => {
        // Concatenamos todo en un string seguro para buscar
        const fullText = normalize(
          safeText(c.nombre) + ' ' + 
          safeText(c.modelo) + ' ' + 
          safeText(c.whatsapp) + ' ' + 
          safeText(c.ciudad) + ' ' + 
          safeText((c as any).notas) + ' ' +
          safeText((c as any).asignado_a) // Importante para web1
        );
        return fullText.includes(searchTerm);
      });
    }

    // 2. Filtros Específicos
    if (selectedEtapas.length > 0) {
      const setN = new Set(selectedEtapas.map(normalize));
      data = data.filter(c => setN.has(normalize(String((c as any).estado_etapa ?? ''))));
    }
    if (selectedCategorias.length > 0) {
      const setN = new Set(selectedCategorias.map(normalize));
      data = data.filter(c => setN.has(normalize(String((c as any).categoria_contacto ?? ''))));
    }
    if (selectedCiudades.length > 0) {
      const setN = new Set(selectedCiudades.map(normalize));
      data = data.filter(c => setN.has(normalize(String((c as any).ciudad ?? ''))));
    }
    if (selectedSources.length > 0) {
      const setN = new Set(selectedSources.map(normalize));
      data = data.filter(c => setN.has(normalize(String((c as any).source ?? ''))));
    }

    // 3. Ordenamiento Seguro
    data.sort((a, b) => {
      // @ts-ignore
      const rawA = (a as any)[sortField];
      // @ts-ignore
      const rawB = (b as any)[sortField];

      // Ordenar fechas
      if (sortField === 'fecha_agenda' || sortField === 'created' || sortField === 'last_msg') {
        const timeA = rawA ? new Date(rawA).getTime() : 0;
        const timeB = rawB ? new Date(rawB).getTime() : 0;
        // Fechas nulas al final si es descendente, al principio si es ascendente
        if (!timeA && !timeB) return 0;
        if (!timeA) return sortOrder === 'asc' ? -1 : 1;
        if (!timeB) return sortOrder === 'asc' ? 1 : -1;
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }

      // Ordenar textos (evita crash por null.toLowerCase)
      const strA = safeText(rawA).toLowerCase();
      const strB = safeText(rawB).toLowerCase();

      if (strA > strB) return sortOrder === 'asc' ? 1 : -1;
      if (strA < strB) return sortOrder === 'asc' ? -1 : 1;
      return 0;
    });

    return data;
  }, [clients, searchTerm, selectedEtapas, selectedCategorias, selectedCiudades, selectedSources, sortField, sortOrder]);

  const resultsCount = filteredAndSorted.length;
  const totalPages = Math.max(1, Math.ceil(resultsCount / pageSize));

  useEffect(() => setPage(1), [searchTerm, selectedEtapas, selectedCategorias, selectedCiudades, selectedSources, sortField, sortOrder, clients.length]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [resultsCount, pageSize, page, totalPages]);

  useEffect(() => localStorage.setItem('crm-page-size', String(pageSize)), [pageSize]);

  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, resultsCount);
  const pagedData = filteredAndSorted.slice(startIndex, endIndex);

  /** ===== Actions ===== */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleEdit = (client: Client, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(client.row_number);
    setEditData(client);
  };

  const handleSave = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (editingId === null) return;
    try {
      setSavingRow(editingId);
      const success = await onUpdate({ ...editData, row_number: editingId });
      if (success) {
        setEditingId(null);
        setEditData({});
      }
    } finally {
      setSavingRow(null);
    }
  };

  const handleCancel = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditData({});
  };

  const handleRowClick = (client: Client) => {
    if (editingId === client.row_number) return;
    // Fix para Web1 en Modal
    const isWeb1 = safeText((client as any).source).toLowerCase() === 'web1';
    if (isWeb1) {
       setViewClient({
         ...client,
         whatsapp: safeText((client as any).asignado_a) || safeText(client.whatsapp) || `invitado_${client.row_number}`
       });
    } else {
       setViewClient(client);
    }
  };

  const handleWhatsAppClick = (val: string, e: React.MouseEvent, isWeb1: boolean) => {
    e.stopPropagation();
    if (isWeb1) {
        alert("Cliente Web 1 (Chat). Abre la tarjeta para ver la conversación.");
        return;
    }
    window.open(`https://wa.me/${safeText(val).replace('@s.whatsapp.net', '')}`, '_blank');
  };

  const handleBotToggle = async (client: Client, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const botEnabled = client.consentimiento_contacto === true || client.consentimiento_contacto === '' || client.consentimiento_contacto === null;
    const newValue = !botEnabled;

    if (botEnabled) {
      const ok = window.confirm('¿Desea apagar el bot para este contacto?');
      if (!ok) return;
    }

    try {
      setSavingRow(client.row_number);
      await onUpdate({ ...client, consentimiento_contacto: newValue });
    } finally {
      setSavingRow(null);
    }
  };

  /** ===== UI Components ===== */
  const PageButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {active?: boolean}> = ({ active, className = '', children, ...props }) => (
    <button
      {...props}
      className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all
        ${active 
          ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-blue-600'}
        disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );

  const buildPageList = (): (number | '…')[] => {
    const items: (number | '…')[] = [];
    const windowSize = 1;
    items.push(1);
    const left = Math.max(2, page - windowSize);
    const right = Math.min(totalPages - 1, page + windowSize);
    if (left > 2) items.push('…');
    for (let p = left; p <= right; p++) items.push(p);
    if (right < totalPages - 1) items.push('…');
    if (totalPages > 1) items.push(totalPages);
    return Array.from(new Set(items)).filter((x) => typeof x === 'number' ? x >= 1 && x <= totalPages : true);
  };

  const PaginationBar = () => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 bg-white border-t border-gray-100">
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span className="hidden sm:inline">
          {resultsCount > 0 ? `Mostrando ${startIndex + 1} – ${endIndex} de ${resultsCount}` : 'Sin datos'}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide">Filas:</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}
            className="text-xs px-2 py-1 border-gray-200 rounded-md bg-gray-50 focus:ring-blue-500 focus:border-blue-500"
          >
            {pageSizeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <PageButton onClick={() => goToPage(1)} disabled={page === 1}><ChevronsLeft className="w-3 h-3"/></PageButton>
        <PageButton onClick={() => goToPage(page - 1)} disabled={page === 1}><ChevronLeft className="w-3 h-3"/></PageButton>
        {buildPageList().map((p, idx) =>
          p === '…' ? <span key={`ell-${idx}`} className="px-1 text-gray-400 text-xs">•••</span> :
          <PageButton key={p} active={p === page} onClick={() => goToPage(p)}>{p}</PageButton>
        )}
        <PageButton onClick={() => goToPage(page + 1)} disabled={page >= totalPages}><ChevronRight className="w-3 h-3"/></PageButton>
        <PageButton onClick={() => goToPage(totalPages)} disabled={page >= totalPages}><ChevronsRight className="w-3 h-3"/></PageButton>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 animate-fadeIn">
      
      {/* === Controls Section === */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-1">
        {/* Top Bar: Search & Toggles */}
        <div className="p-3 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar..."
              className="block w-full pl-10 pr-3 py-2 border border-transparent bg-gray-50 rounded-xl text-sm placeholder-gray-500 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all whitespace-nowrap
                ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <Filter className="w-4 h-4" />
              Filtros
            </button>
            
            <div className="h-6 w-px bg-gray-200 mx-1 hidden sm:block"></div>

            <button onClick={clearFilters} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Limpiar filtros">
              <X className="w-4 h-4" />
            </button>

            <ColumnSelector
              columns={allColumns}
              visibleColumns={visibleColumns}
              onToggleColumn={handleToggleColumn}
              storageKey="crm-visible-columns"
            />
          </div>
        </div>

        {/* Expandable Filters Area */}
        {showFilters && (
          <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50/30 rounded-b-2xl space-y-4">
            {[
              { label: 'Etapas', options: etapasOptions, selected: selectedEtapas, toggle: toggleEtapa, colorFn: getEtapaColorSafe },
              { label: 'Categorías', options: categoriasOptions, selected: selectedCategorias, toggle: toggleCategoria, colorFn: getCategoriaColorSafe },
              { label: 'Ciudades', options: ciudadOptions, selected: selectedCiudades, toggle: toggleCiudad, colorFn: () => 'bg-white border-gray-200 text-gray-700' },
              { label: 'Fuente', options: sourceOptions, selected: selectedSources, toggle: toggleSource, colorFn: () => 'bg-white border-gray-200 text-gray-700' }
            ].map((group) => group.options.length > 0 && (
              <div key={group.label} className="flex flex-col sm:flex-row sm:items-start gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider w-20 pt-1.5">{group.label}</span>
                <div className="flex flex-wrap gap-2 flex-1">
                  {group.options.map(opt => {
                    const isSelected = group.selected.includes(opt);
                    return (
                      <button
                        key={opt}
                        onClick={() => group.toggle(opt)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-all border
                          ${isSelected ? 'ring-2 ring-blue-500/20 ring-offset-1' : 'opacity-70 hover:opacity-100'}
                          ${group.colorFn(opt)}
                        `}
                      >
                        {group.label === 'Fuente' ? sourceLabel(opt) : labelize(opt)}
                        {isSelected && <CheckCircle2 className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* === Table Section === */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/80 backdrop-blur sticky top-0 z-20">
              <tr>
                <th className="w-12 px-3 py-3 bg-gray-50/80"></th> {/* Actions Group */}
                {visibleColumns.map((field) => (
                  <th
                    key={field}
                    onClick={() => handleSort(field as SortField)}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 hover:text-gray-700 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center gap-2">
                      {field.replace(/_/g, ' ')}
                      <ArrowUpDown size={12} className={sortField === field ? 'text-blue-600' : 'text-gray-300'} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50 bg-white">
              {pagedData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="px-6 py-12 text-center text-gray-500">
                    No se encontraron resultados con los filtros actuales.
                  </td>
                </tr>
              ) : (
                pagedData.map((client) => {
                  const isEditing = editingId === client.row_number;
                  const currentClient = isEditing ? { ...client, ...editData } : client;
                  const botActive = currentClient.consentimiento_contacto === true || currentClient.consentimiento_contacto === '' || currentClient.consentimiento_contacto === null;
                  
                  // Detectar Web1
                  const isWeb1 = safeText((currentClient as any).source).toLowerCase() === 'web1';

                  return (
                    <tr
                      key={client.row_number}
                      onClick={() => handleRowClick(client)}
                      className={`group transition-colors duration-150 cursor-pointer
                        ${isEditing ? 'bg-blue-50/40' : 'hover:bg-blue-50/30'}
                      `}
                    >
                      {/* Action Buttons (Compact) */}
                      <td className="px-3 py-3 whitespace-nowrap sticky left-0 z-10 bg-white group-hover:bg-blue-50/30 transition-colors">
                        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          {isEditing ? (
                            <>
                              <button onClick={handleSave} disabled={savingRow === client.row_number} className="p-1.5 text-green-600 bg-green-100 rounded-md hover:bg-green-200 transition"><Save size={14}/></button>
                              <button onClick={handleCancel} disabled={savingRow === client.row_number} className="p-1.5 text-gray-500 bg-gray-100 rounded-md hover:bg-gray-200 transition"><X size={14}/></button>
                            </>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button onClick={(e) => handleEdit(client, e)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition" title="Editar"><Edit2 size={14}/></button>
                              <button onClick={(e) => {e.stopPropagation(); handleRowClick(client); }} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-md transition" title="Ver"><Eye size={14}/></button>
                              <button 
                                onClick={(e) => handleBotToggle(client, e)} 
                                className={`p-1.5 rounded-md transition ${botActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-300 hover:bg-gray-100'}`}
                                title={botActive ? "Bot Activo" : "Bot Inactivo"}
                              >
                                <Bot size={14}/>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Data Columns */}
                      {visibleColumns.map((field) => (
                        <td key={field} className="px-6 py-3 whitespace-nowrap text-sm text-gray-700">
                          {isEditing ? (
                            /* --- EDIT MODE --- */
                            field === 'estado_etapa' ? (
                              <select
                                value={(editData as any)[field] ?? ''}
                                onChange={(e) => setEditData({ ...editData, [field]: e.target.value as any })}
                                onClick={e => e.stopPropagation()}
                                className="w-full text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 py-1 px-2"
                              >
                                {[...new Set([String((editData as any)[field] ?? ''), ...etapasOptions])].filter(Boolean).map(et => (
                                  <option key={et} value={et}>{labelize(et)}</option>
                                ))}
                              </select>
                            ) : field === 'categoria_contacto' ? (
                              <select
                                value={(editData as any)[field] ?? ''}
                                onChange={(e) => setEditData({ ...editData, [field]: e.target.value as any })}
                                onClick={e => e.stopPropagation()}
                                className="w-full text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 py-1 px-2"
                              >
                                {[...new Set([String((editData as any)[field] ?? ''), ...categoriasOptions])].filter(Boolean).map(cat => (
                                  <option key={cat} value={cat}>{labelize(cat)}</option>
                                ))}
                              </select>
                            ) : field === 'fecha_agenda' ? (
                              <input
                                type="datetime-local"
                                value={(editData as any)[field] ?? ''}
                                onChange={(e) => setEditData({ ...editData, [field]: e.target.value })}
                                onClick={e => e.stopPropagation()}
                                className="w-full text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 py-1 px-2"
                              />
                            ) : (
                              <input
                                type="text"
                                value={(editData as any)[field] ?? ''}
                                onChange={(e) => setEditData({ ...editData, [field]: e.target.value })}
                                onClick={e => e.stopPropagation()}
                                className="w-full text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 py-1 px-2 bg-white"
                              />
                            )
                          ) : (
                            /* --- READ MODE --- */
                            <div className="truncate max-w-[200px]">
                              {field === 'estado_etapa' ? (
                                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${getEtapaColorSafe(String((currentClient as any)[field] ?? ''))}`}>
                                  {labelize(String((currentClient as any)[field] ?? ''))}
                                </span>
                              ) : field === 'categoria_contacto' ? (
                                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${getCategoriaColorSafe(String((currentClient as any)[field] ?? ''))}`}>
                                  {labelize(String((currentClient as any)[field] ?? ''))}
                                </span>
                              ) : field === 'fecha_agenda' && (currentClient as any)[field] ? (
                                <div className="flex items-center text-gray-600">
                                  <Calendar size={13} className="mr-1.5 text-gray-400" />
                                  {formatDate((currentClient as any)[field] as string)}
                                </div>
                              ) : field === 'whatsapp' ? (
                                <button 
                                    onClick={(e) => handleWhatsAppClick(safeText((currentClient as any)[field]), e, isWeb1)} 
                                    className={`flex items-center transition-colors ${isWeb1 ? 'text-blue-600 hover:text-blue-800' : 'text-gray-700 hover:text-green-600'}`}
                                >
                                  {isWeb1 ? <Globe size={13} className="mr-1.5" /> : <Phone size={13} className="mr-1.5 text-gray-400" />}
                                  {isWeb1 
                                    ? ((currentClient as any).asignado_a || 'Chat Web') 
                                    : formatWhatsApp(safeText((currentClient as any)[field]))
                                  }
                                </button>
                              ) : field === 'source' ? (
                                <span className="flex items-center gap-1.5">
                                    {isWeb1 && <Globe size={12} className="text-blue-500"/>}
                                    {sourceLabel((currentClient as any)[field]) || '-'}
                                </span>
                              ) : (
                                <span title={safeText((currentClient as any)[field])}>
                                  {safeText((currentClient as any)[field]) || <span className="text-gray-300">-</span>}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        <PaginationBar />
      </div>

      <ClientModal
        isOpen={!!viewClient}
        onClose={() => setViewClient(null)}
        client={viewClient}
        onUpdate={async (payload) => {
          const ok = await onUpdate(payload);
          if (ok && viewClient && payload.row_number === viewClient.row_number) {
            setViewClient({ ...viewClient, ...payload } as any);
          }
          return ok;
        }}
      />
    </div>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL: CRMPage
// ============================================================================

export const CRMPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** ===== Data ===== */
  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ClientService.getClients();
      setClients(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
    const onCreated = () => fetchClients();
    window.addEventListener('client:created', onCreated as any);
    return () => window.removeEventListener('client:created', onCreated as any);
  }, []);

  /** ===== Update ===== */
  const updateClient = async (updatedClient: Partial<Client>) => {
    try {
      const hasKey = typeof updatedClient.row_number !== 'undefined' && updatedClient.row_number !== null;

      if (hasKey) {
        setClients(prev =>
          prev.map(c => (c.row_number === updatedClient.row_number ? { ...c, ...updatedClient } : c))
        );
      }

      await ClientService.updateClient(updatedClient);

      if (!hasKey) await fetchClients();
      return true;
    } catch (err) {
      await fetchClients();
      setError(err instanceof Error ? err.message : 'Error al actualizar');
      return false;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 relative">
      <div className="h-screen w-full mx-auto space-y-8">
        
        {/* Componente Flotante */}
        <div className="fixed bottom-8 right-8 z-50">
            <NuevoCliente onCreated={fetchClients} />
        </div>

        {/* Content Area */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden min-h-[400px]">
          
          {/* Loading State: Skeleton UI */}
          {loading && clients.length === 0 && (
            <div className="p-6 space-y-4 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border border-gray-100 rounded-xl">
                  <div className="w-12 h-12 bg-gray-100 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-1/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/3" />
                  </div>
                  <div className="w-20 h-8 bg-gray-100 rounded-lg" />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">No pudimos cargar los datos</h3>
              <p className="text-gray-500 max-w-sm mt-2 mb-6">{error}</p>
              <button
                onClick={fetchClients}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Intentar nuevamente
              </button>
            </div>
          )}

          {/* Empty State (Sin clientes en absoluto) */}
          {!loading && !error && clients.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                <Users className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Aún no hay clientes
              </h3>
              <p className="text-gray-500 max-w-sm mt-2">
                Comienza agregando tu primer cliente usando el botón flotante.
              </p>
            </div>
          )}

          {/* Lista de Clientes (Si hay datos, ListView maneja sus propios filtros) */}
          {!loading && !error && clients.length > 0 && (
            <div className="relative">
               {/* Header opcional */}
               <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Base de Datos
                  </span>
                  <div className="flex items-center gap-2 text-gray-400">
                     <Users className="w-4 h-4" />
                     <span className="text-xs font-medium">Total: {clients.length}</span>
                  </div>
               </div>
               
               <div className="divide-y divide-gray-100">
                  <ListView clients={clients} onUpdate={updateClient} />
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};