import { RepairLoader } from './RepairLoader';
import { Pagination } from './Pagination';
import { usePagination } from '../hooks/usePagination';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Edit3, Plus, RefreshCw, Search, Trash2, Wrench } from 'lucide-react';
import { equiposSegundaApi } from '../services/diagnosticadorService';
import type { EquipoSegunda } from '../types/diagnosticador';

type Props = { onBack: () => void };

const emptyDraft = (): Partial<EquipoSegunda> => ({ equipo: '', modelo: '', componente: '', precio: '', nota: '' });

export default function PreciosSegundaPanel({ onBack }: Props) {
  const [rows, setRows] = useState<EquipoSegunda[]>([]);
  const [draft, setDraft] = useState<Partial<EquipoSegunda> | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try { setRows(await equiposSegundaApi.getAll()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los precios de segunda.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return term ? rows.filter(row => JSON.stringify(row).toLowerCase().includes(term)) : rows;
  }, [rows, search]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft?.equipo?.trim() || !draft.modelo?.trim() || !draft.componente?.trim() || !String(draft.precio || '').trim()) return;
    setSaving(true);
    setError('');
    try {
      if (draft.id) await equiposSegundaApi.update(draft as EquipoSegunda);
      else await equiposSegundaApi.create(draft as Omit<EquipoSegunda, 'id' | 'created_at'>);
      setDraft(null);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el precio.'); }
    finally { setSaving(false); }
  };

  const remove = async (row: EquipoSegunda) => {
    if (!window.confirm('¿Eliminar el precio de ' + row.componente + ' para ' + row.modelo + '?')) return;
    try {
      await equiposSegundaApi.delete(row.id);
      setRows(current => current.filter(item => item.id !== row.id));
      if (draft?.id === row.id) setDraft(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el precio.'); }
  };

  const pagination = usePagination(filtered, search);

  return (
    <div className="page-container min-h-screen space-y-6 bg-slate-50">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="rounded-xl border border-slate-200 bg-white p-3 text-slate-500 transition hover:bg-slate-950 hover:text-white"><ArrowLeft className="h-5 w-5" /></button>
          <div className="rounded-2xl bg-amber-100 p-3 text-amber-700"><Wrench className="h-6 w-6" /></div>
          <div><span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Precios</span><h1 className="wt-page-title">Componentes de segunda</h1><p className="text-xs font-semibold text-slate-500">Referencias para diagnóstico, cotización y reparación.</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="btn-secondary">{loading ? <RepairLoader variant="icon" /> : <RefreshCw className="h-4 w-4" />} Actualizar</button>
          <button onClick={() => setDraft(emptyDraft())} className="btn-primary"><Plus className="h-4 w-4" /> Nuevo precio</button>
        </div>
      </header>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
      <div className="relative max-w-2xl"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar equipo, modelo o componente..." className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-slate-500" /></div>

      <div className={'grid gap-5 ' + (draft ? 'xl:grid-cols-[1fr_360px]' : '')}>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="wt-table w-full text-left">
              <thead className="border-b border-slate-100 bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400"><tr><th className="p-4">Equipo</th><th className="p-4">Modelo</th><th className="p-4">Componente</th><th className="p-4">Precio</th><th className="p-4">Nota</th><th className="p-4 text-right">Acciones</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
{loading && <tr><td colSpan={6}><RepairLoader variant="panel" label="Cargando datos" /></td></tr>}
                {pagination.items.map(row => (
                  <tr key={row.id} className="text-sm hover:bg-slate-50">
                    <td className="p-4 font-black text-slate-900">{row.equipo}</td><td className="p-4 font-semibold text-slate-600">{row.modelo}</td><td className="p-4 font-semibold text-slate-700">{row.componente}</td><td className="p-4 font-black text-emerald-700">{row.precio}</td><td className="max-w-48 truncate p-4 text-xs text-slate-400">{row.nota || '—'}</td>
                    <td className="p-4"><div className="flex justify-end gap-2"><button onClick={() => setDraft({ ...row })} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"><Edit3 className="h-4 w-4" /></button><button onClick={() => void remove(row)} className="rounded-lg border border-red-100 p-2 text-red-400 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div></td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-sm text-slate-400">No hay precios registrados.</td></tr>}
              </tbody>
            </table>
          </div>
      {!loading && <Pagination {...pagination} />}
        </div>

        {draft && (
          <form onSubmit={save} className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between"><div><span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{draft.id ? 'Editar registro' : 'Nuevo registro'}</span><h2 className="text-lg font-black text-slate-900">Precio de segunda</h2></div><button type="button" onClick={() => setDraft(null)} className="text-xs font-bold text-slate-400">Cerrar</button></div>
            {(['equipo', 'modelo', 'componente', 'precio'] as const).map(field => <label key={field} className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">{field}</span><input required value={String(draft[field] || '')} onChange={event => setDraft(current => ({ ...current, [field]: event.target.value }))} className="w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-slate-500" /></label>)}
            <label className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">Nota</span><textarea value={String(draft.nota || '')} onChange={event => setDraft(current => ({ ...current, nota: event.target.value }))} className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-slate-500" /></label>
            <button disabled={saving} className="btn-primary w-full justify-center">{saving && <RepairLoader variant="icon" />} {saving ? 'Guardando...' : 'Guardar precio'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
