import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function load(path, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  new Function('exports', 'require', outputText)(exports, name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  });
  return exports;
}

const { parseAgentResponse } = load('./src/utils/agentResponse.ts');
const reportDates = load('./src/utils/reportDates.ts');
const textUtils = load('./src/utils/textUtils.ts');
const clientHelpers = load('./src/utils/clientHelpers.ts', { './textUtils': textUtils });
const reports = load('./src/pages/Resultados/utils/dataProcessor.ts', { '../../../utils/textUtils': textUtils });

test('agent responses accept text and webhook envelopes without crashing on non-text values', () => {
  for (const response of ['Uno\\nDos', { respuesta: 'Uno\\nDos' }, [{ output: 'Uno\\nDos' }]]) {
    assert.equal(parseAgentResponse(response), 'Uno\nDos');
  }
  assert.equal(parseAgentResponse({ respuesta: 123 }), '123');
  assert.equal(parseAgentResponse({ code: 'pending' }), '{"code":"pending"}');
  assert.equal(parseAgentResponse(null), 'No se recibió respuesta del agente.');
});

test('Colombia shipping helpers keep legacy guide values and nullable stage fallbacks', () => {
  assert.equal(clientHelpers.getEnvioStatus(null, '000123', null).key, 'ida');
  assert.equal(clientHelpers.getEnvioStatus(null, 0, '000456').key, 'ida_y_retorno');
  assert.equal(clientHelpers.getEtapaColor(null), clientHelpers.getEtapaColor('Nuevo'));
  assert.equal(clientHelpers.getEtapaColor(undefined), clientHelpers.getEtapaColor('Nuevo'));
});

test('report ranges include the full final day and group a Sunday with the preceding Monday', () => {
  assert.equal(reportDates.getReportPeriod(new Date(2026, 0, 4), 'week').key, '2025-12-29');
  assert.equal(reportDates.isDateWithinReportRange(new Date(2026, 9, 8, 23, 59, 59), '2026-10-08', '2026-10-08'), true);
  assert.equal(reportDates.isDateWithinReportRange(new Date(2026, 9, 9), '2026-10-08', '2026-10-08'), false);
});

test('chart buckets preserve totals, per-source counts and unique contacts', () => {
  const rows = reports.optimizeClients([
    { row_number: 1, whatsapp: '001', created: '2026-10-08T15:00:00', source: 'Wiltech' },
    { row_number: 2, whatsapp: '001', created: '2026-10-08T16:00:00', source: 'Wiltech' },
    { row_number: 3, whatsapp: '002', created: '2026-10-08T17:00:00', source: 'Directo' },
  ]);
  const result = reports.generateChartData(rows, 'created', 'month', { from: '', to: '' });
  assert.equal(result.chartData.length, 1);
  assert.equal(result.chartData[0].total, 3);
  assert.equal(result.chartData[0].Wiltech, 2);
  assert.equal(result.chartData[0].Directo, 1);
  assert.equal(result.chartData[0].uniqueCount, 2);
  assert.equal('uniques' in result.chartData[0], false);
});

function diagnosticService(api) {
  return load('./src/services/diagnosticadorService.ts', {
    './apiService': { ApiService: api },
    './authService': { AuthService: { getPaisSede: () => 'Mexico' } },
    '../utils/agentDocument': load('./src/utils/agentDocument.ts'),
    '../utils/diagnosticFlow': load('./src/utils/diagnosticFlow.ts'),
  }).diagnosticoApi;
}

test('diagnostic creation and continuation normalize single-row and array responses', async () => {
  const calls = [];
  const api = diagnosticService({
    post: async (url, data) => { calls.push({ method: 'POST', url, data }); return [{ id: 15, respuestas: {} }]; },
    put: async (url, data) => { calls.push({ method: 'PUT', url, data }); return { id: 16, id_diagrama: 3, flow_name: 'reparacion', estado_diagnostico: 'completado' }; },
  });
  const created = await api.create({ id_diagrama: 2, flow_name: 'diagnostico' });
  assert.equal(created.id, 15);
  assert.equal(created.id_diagrama, 2);
  assert.equal(created.flow_name, 'diagnostico');
  assert.equal(created.estado, 'en_progreso');
  const continued = await api.create({ id_reparacion: 16, id_diagrama: 3, flow_name: 'reparacion' });
  assert.equal(continued.estado, 'completado');
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[1].method, 'PUT');
  assert.equal(calls[1].data.id, 16);
});

test('media uploads accept both supported response shapes and reject a missing file URL', async () => {
  const file = new File(['fixture'], 'revisión cámara.png', { type: 'image/png' });
  for (const response of [{ imagen_url: '/media/file.png' }, [{ imagen_url: '/media/file.png' }]]) {
    const api = diagnosticService({ postFile: async (url, form, headers) => {
      assert.equal(url, '/upload_file');
      assert.equal(form.get('upload_file').name, file.name);
      assert.equal(headers.filename, 'revision_camara.png');
      return response;
    } });
    assert.deepEqual(await api.upload(file, 'diagnostico'), { imagen_url: '/media/file.png' });
  }
  for (const response of [null, [], {}, { imagen_url: 42 }]) {
    await assert.rejects(diagnosticService({ postFile: async () => response }).upload(file, 'diagnostico'), /imagen_url/);
  }
});
