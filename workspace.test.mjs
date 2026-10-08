import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Run the actual TypeScript modules in memory, without a browser or live API.
function load(path, dependencies = {}) {
  const source = readFileSync(new URL('./' + path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  new Function('exports', 'require', outputText)(exports, name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  });
  return exports;
}
const { RequestCache } = load('src/utils/requestCache.ts');
const { paginationRange } = load('src/utils/pagination.ts');
const { splitAgentSections } = load('src/utils/agentSections.ts');
const agentDocument = load('src/utils/agentDocument.ts');
const countryConfig = load('src/utils/countryConfig.ts');
const diagnosticFlow = load('src/utils/diagnosticFlow.ts');

test('hosted chat defaults stay isolated by country and allow overrides or disabling', () => {
  const mexico = 'https://n8n.alliasoft.com/webhook/76edb881-62e9-403d-9b28-dcf419578e1e/chat';
  const colombia = 'https://n8n.alliasoft.com/webhook/05f7a0cc-521d-464f-8072-663d257bc021/chat';
  for (const name of ['Mexico', 'México', ' mexico ']) {
    assert.equal(countryConfig.parseCountryConfig(null, name).chat_webhook_url, mexico);
  }
  assert.equal(countryConfig.parseCountryConfig({ modulos: { crm: true } }, 'Colombia').chat_webhook_url, colombia);
  assert.equal(countryConfig.parseCountryConfig(null, 'Peru').chat_webhook_url, '');
  assert.equal(countryConfig.parseCountryConfig({ chat_webhook_url: '' }, 'Mexico').chat_webhook_url, '');
  assert.equal(countryConfig.parseCountryConfig('{"chat_webhook_url":" https://example.com/test/chat?mode=test "}', 'Colombia').chat_webhook_url, 'https://example.com/test/chat?mode=test');
  for (const value of ['javascript:alert(1)', 'data:text/html,test', '//example.com/chat', 'invalid', 'https://user:secret@example.com/chat', 42]) {
    assert.throws(() => countryConfig.parseCountryConfig({ chat_webhook_url: value }, 'Mexico'));
  }
});

test('root saves the hosted URL in the active country configuration and preserves other fields', async () => {
  let country = 'Mexico';
  let root = true;
  const writes = [];
  const { CountryService } = load('src/services/countryService.ts', {
    './apiService': { ApiService: {
      put: async (endpoint, body) => writes.push({ method: 'PUT', endpoint, body }),
      post: async (endpoint, body) => writes.push({ method: 'POST', endpoint, body }),
    } },
    './authService': { AuthService: { getPaisSede: () => country, isRoot: () => root } },
    '../utils/countryConfig': countryConfig,
  });
  const record = { id: 2, pais_sede: 'Mexico' };
  const config = countryConfig.parseCountryConfig({ chat_webhook_url: 'https://example.com/mexico/chat', ciudades: ['CDMX'], extra: { preserved: true } }, country);
  await CountryService.save(record, config);
  assert.deepEqual(writes[0], { method: 'PUT', endpoint: '/paises', body: { id_pais: 2, pais_sede: 'Mexico', configuracion: config } });
  country = 'Colombia';
  await assert.rejects(CountryService.save(record, config));
  await CountryService.save(null, countryConfig.parseCountryConfig(null, country));
  assert.equal(writes[1].method, 'POST');
  assert.equal(writes[1].body.pais_sede, 'Colombia');
  assert.match(writes[1].body.configuracion.chat_webhook_url, /05f7a0cc/);
  root = false;
  await assert.rejects(CountryService.save(null, config));
  assert.equal(writes.length, 2);
});

test('assignable roles follow country modules, including shipping and legacy aliases', () => {
  const config = countryConfig.parseCountryConfig({ modulos: { crm: true, conversaciones: true, reparaciones: true } }, 'Mexico');
  for (const role of ['root', 'agenda', 'envios', 'web1', 'diagnosticador']) {
    assert.equal(countryConfig.canAssignCountryRole(role, false, config), false);
  }
  for (const role of ['admin', 'crm', 'conversaciones', 'reparaciones']) {
    assert.equal(countryConfig.canAssignCountryRole(role, false, config), true);
  }
  assert.equal(countryConfig.canAssignCountryRole('root', true, config), true);
  config.modulos['envios-colombia'] = true;
  assert.equal(countryConfig.canAssignCountryRole('envios', false, config), true);
});

test('country modules deny admin and root while root keeps configuration access', () => {
  const config = countryConfig.parseCountryConfig({ modulos: { crm: true }, ciudades: [] }, 'Mexico');
  for (const role of ['admin', 'root']) {
    assert.equal(countryConfig.canAccessCountryPage('reparaciones', role, config), false);
    assert.equal(countryConfig.canAccessCountryPage('crm', role, config), true);
  }
  assert.equal(countryConfig.canAccessCountryPage('paises', 'root', config), true);
  assert.equal(countryConfig.canAccessCountryPage('paises', 'admin', config), false);
  assert.equal(countryConfig.parseCountryConfig(null, 'Mexico').modulos['envios-colombia'], false);
  assert.equal(countryConfig.normalizeCity(' bogota ', ['Bogotá']), 'Bogotá');
});

test('Mexico empty diagrams retain actual IDs and flow names without Colombia data', () => {
  const rows = diagnosticFlow.normalizeFlowRows([
    { id: 1, pais_sede: 'Colombia', flow_name: 'diagnostico', configuracion: {} },
    { id: 4, pais_sede: 'Mexico', flow_name: 'reparacion', configuracion: null },
    { id: 3, pais_sede: 'Mexico', flow_name: 'diagnostico', configuracion: null },
  ], 'Mexico');
  assert.deepEqual(rows.map(row => row.id), [4, 3]);
  assert.equal(rows.find(row => row.flow_name === 'diagnostico').id, 3);
  assert.deepEqual(rows[0].configuracion.steps, []);
  assert.equal(diagnosticFlow.withEmptyCountryFlows(rows, 'Mexico').length, 2);
  const drafts = diagnosticFlow.withEmptyCountryFlows([], 'Mexico');
  assert.equal(drafts.length, 2);
  assert.ok(drafts.every(row => row.isNew && row.pais_sede === 'Mexico'));
});

test('agent documents select the country and Tipo regardless of response order', () => {
  const rows = [
    { row_number: 2, pais_sede: 'Colombia', Tipo: 'precios', system_message: '{"data":[]}' },
    { row_number: 9, pais_sede: 'Mexico', Tipo: 'prompt', system_message: 'Prompt Mexico' },
    { row_number: 1, pais_sede: 'Colombia', Tipo: 'prompt', system_message: 'Prompt Colombia' },
  ];
  const selected = agentDocument.selectAgentDocument(rows, 'Colombia', true);
  assert.equal(selected.prompt.row_number, 1);
  assert.equal(selected.prices.row_number, 2);
  const mexico = agentDocument.selectAgentDocument(rows, 'Mexico', true);
  assert.equal(mexico.prompt.row_number, 9);
  assert.equal(mexico.prices, undefined);
  assert.equal(agentDocument.selectAgentDocument([rows[0]], 'Colombia', true).prompt, undefined);
  assert.equal(agentDocument.selectAgentDocument([{ row_number: 1, system_message: 'Missing country' }], 'Colombia').prompt, undefined);
  assert.throws(() => agentDocument.selectAgentDocument([rows[2], rows[2]], 'Colombia', true));
  assert.throws(() => agentDocument.selectAgentDocument([{ ...rows[2], row_number: null }], 'Colombia', true));
});

test('prompt saves preserve the loaded row and country and never write the price record', async () => {
  let country = 'Colombia';
  const writes = [];
  const { AgenteService } = load('src/services/agenteService.ts', {
    './apiService': { ApiService: { post: async (endpoint, body) => { writes.push({ endpoint, body }); return body; } } },
    './authService': { AuthService: { getPaisSede: () => country } },
    '../utils/agentDocument': agentDocument,
  });
  const record = { row_number: 23, pais_sede: country, Tipo: 'prompt' };
  await AgenteService.updateSystemMessage('Updated CRM', 'WiltechCRM', record);
  assert.deepEqual(writes.at(-1), { endpoint: '/system_message_crm', body: { system_message: 'Updated CRM', row_number: 23, pais_sede: 'Colombia' } });
  await AgenteService.updateSystemMessage('Updated prices prompt', 'WiltechPrecios', record);
  assert.equal(writes.at(-1).body.Tipo, 'prompt');
  await assert.rejects(AgenteService.updateSystemMessage('Forbidden', 'WiltechPrecios', { ...record, Tipo: 'precios' }));
  await assert.rejects(AgenteService.updateSystemMessage('Missing type', 'WiltechPrecios', { ...record, Tipo: undefined }));
  country = 'Mexico';
  await assert.rejects(AgenteService.updateSystemMessage('Stale country', 'WiltechCRM', record));
  await AgenteService.updateSystemMessage('Mexico', 'WiltechCRM', { ...record, row_number: 42, pais_sede: country });
  assert.equal(writes.at(-1).body.row_number, 42);
  assert.equal(writes.at(-1).body.pais_sede, 'Mexico');
  assert.equal(writes.length, 3);
});

test('large datasets mount only the requested page, including the last partial page', () => {
  const rows = Array.from({ length: 10003 }, (_, index) => index);
  const range = paginationRange(rows.length, 401, 25);
  assert.deepEqual(rows.slice(range.start, range.end), [10000, 10001, 10002]);
  assert.equal(range.totalPages, 401);
  assert.equal(paginationRange(rows.length, 2, 25).start, 25);
});

test('empty results and removed last rows cannot leave pagination on a missing page', () => {
  assert.deepEqual(paginationRange(0, 8, 25), { page: 1, totalPages: 1, start: 0, end: 0 });
  assert.equal(paginationRange(25, 2, 25).page, 1);
  assert.equal(paginationRange(10, -5, 0).page, 1);
});

test('concurrent readers share a request and reuse its successful result', async () => {
  const cache = new RequestCache();
  let calls = 0;
  const loader = async () => { calls++; return ['client']; };
  assert.deepEqual(await Promise.all([cache.get('clients', loader, 1000), cache.get('clients', loader, 1000)]), [['client'], ['client']]);
  await cache.get('clients', loader, 1000);
  assert.equal(calls, 1);
});

test('expired results are fetched again and failed requests can be retried', async () => {
  const cache = new RequestCache();
  let calls = 0;
  await cache.get('clients', async () => ++calls, -1);
  assert.equal(await cache.get('clients', async () => ++calls, 1000), 2);
  await assert.rejects(cache.get('error', async () => { throw new Error('offline'); }, 1000));
  assert.equal(await cache.get('error', async () => 'online', 1000), 'online');
});

test('manual refresh cannot be overwritten by an older pending response', async () => {
  const cache = new RequestCache();
  let resolveOld;
  const old = cache.get('clients', () => new Promise(resolve => { resolveOld = resolve; }), 1000);
  await Promise.resolve();
  assert.equal(await cache.get('clients', async () => 'fresh', 1000, true), 'fresh');
  resolveOld('old');
  await old;
  assert.equal(await cache.get('clients', async () => 'unexpected', 1000), 'fresh');
});

test('invalidation prevents an in-flight response from repopulating the cache', async () => {
  const cache = new RequestCache();
  let resolve;
  const request = cache.get('clients', () => new Promise(done => { resolve = done; }), 1000);
  await Promise.resolve();
  cache.clear();
  resolve('before edit');
  await request;
  assert.equal(await cache.get('clients', async () => 'after edit', 1000), 'after edit');
});

test('cache remains bounded across many distinct reads', async () => {
  const cache = new RequestCache();
  for (let i = 0; i < 25; i++) await cache.get(String(i), async () => i, 1000);
  assert.equal(await cache.get('0', async () => 'refetched', 1000), 'refetched');
});

test('API reads isolate sessions, honor refresh and invalidate after saving', async t => {
  let token = 'session-a';
  let country = 'Colombia';
  let reads = 0;
  const { ApiService } = load('src/services/apiService.ts', {
    './authService': { AuthService: { getToken: () => token, getPaisSede: () => country, logout: () => { token = null; } } },
    './countryRequest': { countryFetch: (...args) => fetch(...args) },
    '../utils/requestCache': { RequestCache },
  });
  t.mock.method(globalThis, 'fetch', async (_url, init) => new Response(JSON.stringify(init.method === 'GET' ? { token, revision: ++reads } : { saved: true })));
  const read = () => ApiService.get('/clientes', { ttl: 1000 });
  assert.equal((await read()).revision, 1);
  assert.equal((await read()).revision, 1);
  token = 'session-b';
  assert.deepEqual(await read(), { token: 'session-b', revision: 2 });
  assert.equal((await ApiService.get('/clientes', { ttl: 1000, force: true })).revision, 3);
  await ApiService.post('/clientes', { name: 'updated' });
  assert.equal((await read()).revision, 4);
  country = 'México';
  assert.equal((await read()).revision, 5);
});

test('login preserves comma-separated country permissions and selection rejects unauthorized countries', async t => {
  const previousLocal = globalThis.localStorage;
  const previousSession = globalThis.sessionStorage;
  const storage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };
  globalThis.localStorage = storage();
  globalThis.sessionStorage = storage();
  t.after(() => {
    if (previousLocal === undefined) delete globalThis.localStorage; else globalThis.localStorage = previousLocal;
    if (previousSession === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = previousSession;
  });
  const { AuthService } = load('src/services/authService.ts');
  for (const input of ['[Colombia,Mexico]', '["Colombia", "Mexico"]', ['Colombia', 'Mexico'], ' Colombia, Mexico ']) {
    assert.deepEqual(AuthService.parseCountries(input), ['Colombia', 'Mexico']);
  }
  localStorage.setItem('wiltech_user', JSON.stringify({ role: 'root', pais_sede: '[Colombia,Mexico]' }));
  assert.deepEqual(AuthService.getAllowedCountries(), ['Colombia', 'Mexico']);
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify([{ token: 'test', rol: 'root', pais_sede: ' Colombia, México ,Colombia, ' }])));
  await AuthService.login({ email: 'test@example.com', password: 'test' });
  assert.deepEqual(AuthService.getAllowedCountries(), ['Colombia', 'México']);
  assert.equal(AuthService.getPaisSede(), 'Colombia');
  AuthService.setPaisSede('México');
  assert.equal(AuthService.getPaisSede(), 'México');
  assert.throws(() => AuthService.setPaisSede('Perú'));
  for (const role of ['admin', 'crm', undefined]) {
    localStorage.setItem('wiltech_user', JSON.stringify({ role, pais_sede: 'Mexico,Colombia' }));
    sessionStorage.setItem('wiltech_active_country', 'Colombia');
    assert.deepEqual(AuthService.getAllowedCountries(), ['Mexico']);
    assert.equal(AuthService.getPaisSede(), 'Mexico');
    assert.throws(() => AuthService.setPaisSede('Colombia'));
  }
  AuthService.logout();
  assert.throws(() => AuthService.getPaisSede());
});

test('Markdown sections preserve fenced examples, embedded headings and shorter fences', () => {
  const text = '# Reglas\n\nEjemplo:\n````md\n# No es una sección\n```\n## Tampoco\n````\n\n## Respuesta\n\nTexto';
  const sections = splitAgentSections(text);
  assert.equal(sections.length, 2);
  assert.ok(sections[0].includes('# No es una sección\n```\n## Tampoco'));
  assert.equal(sections[1], '## Respuesta\n\nTexto');
  assert.equal(splitAgentSections('# A\n~~~\n## B\n~~~\n# C').length, 2);
});

test('empty agent documents stay empty and paragraphs without headings survive', () => {
  assert.deepEqual(splitAgentSections(' \n\t'), []);
  assert.deepEqual(splitAgentSections('Intro\r\n\r\n## Regla\r\nTexto'), ['Intro', '## Regla\nTexto']);
});

test('user administration isolates countries and reserves root and country assignment for root', async () => {
  const { AuthService: parser } = load('src/services/authService.ts');
  let root = false;
  const users = [
    { id: 1, email: 'co@example.com', rol: 'admin', pais_sede: 'Colombia,Mexico', ciudad: 'Bogotá' },
    { id: 2, email: 'mx@example.com', rol: 'admin', pais_sede: 'Mexico' },
    { id: 3, email: 'root@example.com', rol: 'admin,root', pais_sede: 'Colombia' },
  ];
  const writes = [];
  const { UserService } = load('src/services/userService.ts', {
    './countryService': { CountryService: { get: async () => ({ configuracion: { modulos: { crm: true, usuarios: true } } }) } },
    '../utils/countryConfig': countryConfig,
    './authService': { AuthService: { parseCountries: value => parser.parseCountries(value), isRoot: () => root, getToken: () => 'test', getPaisSede: () => 'Colombia', getAllowedCountries: () => ['Colombia', 'Mexico'] } },
    './countryRequest': { countryFetch: async (url, init, permissions) => {
      if (init.method === 'GET') return new Response(JSON.stringify(users));
      writes.push({ url, body: init.body, permissions });
      return new Response('ok');
    } },
  });
  assert.deepEqual((await UserService.getAllUsers()).map(user => user.id), [1, 3]);
  await assert.rejects(UserService.createUser({ email: 'new', password: 'test', rol: 'admin,root' }));
  await assert.rejects(UserService.createUser({ email: 'new', password: 'test', rol: 'admin', pais_sede: 'Mexico' }));
  await assert.rejects(UserService.modifyUser({ id: 2, email: 'mx', rol: 'admin' }));
  await assert.rejects(UserService.changePassword({ id: 3, password: 'test' }));
  await assert.rejects(UserService.createUser({ email: 'new', password: 'test', rol: 'envios' }));
  await assert.rejects(UserService.modifyUser({ id: 1, email: 'co', rol: 'admin,agenda' }));
  assert.equal(writes.length, 0);
  await UserService.modifyUser({ id: 1, email: 'co', rol: 'admin' });
  assert.equal(writes.at(-1).body.get('pais_sede'), 'Colombia,Mexico');
  assert.equal(writes.at(-1).body.get('ciudad'), 'Bogotá');
  root = true;
  await UserService.createUser({ email: 'new', password: 'test', rol: 'root', pais_sede: 'Colombia,Mexico' });
  assert.equal(writes.at(-1).body.get('pais_sede'), 'Colombia,Mexico');
  assert.equal(writes.at(-1).permissions, true);
  await assert.rejects(UserService.createUser({ email: 'new', password: 'test', rol: 'root', pais_sede: 'Peru' }));
});

test('country requests scope prompts, repairs, shipping and uploads and reject cross-country writes', async t => {
  let country = 'Colombia';
  const { countryFetch } = load('src/services/countryRequest.ts', {
    './authService': { AuthService: { getPaisSede: () => { if (!country) throw new Error('missing country'); return country; } } },
  });
  const previousWindow = globalThis.window;
  globalThis.window = { location: { origin: 'https://app.example' } };
  t.after(() => { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => { calls.push({ url, init }); return new Response('{}'); });
  for (const endpoint of ['/system_message', '/system_messageBga', '/system_message_crm', '/system_message_precios', '/diagnosticador/system_message_agente', '/reparaciones', '/envios', '/guia-recogida']) {
    await countryFetch(endpoint + '?existing=1');
    assert.equal(new URL(calls.at(-1).url).searchParams.get('pais_sede'), country);
    assert.equal(new URL(calls.at(-1).url).searchParams.get('existing'), '1');
    await countryFetch(endpoint, { method: 'POST', body: JSON.stringify({ id: 1 }) });
    assert.equal(JSON.parse(calls.at(-1).init.body).pais_sede, country);
  }
  country = 'México';
  const form = new FormData();
  form.append('filename', 'repair.jpg');
  await countryFetch('/upload_file', { method: 'POST', body: form });
  assert.equal(calls.at(-1).init.body.get('pais_sede'), 'México');
  assert.equal(form.has('pais_sede'), false);
  const permissions = new FormData();
  permissions.set('pais_sede', 'Colombia,México');
  await countryFetch('https://n8n.alliasoft.com/webhook/wiltech/usuarios', { method: 'POST', body: permissions }, true);
  assert.equal(calls.at(-1).init.body.get('pais_sede'), 'Colombia,México');
  assert.equal(new URL(calls.at(-1).url).searchParams.get('pais_sede'), 'México');
  assert.throws(() => countryFetch('/reparaciones', { method: 'POST', body: permissions }, true));
  for (let instance = 1; instance <= 15; instance++) {
    await countryFetch(`/webhook/wiltech/wppconnect?id_instancia=${instance}`);
    const url = new URL(calls.at(-1).url);
    assert.equal(url.pathname, '/webhook/wiltech/wppconnect');
    assert.equal(url.searchParams.get('id_instancia'), String(instance));
    assert.equal(url.searchParams.get('pais_sede'), 'México');
  }
  assert.throws(() => countryFetch('/reparaciones', { method: 'PUT', body: JSON.stringify({ pais_sede: 'Colombia' }) }));
  const count = calls.length;
  country = '';
  assert.throws(() => countryFetch('/envios'));
  assert.equal(calls.length, count);
});
