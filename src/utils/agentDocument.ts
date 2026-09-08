import type { SystemMessage } from '../types/precios';

export interface AgentDocument {
  prompt?: SystemMessage;
  prices?: SystemMessage;
}

/** Select by country and type, never by response order or a default row ID. */
export function selectAgentDocument(response: unknown, country: string, withPrices = false): AgentDocument {
  const rows = (Array.isArray(response) ? response : response ? [response] : [])
    .filter((row): row is SystemMessage => !!row && typeof row === 'object' && row.pais_sede === country);
  const kind = (row: SystemMessage) => String(row.Tipo ?? '').trim().toLowerCase();
  const prompts = rows.filter(row => withPrices ? kind(row) === 'prompt' : kind(row) !== 'precios');
  const prices = withPrices ? rows.filter(row => kind(row) === 'precios') : [];
  if (prompts.length > 1 || prices.length > 1) throw new Error('La respuesta contiene registros duplicados para el país y tipo. Recarga el documento antes de editar.');
  const prompt = prompts[0];
  if (prompt && (!Number.isInteger(Number(prompt.row_number)) || Number(prompt.row_number) <= 0 || typeof prompt.system_message !== 'string')) {
    throw new Error('El prompt recibido no tiene un row_number o contenido válido.');
  }
  return {
    prompt: prompt ? { ...prompt, row_number: Number(prompt.row_number) } : undefined,
    prices: prices[0],
  };
}

export function validatePromptIdentity(record: Pick<SystemMessage, 'row_number' | 'pais_sede' | 'Tipo'>, country: string, withPrices = false) {
  if (record.pais_sede !== country) throw new Error('El país del prompt no coincide con el país activo. Recarga el documento.');
  if (!Number.isInteger(record.row_number) || record.row_number <= 0) throw new Error('Falta el row_number del prompt. Recarga el documento.');
  const kind = String(record.Tipo ?? '').trim().toLowerCase();
  if (kind === 'precios' || (withPrices && kind !== 'prompt')) throw new Error('Solo se puede modificar el registro de tipo prompt.');
}
