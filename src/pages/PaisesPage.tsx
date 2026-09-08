import { useEffect, useState } from 'react';
import { Globe, Save, MapPin, Sliders } from 'lucide-react';
import { useCountryConfig } from '../hooks/useCountryConfig';
import { CountryService } from '../services/countryService';
import { COUNTRY_MODULES, cleanCities } from '../utils/countryConfig';
import { AuthService } from '../services/authService';

export default function PaisesPage() {
  const { country, config, record, reload } = useCountryConfig();
  const [modules, setModules] = useState(config.modulos);
  const [cities, setCities] = useState(config.ciudades.join('\n'));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setModules(config.modulos); setCities(config.ciudades.join('\n')); }, [config]);
  const dirty = JSON.stringify(modules) !== JSON.stringify(config.modulos) || cities !== config.ciudades.join('\n');
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const beforeNavigate = (event: Event) => { if (!window.confirm('Hay cambios de configuración sin guardar. ¿Quieres descartarlos?')) event.preventDefault(); };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('app:before-navigate', beforeNavigate);
    return () => { window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('app:before-navigate', beforeNavigate); };
  }, [dirty]);
  if (!AuthService.isRoot()) return <p role="alert">Solo root puede configurar países.</p>;
  const save = async () => {
    setSaving(true); setError(''); setMessage('');
    try {
      await CountryService.save(record, { ...config, modulos: modules, ciudades: cleanCities(cities.split('\n')) });
      await reload();
      setMessage('Configuración guardada. Los módulos y ciudades ya se aplican a este país.');
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo guardar.'); }
    finally { setSaving(false); }
  };
  return <div className="page-container space-y-5">
    <header className="header-bar flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="wt-page-title flex items-center gap-3"><Globe className="h-6 w-6" /> Configuración de {country}</h1><p className="mt-2 text-sm text-slate-500">Define los módulos y las ciudades disponibles. Cambia de país desde el menú lateral.</p></div>
      <button onClick={save} disabled={saving || (!dirty && !!record?.configuracion)} className="btn-primary"><Save className="h-4 w-4" />{saving ? 'Guardando...' : 'Guardar configuración'}</button>
    </header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>}
    {!record?.configuracion && <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Este país aún no tiene una configuración guardada. Revisa los valores iniciales y guárdalos.</p>}
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
      <section className="card p-5"><h2 className="flex items-center gap-2 font-bold"><Sliders className="h-4 w-4" /> Módulos del país</h2><p className="mt-2 text-xs leading-relaxed text-slate-500">Desactivar un módulo lo oculta y bloquea para todos, incluidos admin y root. Esta pantalla siempre permanece disponible para root.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">{COUNTRY_MODULES.map(module => <label key={module.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-4 ${modules[module.id] ? 'border-slate-300 bg-slate-50' : 'border-slate-100 bg-white'}`}><span className="text-sm font-semibold text-slate-700">{module.label}</span><input type="checkbox" checked={modules[module.id] === true} disabled={saving} onChange={event => setModules(previous => ({ ...previous, [module.id]: event.target.checked }))} className="h-4 w-4 accent-black" /></label>)}</div>
      </section>
      <section className="card p-5"><h2 className="flex items-center gap-2 font-bold"><MapPin className="h-4 w-4" /> Ciudades y sedes</h2><label htmlFor="country-cities" className="mt-2 block text-xs leading-relaxed text-slate-500">Una ciudad por línea. Estos nombres se usarán como sugerencias y para normalizar los formularios.</label><textarea id="country-cities" value={cities} onChange={event => setCities(event.target.value)} disabled={saving} rows={10} placeholder="Añade las ciudades de este país" className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-7 focus:outline-none focus:ring-2 focus:ring-slate-300" /><p className="mt-2 text-xs text-slate-400">{cleanCities(cities.split('\n')).length} ciudades · Se eliminan nombres repetidos.</p></section>
    </div>
  </div>;
}
