import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } });
  const exports = {};
  new Function('exports', 'require', outputText)(exports, name => {
    if (name in dependencies) return dependencies[name];
    if (['react', 'react/jsx-runtime', 'lucide-react'].includes(name)) return require(name);
    throw new Error(`Unexpected dependency: ${name}`);
  });
  return exports;
}
const textUtils = load('./src/utils/textUtils.ts');
const mexico = load('./src/utils/enviosMexico.ts', { './textUtils': textUtils });
const country = load('./src/utils/countryConfig.ts');
const guiaForm = load('./src/components/EnvioMexicoGuiaForm.tsx', { '../utils/enviosMexico': mexico });
const fixture = {
  row_number: 1, pais_sede: 'Mexico', guia_nombre_completo: 'Ana México',
  guia_telefono: '00525512345678', guia_email: 'ana@example.test',
  guia_ciudad: 'Cuauhtémoc', guia_departamento_estado: 'Ciudad de México',
  guia_direccion: 'Calle: Reforma | Núm. exterior: 0012 | Núm. interior: 03B | Colonia: Centro | C.P.: 06000 | Referencia: Portón: azul',
  modelo: 'iPhone 15', observaciones_tecnicas: 'Pantalla rota\r\nCódigo de desbloqueo del equipo: 001234\r\nConservar información',
  notas_cliente: 'Entrada: $350 MXN\nRetorno pendiente de informar',
  guia_numero_ida: '0001234567', guia_numero_retorno: '0007654321',
  valor_seguro: '12000', asegurado: 'No', created: '2026-10-08T10:00:00',
  agenda_ciudad_sede: 'Ciudad de México',
};

test('Mexico reads textual address components and never loses unrecognized fragments', () => {
  const address = mexico.parseMexicoAddress(fixture.guia_direccion);
  assert.equal(address.fields.find(field => field.label === 'C.P.').value, '06000');
  assert.equal(address.fields.find(field => field.label === 'Núm. exterior').value, '0012');
  assert.equal(address.fields.find(field => field.label === 'Referencia').value, 'Portón: azul');
  for (const original of ['Reforma 12, Centro, 06000', 'Calle: Reforma | Dato adicional: entregar atrás', 'Calle: Uno | Calle: Dos', 'Calle: Reforma | entregar después de las 5']) {
    assert.deepEqual(mexico.parseMexicoAddress(original), { original, fields: null });
  }
  assert.equal(mexico.parseMexicoAddress('Calle: Reforma | C.P.: 06000').fields.find(field => field.label === 'Núm. interior').value, 'No registrado');
});

test('unlock keys and missing values stay textual, including leading zeroes and negative answers', () => {
  assert.equal(mexico.extractMexicoUnlockCode(fixture.observaciones_tecnicas), '001234');
  assert.equal(mexico.extractMexicoUnlockCode('Código de desbloqueo del equipo: 00-A#9'), '00-A#9');
  for (const missing of [null, undefined, '', 'Sin código', 'Código de desbloqueo del equipo: ']) {
    assert.equal(mexico.extractMexicoUnlockCode(missing), 'No registrado');
  }
  assert.equal(mexico.mexicoDisplay('No'), 'No');
  assert.equal(mexico.mexicoDisplay('0000'), '0000');
  assert.equal(mexico.mexicoDisplay(null), 'No registrado');
});

test('Mexico never needs cedula and recognizes records with only a guide or contact field', () => {
  assert.equal(mexico.checkMexicoGuiaData(fixture).isComplete, true);
  assert.equal(mexico.checkMexicoGuiaData({ ...fixture, guia_email: null }).isComplete, false);
  for (const partial of [{ guia_numero_retorno: '0001' }, { guia_telefono: '001' }, { guia_email: 'a@example.test' }, { modo_recepcion: 'Envío' }]) {
    assert.equal(mexico.hasMexicoLogisticsData(partial), true);
  }
  assert.equal(mexico.hasMexicoLogisticsData({ guia_cedula_id: '123' }), false);
  assert.equal(mexico.mexicoShipmentStatus(fixture), 'Guías ida + retorno');
  assert.equal(mexico.isMexicoEnvioGestionado({ estado_etapa: 'ENVIO_GESTIONADO' }), true);
});

test('amounts distinguish entry cost, insurance and absent return cost', () => {
  assert.equal(mexico.formatMXN(mexico.COSTO_ENTRADA_MXN), '$350 MXN');
  assert.equal(mexico.formatMXN(fixture.valor_seguro), '$12,000 MXN');
  assert.equal(mexico.formatMXN('1,200.50'), '$1,200.5 MXN');
  assert.equal(mexico.formatMXN(0), '$0 MXN');
  assert.equal(mexico.formatMXN(null), 'No registrado');
  assert.equal(mexico.formatMXN('por confirmar'), 'por confirmar (MXN)');
});

test('Mexico shipping uses the existing envios permission and independent country activation', () => {
  for (const name of ['Mexico', 'México', ' mexico ']) {
    const defaults = country.parseCountryConfig(null, name);
    assert.equal(defaults.modulos['envios-mexico'], true);
    assert.equal(defaults.modulos['envios-colombia'], false);
    for (const role of ['envios', 'admin', 'root']) assert.equal(country.canAccessCountryPage('envios', role, defaults), true);
    assert.equal(country.canAccessCountryPage('envios', 'crm', defaults), false);
    assert.equal(country.canAssignCountryRole('envios', false, defaults), true);
  }
  const disabled = country.parseCountryConfig({ modulos: { 'envios-mexico': false, 'envios-colombia': true } }, 'Mexico');
  for (const role of ['envios', 'admin', 'root']) assert.equal(country.canAccessCountryPage('envios', role, disabled), false);
  const enabled = country.parseCountryConfig({ modulos: { 'envios-mexico': true } }, 'Mexico');
  assert.equal(country.canAccessCountryPage('envios', 'envios', enabled), true);
  assert.equal(country.canAccessCountryPage('envios', 'admin', country.parseCountryConfig({ modulos: { crm: true } }, 'Mexico')), false);
  const colombia = country.parseCountryConfig(null, 'Colombia');
  assert.equal(colombia.modulos['envios-colombia'], true);
  assert.equal(colombia.modulos['envios-mexico'], false);
  assert.equal(country.canAccessCountryPage('envios', 'envios', colombia), true);
});

test('detail renders registered fields, unlock code and manual guide inputs without generation controls', () => {
  const { EnvioMexicoDetailModal } = load('./src/components/EnvioMexicoDetailModal.tsx', {
    'react-dom': { createPortal: child => child }, '../utils/enviosMexico': mexico,
    './EnvioMexicoGuiaForm': guiaForm,
  });
  const previousDocument = globalThis.document;
  globalThis.document = { body: {} };
  try {
    const html = renderToStaticMarkup(React.createElement(EnvioMexicoDetailModal, { client: fixture, onClose() {} }));
    for (const text of ['DHL', 'Ana México', '00525512345678', 'ana@example.test', '06000', '0012', '03B', '001234', '0001234567', '0007654321', '$350 MXN', '$12,000 MXN', 'Retorno pendiente de informar']) assert.ok(html.includes(text), text);
    assert.match(html, /Costo del envío de retorno<\/dt><dd[^>]*>No registrado/);
    assert.doesNotMatch(html, /<textarea|Generar|Servientrega|COP|cédula/i);
    assert.match(html, /type="text" name="guia_numero_ida"/);
    assert.match(html, /type="text" name="guia_numero_retorno"/);
    assert.match(html, /Guardar guías/);
    const absent = renderToStaticMarkup(React.createElement(EnvioMexicoDetailModal, { client: { nombre: 'Wrong name', whatsapp: 'Wrong phone' }, onClose() {} }));
    assert.doesNotMatch(absent, /Wrong name|Wrong phone/);
    assert.match(absent, /No registrado/);
  } finally { globalThis.document = previousDocument; }
});

function pageHarness({ rows = [fixture], role = 'envios', search = '', sede = 'Todas', tab = 'PENDIENTES', sort = 'last_msg_desc', failSave = false } = {}) {
  const states = [rows, false, null, search, sede, tab, sort, null, false, null, false];
  const effects = [];
  const requests = [];
  const updates = [];
  const writes = [];
  let index = 0;
  const noop = () => {};
  const { EnviosMexicoPage } = load('./src/pages/EnviosMexicoPage.tsx', {
    react: { ...React, useRef: value => ({ current: value }), useState: () => { const slot = index++; return [states[slot], value => updates.push({ slot, value })]; }, useMemo: fn => fn(), useCallback: fn => fn, useDeferredValue: value => value, useEffect: fn => effects.push(fn) },
    '../components/RepairLoader': { RepairLoader: () => null },
    '../components/Pagination': { Pagination: () => null },
    '../hooks/usePagination': { usePagination: rows => ({ items: rows }) },
    '../services/apiService': { ApiService: { invalidateCache: noop } },
    '../services/clientService': { ClientService: {
      getEnviosClients: async options => { requests.push(options); return rows; },
      updateClient: async payload => { writes.push(payload); if (failSave) throw new Error('No se pudo guardar'); return payload; },
    } },
    '../components/EnvioMexicoDetailModal': { EnvioMexicoDetailModal: () => null },
    '../components/EnviosMexicoReportModal': { EnviosMexicoReportModal: () => null },
    '../utils/textUtils': textUtils, '../utils/enviosMexico': mexico, '../utils/countryConfig': country,
    '../hooks/useCountryConfig': { useCountryConfig: () => ({ country: 'Mexico' }) },
    '../hooks/useAuth': { useAuth: () => ({ user: { role } }) },
  });
  const tree = EnviosMexicoPage();
  return { tree, html: renderToStaticMarkup(tree), effects, requests, updates, writes };
}

test('Mexico list retains filters, report permissions and manual controls without carrier generation', async () => {
  const result = pageHarness();
  assert.match(result.html, /Ana México/);
  assert.match(result.html, /00525512345678/);
  assert.doesNotMatch(result.html, /Generar|etiqueta|Marcar gestionado|Reabrir envío|Bot ON|Reportes|cédula|Servientrega|Bucaramanga/i);
  assert.match(result.html, /Marcar como gestionado/);
  assert.match(result.html, /Registrar guías/);
  assert.match(pageHarness({ role: 'admin' }).html, /Reportes/);
  assert.match(pageHarness({ role: 'root' }).html, /Reportes/);
  assert.doesNotMatch(pageHarness({ search: 'nobody' }).html, /Ana México/);
  assert.match(pageHarness({ search: '0007654321' }).html, /Ana México/);
  assert.doesNotMatch(pageHarness({ sede: 'Otra sede' }).html, /Ana México/);
  assert.doesNotMatch(pageHarness({ tab: 'GESTIONADOS' }).html, /Ana México/);
  assert.match(pageHarness({ rows: [{ ...fixture, estado_etapa: 'ENVIO_GESTIONADO' }], tab: 'GESTIONADOS' }).html, /Ana México/);
  result.effects[0]();
  await Promise.resolve();
  assert.deepEqual(result.requests, [{ force: false }]);
});

test('Mexico discards records explicitly belonging to another country from the read response', async () => {
  const result = pageHarness({ rows: [fixture, { ...fixture, row_number: 2, pais_sede: 'Colombia' }] });
  result.effects[0]();
  await Promise.resolve();
  assert.deepEqual(result.updates.find(update => update.slot === 0).value, [fixture]);
});

function elements(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children)];
}

test('marking managed saves the existing status and assistance category and updates local lists', async () => {
  const result = pageHarness({ rows: [{ ...fixture, categoria_contacto: 'SOLICITUD_AYUDA' }] });
  const button = elements(result.tree).find(element => element.type === 'button' && renderToStaticMarkup(element).includes('Marcar como gestionado'));
  const previousWindow = globalThis.window;
  const events = [];
  globalThis.window = { dispatchEvent: event => events.push(event) };
  try {
    button.props.onClick({ stopPropagation() {} });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(result.writes, [{ row_number: 1, estado_etapa: 'ENVIO_GESTIONADO', categoria_contacto: 'SOLICITUD_AYUDA_GESTIONADA' }]);
    const update = result.updates.find(update => update.slot === 0);
    assert.equal(update.value([fixture])[0].estado_etapa, 'ENVIO_GESTIONADO');
    assert.equal(events[0].detail.pais_sede, 'Mexico');
    const failed = pageHarness({ failSave: true });
    elements(failed.tree).find(element => element.type === 'button' && renderToStaticMarkup(element).includes('Marcar como gestionado')).props.onClick({ stopPropagation() {} });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(failed.updates.some(update => update.slot === 0), false);
    assert.ok(failed.updates.some(update => update.slot === 2 && update.value === 'No se pudo guardar'));
  } finally { globalThis.window = previousWindow; }
});

function formHarness(onSave) {
  const states = [];
  const refs = [];
  let index = 0;
  let refIndex = 0;
  const { EnvioMexicoGuiaForm } = load('./src/components/EnvioMexicoGuiaForm.tsx', {
    '../utils/enviosMexico': mexico,
    react: {
      useState: initial => {
        const slot = index++;
        if (!(slot in states)) states[slot] = initial;
        return [states[slot], value => { states[slot] = typeof value === 'function' ? value(states[slot]) : value; }];
      },
      useRef: initial => { const slot = refIndex++; return refs[slot] ??= { current: initial }; },
    },
  });
  return () => { index = 0; refIndex = 0; return EnvioMexicoGuiaForm({ client: fixture, onSave }); };
}

test('manual guide form preserves leading zeroes and only saves edited guide fields', async () => {
  const writes = [];
  const render = formHarness(async changes => writes.push(changes));
  elements(render()).find(element => element.props?.name === 'guia_numero_ida').props.onChange({ target: { value: '00009876' } });
  await render().props.onSubmit({ preventDefault() {} });
  assert.deepEqual(writes, [{ guia_numero_ida: '00009876' }]);
  assert.match(renderToStaticMarkup(render()), /Guías guardadas/);
});

test('failed guide saves retain the draft for retry and concurrent submissions do not duplicate writes', async () => {
  const renderFailed = formHarness(async () => { throw new Error('Error de conexión'); });
  elements(renderFailed()).find(element => element.props?.name === 'guia_numero_retorno').props.onChange({ target: { value: '0000-RET' } });
  await renderFailed().props.onSubmit({ preventDefault() {} });
  assert.equal(elements(renderFailed()).find(element => element.props?.name === 'guia_numero_retorno').props.value, '0000-RET');
  assert.match(renderToStaticMarkup(renderFailed()), /Error de conexión/);
  let resolveSave;
  let calls = 0;
  const render = formHarness(() => { calls++; return new Promise(resolve => { resolveSave = resolve; }); });
  elements(render()).find(element => element.props?.name === 'guia_numero_ida').props.onChange({ target: { value: '000002' } });
  const submit = render().props.onSubmit;
  const pending = submit({ preventDefault() {} });
  await submit({ preventDefault() {} });
  assert.equal(calls, 1);
  resolveSave();
  await pending;
});
