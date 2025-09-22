import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, Phone, Calendar, Edit2, Save, X, Bot, Eye, Search, Filter } from 'lucide-react';
import { Client, EstadoEtapa, CategoriaContacto, SortField, SortOrder } from '../types/client';
import { getEtapaColor, getCategoriaColor, formatDate, formatWhatsApp } from '../utils/clientHelpers';
import { ColumnSelector } from './ColumnSelector';
import { ClientModal } from './ClientModal';

interface ListViewProps {
  clients: Client[];
  onUpdate: (client: Partial<Client>) => Promise<boolean>;
}

/** ==== Helpers de texto/normalización ==== */
const labelize = (v?: string) =>
  (v ?? '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalize = (s: string) =>
  s.toLowerCase().replace(/[_\-\s]+/g, ' ').trim();

/** Colores seguros incluso con valores desconocidos */
const getEtapaColorSafe = (v: string) =>
  getEtapaColor(v as EstadoEtapa) || 'bg-gray-50 text-gray-700 border border-gray-200';

const getCategoriaColorSafe = (v: string) =>
  getCategoriaColor(v as CategoriaContacto) || 'bg-gray-50 text-gray-700 border border-gray-200';

/** Extrae valores únicos (como strings) desde la data */
function collectUnique<T extends keyof Client>(rows: Client[], key: T): string[] {
  const s = new Set<string>();
  for (const c of rows) {
    const raw = (c as any)[key];
    const str = raw === null || raw === undefined ? '' : String(raw).trim();
    if (str) s.add(str);
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

export const ListView: React.FC<ListViewProps> = ({ clients, onUpdate }) => {
  /** ===== UI State ===== */
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<Client>>({});
  const [sortField, setSortField] = useState<SortField>('fecha_agenda');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [savingRow, setSavingRow] = useState<number | null>(null);
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [showFilters, setShowFilters] = useState<boolean>(true);

  // Column visibility (persistida)
  const allColumns = clients.length > 0 ? Object.keys(clients[0]).filter(k => k !== 'row_number') : [];
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('crm-visible-columns');
    return saved ? JSON.parse(saved) : [];
  });
  useEffect(() => {
    if (allColumns.length > 0 && visibleColumns.length === 0) {
      setVisibleColumns(allColumns.slice(0, 8));
      localStorage.setItem('crm-visible-columns', JSON.stringify(allColumns.slice(0, 8)));
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

  /** ===== Opciones dinámicas (según petición/data) ===== */
  const etapasOptions = useMemo(() => collectUnique(clients, 'estado_etapa'), [clients]);
  const categoriasOptions = useMemo(() => collectUnique(clients, 'categoria_contacto'), [clients]);
  const ciudadOptions = useMemo(() => collectUnique(clients, 'ciudad'), [clients]);

  /** ===== Filtros locales ===== */
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEtapas, setSelectedEtapas] = useState<string[]>([]);
  const [selectedCategorias, setSelectedCategorias] = useState<string[]>([]);
  const [selectedCiudades, setSelectedCiudades] = useState<string[]>([]);

  // debounce para búsqueda
  useEffect(() => {
    const id = setTimeout(() => setSearchTerm(searchInput.trim()), 220);
    return () => clearTimeout(id);
  }, [searchInput]);

  const toggleEtapa = (et: string) => {
    setSelectedEtapas(prev => prev.includes(et) ? prev.filter(x => x !== et) : [...prev, et]);
  };
  const toggleCategoria = (cat: string) => {
    setSelectedCategorias(prev => prev.includes(cat) ? prev.filter(x => x !== cat) : [...prev, cat]);
  };
  const toggleCiudad = (city: string) => {
    setSelectedCiudades(prev => prev.includes(city) ? prev.filter(x => x !== city) : [...prev, city]);
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchTerm('');
    setSelectedEtapas([]);
    setSelectedCategorias([]);
    setSelectedCiudades([]);
  };

  /** ===== Orden + Filtro + Datos ===== */
  const filteredAndSorted = useMemo(() => {
    let data = [...clients];

    // filtro búsqueda
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      data = data.filter((c) => {
        const nombre = c.nombre?.toLowerCase() ?? '';
        const modelo = (c as any).modelo?.toLowerCase?.() ?? '';
        const whatsapp = c.whatsapp ?? '';
        const ciudad = c.ciudad?.toLowerCase() ?? '';
        const notas = (c as any).notas?.toLowerCase?.() ?? '';
        return (
          nombre.includes(q) ||
          modelo.includes(q) ||
          whatsapp.includes(searchTerm) || // números tal cual
          ciudad.includes(q) ||
          notas.includes(q)
        );
      });
    }

    // filtros chips (normalizados para aceptar variantes)
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

    // orden
    data.sort((a, b) => {
      let aValue: any = (a as any)[sortField];
      let bValue: any = (b as any)[sortField];

      if (sortField === 'fecha_agenda') {
        const aTime = a.fecha_agenda ? new Date(a.fecha_agenda as any).getTime() : 0;
        const bTime = b.fecha_agenda ? new Date(b.fecha_agenda as any).getTime() : 0;
        return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
      }

      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();

      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      return 0;
    });

    return data;
  }, [clients, searchTerm, selectedEtapas, selectedCategorias, selectedCiudades, sortField, sortOrder]);

  const resultsCount = filteredAndSorted.length;

  /** ===== Acciones fila ===== */
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

  const handleWhatsAppClick = (whatsapp: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const phoneNumber = (whatsapp || '').replace('@s.whatsapp.net', '');
    const whatsappUrl = `https://wa.me/${phoneNumber}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleRowClick = (client: Client) => {
    // si se está editando esta fila, no abrir modal
    if (editingId === client.row_number) return;
    setViewClient(client);
  };

  const handleBotToggle = async (client: Client, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const botEnabled = client.consentimiento_contacto === true || client.consentimiento_contacto === '' || client.consentimiento_contacto === null;
    const newValue = botEnabled ? false : true;

    if (botEnabled) {
      const ok = window.confirm(
        '¿Desea apagar el bot para este contacto?\n' +
        'El asistente dejará de escribir automáticamente por WhatsApp.\n' +
        'Podrá volver a activarlo cuando quiera.'
      );
      if (!ok) return;
    }

    try {
      setSavingRow(client.row_number);
      await onUpdate({
        ...client,
        consentimiento_contacto: newValue,
      });
    } finally {
      setSavingRow(null);
    }
  };

  /** ===== Render ===== */
  return (
    <div className="space-y-4">
      {/* Búsqueda + Acciones */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/40 p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por nombre, WhatsApp, ciudad o notas…"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(v => !v)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.99] transition"
                aria-pressed={showFilters}
                title="Mostrar/Ocultar filtros"
              >
                <Filter className="w-4 h-4" />
                <span className="text-sm">{showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}</span>
              </button>

              <span className="text-sm text-gray-500 hidden md:inline-flex">
                {resultsCount} resultado{resultsCount !== 1 ? 's' : ''}
              </span>

              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.99] transition"
              >
                <X className="w-4 h-4" />
                <span className="text-sm">Limpiar</span>
              </button>

              <ColumnSelector
                columns={allColumns}
                visibleColumns={visibleColumns}
                onToggleColumn={handleToggleColumn}
                storageKey="crm-visible-columns"
              />
            </div>
          </div>

          {/* Panel de filtros (toggle) */}
          {showFilters && (
            <div className="flex flex-col gap-3">
              {/* Chips Etapas */}
              {etapasOptions.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-xs font-medium text-gray-600 mr-1 min-w-fit">Etapas:</span>
                  {etapasOptions.map((et) => {
                    const selected = selectedEtapas.includes(et);
                    return (
                      <button
                        key={et}
                        onClick={() => toggleEtapa(et)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs border shadow-sm transition
                          ${selected ? 'ring-2 ring-blue-400' : ''}
                          ${getEtapaColorSafe(et)}
                        `}
                      >
                        <span>{labelize(et)}</span>
                        {selected && <X className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Chips Categorías */}
              {categoriasOptions.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-xs font-medium text-gray-600 mr-1 min-w-fit">Categorías:</span>
                  {categoriasOptions.map((cat) => {
                    const selected = selectedCategorias.includes(cat);
                    return (
                      <button
                        key={cat}
                        onClick={() => toggleCategoria(cat)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs border shadow-sm transition
                          ${selected ? 'ring-2 ring-blue-400' : ''}
                          ${getCategoriaColorSafe(cat)}
                        `}
                      >
                        <span>{labelize(cat)}</span>
                        {selected && <X className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Chips Ciudades */}
              {ciudadOptions.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-xs font-medium text-gray-600 mr-1 min-w-fit">Ciudades:</span>
                  {ciudadOptions.map((city) => {
                    const selected = selectedCiudades.includes(city);
                    return (
                      <button
                        key={city}
                        onClick={() => toggleCiudad(city)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs border shadow-sm transition
                          ${selected ? 'ring-2 ring-blue-400' : ''}
                          bg-gray-50 text-gray-700 border-gray-200
                        `}
                      >
                        <span>{labelize(city)}</span>
                        {selected && <X className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Chips activos */}
              {(searchTerm || selectedEtapas.length > 0 || selectedCategorias.length > 0 || selectedCiudades.length > 0) && (
                <div className="flex flex-wrap items-center gap-2">
                  {searchTerm && (
                    <span className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-100">
                      Búsqueda: “{searchTerm}”
                      <button
                        className="p-0.5 hover:bg-blue-100 rounded-full"
                        onClick={() => { setSearchInput(''); setSearchTerm(''); }}
                        aria-label="Quitar búsqueda"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )}
                  {selectedEtapas.map(e => (
                    <span key={`se-${e}`} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs bg-gray-50 text-gray-700 border border-gray-200">
                      {labelize(e)}
                      <button className="p-0.5 hover:bg-gray-100 rounded-full" onClick={() => toggleEtapa(e)}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                  {selectedCategorias.map(c => (
                    <span key={`sc-${c}`} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs bg-gray-50 text-gray-700 border border-gray-200">
                      {labelize(c)}
                      <button className="p-0.5 hover:bg-gray-100 rounded-full" onClick={() => toggleCategoria(c)}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                  {selectedCiudades.map(ci => (
                    <span key={`sci-${ci}`} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs bg-gray-50 text-gray-700 border border-gray-200">
                      {labelize(ci)}
                      <button className="p-0.5 hover:bg-gray-100 rounded-full" onClick={() => toggleCiudad(ci)}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-white/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-blue-50 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-4 text-center w-20"></th>
                <th className="px-3 py-4 text-center w-16"></th>
                <th className="px-3 py-4 text-center w-20"></th>
                {visibleColumns.map((field) => (
                  <th
                    key={field}
                    className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleSort(field as SortField)}
                  >
                    <div className="flex items-center space-x-2">
                      <span>{field.replace(/_/g, ' ')}</span>
                      <ArrowUpDown size={14} className={`${sortField === field ? 'text-blue-600' : 'text-gray-400'} transition-colors`} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filteredAndSorted.map((client, index) => {
                const isEditing = editingId === client.row_number;
                const currentClient = isEditing ? { ...client, ...editData } : client;

                return (
                  <tr
                    key={client.row_number}
                    className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 transition-all duration-300 animate-fadeIn cursor-pointer"
                    style={{ animationDelay: `${index * 40}ms` }}
                    onClick={() => handleRowClick(client)}
                    tabIndex={0}
                    role="button"
                  >
                    {/* Bot Toggle */}
                    <td className="px-3 py-6 whitespace-nowrap">
                      <button
                        onClick={(e) => handleBotToggle(client, e)}
                        disabled={savingRow === client.row_number}
                        className={`p-2 rounded-xl transition-all duration-300 transform hover:scale-110 shadow-md ${
                          currentClient.consentimiento_contacto === true || currentClient.consentimiento_contacto === '' || currentClient.consentimiento_contacto === null
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                            : 'bg-gray-200 text-gray-600'
                        } ${savingRow === client.row_number ? 'opacity-60 cursor-not-allowed' : ''}`}
                        title="Activar/Desactivar bot"
                      >
                        <Bot size={16} />
                      </button>
                    </td>

                    {/* Ver */}
                    <td className="px-3 py-6 whitespace-nowrap">
                      <button
                        onClick={(e) => { e.stopPropagation(); setViewClient(client); }}
                        className="text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 p-2 rounded-xl transition-all duration-300 transform hover:scale-110"
                        title="Ver detalle"
                      >
                        <Eye size={16} />
                      </button>
                    </td>

                    {/* Editar / Guardar / Cancelar */}
                    <td className="px-3 py-6 whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={handleSave}
                            disabled={savingRow === client.row_number}
                            className="text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 p-2 rounded-xl transition-all duration-300 transform hover:scale-110 shadow-lg disabled:opacity-60"
                            title="Guardar"
                          >
                            <Save size={16} />
                          </button>
                          <button
                            onClick={handleCancel}
                            disabled={savingRow === client.row_number}
                            className="text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 p-2 rounded-xl transition-all duration-300 transform hover:scale-110 disabled:opacity-60"
                            title="Cancelar"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => handleEdit(client, e)}
                          disabled={savingRow === client.row_number}
                          className="text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-2 rounded-xl transition-all duration-300 transform hover:scale-110 disabled:opacity-60"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                    </td>

                    {/* Columnas dinámicas */}
                    {visibleColumns.map((field) => (
                      <td
                        key={field}
                        className="px-6 py-6 whitespace-nowrap"
                        onClick={(e) => {
                          // Cuando se está editando, no abrir modal al interactuar con inputs
                          if (isEditing) e.stopPropagation();
                        }}
                      >
                        {isEditing ? (
                          field === 'estado_etapa' ? (
                            <select
                              value={(editData as any)[field] ?? ''}
                              onChange={(e) => setEditData({ ...editData, [field]: e.target.value as any })}
                              className="text-xs px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {[...new Set([String((editData as any)[field] ?? ''), ...etapasOptions])]
                                .filter(Boolean)
                                .map((et) => (
                                  <option key={et} value={et}>{labelize(et)}</option>
                                ))}
                            </select>
                          ) : field === 'categoria_contacto' ? (
                            <select
                              value={(editData as any)[field] ?? ''}
                              onChange={(e) => setEditData({ ...editData, [field]: e.target.value as any })}
                              className="text-xs px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {[...new Set([String((editData as any)[field] ?? ''), ...categoriasOptions])]
                                .filter(Boolean)
                                .map((cat) => (
                                  <option key={cat} value={cat}>{labelize(cat)}</option>
                                ))}
                            </select>
                          ) : field === 'fecha_agenda' ? (
                            <input
                              type="datetime-local"
                              value={(editData as any)[field] ?? ''}
                              onChange={(e) => setEditData({ ...editData, [field]: e.target.value })}
                              className="text-xs px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : field === 'consentimiento_contacto' ? (
                            <select
                              value={((editData as any)[field] as any)?.toString() ?? ''}
                              onChange={(e) => setEditData({ ...editData, [field]: e.target.value === 'true' })}
                              className="text-xs px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="true">Sí</option>
                              <option value="false">No</option>
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={(editData as any)[field] ?? ''}
                              onChange={(e) => setEditData({ ...editData, [field]: e.target.value })}
                              className="text-sm bg-transparent border-b-2 border-blue-300 focus:border-blue-500 outline-none transition-colors min-w-[100px]"
                              onClick={(e) => e.stopPropagation()}
                            />
                          )
                        ) : (
                          <div className="text-sm">
                            {field === 'estado_etapa' ? (
                              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${getEtapaColorSafe(String((currentClient as any)[field] ?? ''))}`}>
                                {labelize(String((currentClient as any)[field] ?? ''))}
                              </span>
                            ) : field === 'categoria_contacto' ? (
                              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${getCategoriaColorSafe(String((currentClient as any)[field] ?? ''))}`}>
                                {labelize(String((currentClient as any)[field] ?? ''))}
                              </span>
                            ) : field === 'fecha_agenda' && (currentClient as any)[field] ? (
                              <div className="flex items-center text-purple-600">
                                <Calendar size={14} className="mr-2" />
                                {formatDate((currentClient as any)[field] as string)}
                              </div>
                            ) : field === 'whatsapp' ? (
                              <button
                                onClick={(e) => handleWhatsAppClick((currentClient as any)[field] as string, e)}
                                className="flex items-center text-green-600 hover:text-green-700 font-medium transition-colors"
                              >
                                <Phone size={14} className="mr-2" />
                                {formatWhatsApp((currentClient as any)[field] as string)}
                              </button>
                            ) : (
                              <span className="text-gray-900 font-medium">
                                {(currentClient as any)[field]?.toString() || '-'}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <ClientModal
        isOpen={!!viewClient}
        onClose={() => setViewClient(null)}
        client={viewClient}
      />
    </div>
  );
};
