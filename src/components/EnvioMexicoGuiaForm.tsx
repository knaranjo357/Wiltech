import { useRef, useState } from 'react';
import type { Client } from '../types/client';
import { mexicoText } from '../utils/enviosMexico';

export type MexicoGuiaChanges = Partial<Pick<Client, 'guia_numero_ida' | 'guia_numero_retorno'>>;

export function EnvioMexicoGuiaForm({ client, onSave }: {
  client: Client;
  onSave: (changes: MexicoGuiaChanges) => Promise<void>;
}) {
  const [draft, setDraft] = useState<MexicoGuiaChanges>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const inFlight = useRef(false);
  const fields = ['guia_numero_ida', 'guia_numero_retorno'] as const;
  const changes: MexicoGuiaChanges = {};
  fields.forEach(field => {
    if (draft[field] !== undefined && mexicoText(draft[field]) !== mexicoText(client[field])) {
      changes[field] = mexicoText(draft[field]);
    }
  });
  const dirty = Object.keys(changes).length > 0;

  return <form className="mt-4 rounded-xl border border-slate-200 p-4" onSubmit={async event => {
    event.preventDefault();
    if (!dirty || inFlight.current) return;
    inFlight.current = true;
    setSaving(true); setError(''); setMessage('');
    try {
      await onSave(changes);
      setDraft({});
      setMessage('Guías guardadas.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudieron guardar las guías.');
    } finally { inFlight.current = false; setSaving(false); }
  }}>
    <h4 className="text-sm font-bold text-slate-900">Registrar guías DHL</h4>
    <p className="mt-1 text-xs text-slate-500">Escribe los números de las guías que ya tienes.</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {fields.map((field, index) => <label key={field} className="text-xs font-semibold text-slate-600">
        {index === 0 ? 'Número de guía de ida' : 'Número de guía de retorno'}
        <input type="text" name={field} value={draft[field] ?? mexicoText(client[field])} disabled={saving}
          onChange={event => { setDraft(previous => ({ ...previous, [field]: event.target.value })); setError(''); setMessage(''); }}
          autoComplete="off" placeholder="No registrado" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 disabled:opacity-60" />
      </label>)}
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mt-3 text-sm text-emerald-700">{message}</p>}
    <button type="submit" disabled={saving || !dirty} className="mt-3 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar guías'}</button>
  </form>;
}
