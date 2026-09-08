import type { FlowConfig, FlowData } from '../types/diagnosticador';

export function normalizeFlowConfig(raw: unknown, flowName: string): FlowConfig {
  if (typeof raw === 'string') raw = raw.trim() ? JSON.parse(raw) : null;
  if (raw === null || raw === undefined || (Array.isArray(raw) && raw.length === 0)) raw = {};
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('El JSON del diagrama debe ser un objeto.');
  const config = raw as Partial<FlowConfig>;
  const steps = config.steps ?? [];
  if (!Array.isArray(steps) || steps.some(step => !step || typeof step !== 'object' || typeof step.id !== 'string')) throw new Error('El diagrama contiene pasos inválidos.');
  return { ...config, name: config.name ?? (flowName === 'diagnostico' ? 'Diagnóstico' : flowName === 'reparacion' ? 'Reparación' : flowName), flow_id: config.flow_id ?? flowName, version: config.version ?? '1.0', start_step: config.start_step ?? '', steps };
}

export function normalizeFlowRows(data: unknown, country: string): FlowData[] {
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows.filter(row => row?.pais_sede === country).map(row => {
    if (!Number.isInteger(Number(row.id)) || Number(row.id) <= 0 || !row.flow_name) throw new Error('El diagrama no tiene ID o flow_name válido.');
    return { ...row, id: Number(row.id), configuracion: normalizeFlowConfig(row.configuracion, row.flow_name) };
  });
}

export function withEmptyCountryFlows(rows: FlowData[], country: string): FlowData[] {
  const result = [...rows];
  ['diagnostico', 'reparacion'].forEach((name, index) => {
    if (!result.some(flow => flow.flow_name === name)) result.push({ id: -(index + 1), flow_name: name, pais_sede: country, isNew: true, configuracion: normalizeFlowConfig(null, name) });
  });
  return result;
}
