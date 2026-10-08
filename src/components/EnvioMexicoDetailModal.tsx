import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Truck, X } from 'lucide-react';
import type { Client } from '../types/client';
import { EnvioMexicoGuiaForm, type MexicoGuiaChanges } from './EnvioMexicoGuiaForm';
import { COSTO_ENTRADA_MXN, NO_REGISTRADO, extractMexicoUnlockCode, formatMXN, mexicoDisplay, parseMexicoAddress } from '../utils/enviosMexico';

function Field({ label, value }: { label: string; value: unknown }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900">{mexicoDisplay(value)}</dd></div>;
}

export function EnvioMexicoDetailModal({ client, onClose, onSaveGuias, focusGuias = false }: {
  client: Client | null;
  onClose: () => void;
  onSaveGuias: (client: Client, changes: MexicoGuiaChanges) => Promise<void>;
  focusGuias?: boolean;
}) {
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const rowNumber = client?.row_number;
  useEffect(() => {
    if (rowNumber === undefined) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (focusGuias) dialog.current?.querySelector<HTMLInputElement>('input[name="guia_numero_ida"]')?.focus();
    else closeButton.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopImmediatePropagation(); onClose(); }
      if (event.key === 'Tab') {
        const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [href], [tabindex="0"]');
        if (!items?.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', keydown, true);
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus(); window.removeEventListener('keydown', keydown, true); };
  }, [rowNumber, onClose, focusGuias]);
  if (!client) return null;
  const address = parseMexicoAddress(client.guia_direccion);
  return createPortal(
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/50 p-3 sm:p-6" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="mexico-shipment-title" className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-4 bg-slate-950 p-5 text-white">
          <div><h2 id="mexico-shipment-title" className="flex items-center gap-2 text-lg font-bold"><Truck size={20} /> Envíos México · DHL</h2><p className="mt-1 text-xs text-slate-300">Información registrada · Registro manual de guías</p></div>
          <button ref={closeButton} type="button" onClick={onClose} aria-label="Cerrar detalle del envío" className="rounded-xl p-2 hover:bg-white/10"><X /></button>
        </header>
        <div className="space-y-6 overflow-y-auto p-5 sm:p-6" tabIndex={0}>
          <section><h3 className="mb-3 font-bold">Contacto</h3><dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" value={client.guia_nombre_completo} /><Field label="Teléfono" value={client.guia_telefono} /><Field label="Correo" value={client.guia_email} />
          </dl></section>
          <section><h3 className="mb-3 font-bold">Dirección de origen</h3><dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Ciudad / municipio / alcaldía" value={client.guia_ciudad} /><Field label="Estado" value={client.guia_departamento_estado} />
            {address.fields?.map(field => <Field key={field.label} label={field.label} value={field.value} />)}
            <div className="sm:col-span-2"><Field label="Dirección registrada" value={address.original} /></div>
          </dl></section>
          <section><h3 className="mb-3 font-bold">Detalle del equipo</h3><dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Modelo" value={client.modelo} />
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 font-mono font-bold"><Field label="Código de desbloqueo del equipo" value={extractMexicoUnlockCode(client.observaciones_tecnicas)} /></div>
            <div className="sm:col-span-2"><Field label="Observaciones técnicas" value={client.observaciones_tecnicas} /></div>
          </dl></section>
          <section><h3 className="mb-3 font-bold">Guías e importes</h3><dl className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
            <Field label="Transportadora" value="DHL" /><Field label="Estado del envío" value={client.estado_envio} />
            <Field label="Guía de ida" value={client.guia_numero_ida} /><Field label="Guía de retorno" value={client.guia_numero_retorno} />
            <Field label="Costo informado del envío de entrada" value={formatMXN(COSTO_ENTRADA_MXN)} /><Field label="Costo del envío de retorno" value={NO_REGISTRADO} />
            <Field label="Asegurado" value={client.asegurado} /><Field label="Valor asegurado" value={formatMXN(client.valor_seguro)} />
          </dl>
            <EnvioMexicoGuiaForm key={client.row_number} client={client} onSave={changes => onSaveGuias(client, changes)} />
          </section>
          <section><h3 className="mb-3 font-bold">Condiciones y seguimiento</h3><p className="whitespace-pre-wrap break-words text-sm text-slate-700">{mexicoDisplay(client.notas_cliente)}</p></section>
        </div>
      </section>
    </div>, document.body,
  );
}
