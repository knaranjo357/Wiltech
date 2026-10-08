/** Normalize the supported webhook envelopes without assuming a response shape. */
export function parseAgentResponse(response: unknown): string {
  if (!response) return 'No se recibió respuesta del agente.';
  const value: unknown = Array.isArray(response) && response.length ? response[0] : response;
  if (typeof value === 'string') return value.replace(/\\n/g, '\n');
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const text = record.respuesta || record.response || record.output || record.text || JSON.stringify(value);
    return String(text).replace(/\\n/g, '\n');
  }
  return String(value).replace(/\\n/g, '\n');
}
