import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runChecks, loadConfig, buildChecks } from './doctor-checks.mjs';

const CFG = { qdrantUrl: 'http://q:6333', qdrantApiKey: '', aiServiceUrl: 'http://ai:8001', aiServiceToken: 't', serverUrl: 'http://s:3000' };

function ctxWith({ exec, fetchFn }) {
  return { config: CFG, exec: exec ?? (() => ({ ok: true, stdout: '' })), fetchFn: fetchFn ?? (async () => ({ ok: true, status: 200, json: async () => ({}) })) };
}
function byName(checks, name) { return checks.find((c) => c.name.includes(name)); }

test('runChecks: tout PASS -> exitCode 0', async () => {
  const checks = [
    { name: 'a', run: async () => {} },
    { name: 'b', run: async () => {} },
  ];
  const lines = [];
  const summary = await runChecks(checks, { log: (l) => lines.push(l) });
  assert.equal(summary.failed, 0);
  assert.equal(summary.exitCode, 0);
  assert.ok(lines.some((l) => l.includes('PASS') && l.includes('a')));
});

test('runChecks: un FAIL -> exitCode 1 + raison affichée', async () => {
  const checks = [
    { name: 'ok', run: async () => {} },
    { name: 'bad', run: async () => { throw new Error('qdrant injoignable'); } },
  ];
  const lines = [];
  const summary = await runChecks(checks, { log: (l) => lines.push(l) });
  assert.equal(summary.failed, 1);
  assert.equal(summary.exitCode, 1);
  assert.ok(lines.some((l) => l.includes('FAIL') && l.includes('bad') && l.includes('qdrant injoignable')));
});

test('runChecks: un SKIP est visible et ne compte pas comme FAIL', async () => {
  const SKIP = Symbol.for('doctor.skip');
  const checks = [
    { name: 'cond', run: async () => { const e = new Error('server non lancé'); e[SKIP] = true; throw e; } },
  ];
  const lines = [];
  const summary = await runChecks(checks, { log: (l) => lines.push(l) });
  assert.equal(summary.failed, 0);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.exitCode, 0);
  assert.ok(lines.some((l) => l.includes('SKIP') && l.includes('server non lancé')));
});

test('loadConfig: défauts localhost quand rien fourni', () => {
  const cfg = loadConfig({ processEnv: {}, readEnvFile: () => ({}) });
  assert.equal(cfg.qdrantUrl, 'http://localhost:6333');
  assert.equal(cfg.aiServiceUrl, 'http://localhost:8001');
  assert.equal(cfg.serverUrl, 'http://localhost:3000');
});

test('loadConfig: .env server prioritaire sur défaut, processEnv prioritaire sur .env', () => {
  const cfg = loadConfig({
    processEnv: { AI_SERVICE_TOKEN: 'from-shell' },
    readEnvFile: (p) => (p.includes('server') ? { QDRANT_URL: 'http://q:6333', AI_SERVICE_TOKEN: 'from-file' } : {}),
  });
  assert.equal(cfg.qdrantUrl, 'http://q:6333');
  assert.equal(cfg.aiServiceToken, 'from-shell');
});

test('check conteneurs: FAIL si qdrant absent du ps', async () => {
  const psJson = ['{"Service":"postgres","Health":"healthy","State":"running"}',
                  '{"Service":"ai-service","Health":"healthy","State":"running"}'].join('\n');
  const checks = buildChecks(ctxWith({ exec: () => ({ ok: true, stdout: psJson }) }), { full: false });
  await assert.rejects(byName(checks, 'conteneurs').run(), /qdrant/);
});

test('check conteneurs: FAIL si un service non healthy', async () => {
  const psJson = ['{"Service":"postgres","Health":"starting","State":"running"}',
                  '{"Service":"qdrant","Health":"healthy","State":"running"}',
                  '{"Service":"ai-service","Health":"healthy","State":"running"}'].join('\n');
  const checks = buildChecks(ctxWith({ exec: () => ({ ok: true, stdout: psJson }) }), { full: false });
  await assert.rejects(byName(checks, 'conteneurs').run(), /postgres/);
});

test('check conteneurs: PASS si les 3 healthy', async () => {
  const psJson = ['postgres','qdrant','ai-service'].map((s) => `{"Service":"${s}","Health":"healthy","State":"running"}`).join('\n');
  const checks = buildChecks(ctxWith({ exec: () => ({ ok: true, stdout: psJson }) }), { full: false });
  await byName(checks, 'conteneurs').run(); // ne lève pas
});

test('check ai-service /health: FAIL si embed_loaded false', async () => {
  const fetchFn = async () => ({ ok: true, status: 200, json: async () => ({ status: 'loading', embed_loaded: false }) });
  const checks = buildChecks(ctxWith({ fetchFn }), { full: false });
  await assert.rejects(byName(checks, 'ai-service').run(), /embed/);
});

test('check qdrant /healthz: FAIL si non-200', async () => {
  const fetchFn = async (url) => url.includes('healthz') ? ({ ok: false, status: 500, text: async () => 'err' }) : ({ ok: true, status: 200, json: async () => ({}) });
  const checks = buildChecks(ctxWith({ fetchFn }), { full: false });
  await assert.rejects(byName(checks, 'qdrant').run(), /6333|healthz|qdrant/i);
});

test('check qdrant /healthz: envoie le header api-key (Cloud sécurise /healthz, sinon 403)', async () => {
  let sentHeaders = null;
  const ctx = {
    config: { ...CFG, qdrantApiKey: 'secret-key' },
    exec: () => ({ ok: true, stdout: '' }),
    fetchFn: async (url, opts) => {
      if (url.includes('healthz')) sentHeaders = opts?.headers ?? null;
      return { ok: true, status: 200, json: async () => ({}) };
    },
  };
  const checks = buildChecks(ctx, { full: false });
  await byName(checks, 'qdrant').run();
  assert.equal(sentHeaders?.['api-key'], 'secret-key');
});

test('check migrations: FAIL si extension vector absente', async () => {
  const exec = (cmd, args) => {
    const sql = args.join(' ');
    if (sql.includes('pg_extension')) return { ok: true, stdout: '0' };      // vector absent
    return { ok: true, stdout: '0' };
  };
  const ctx = { ...ctxWith({ exec }), journalEntries: 1 };
  const checks = buildChecks(ctx, { full: true });
  await assert.rejects(byName(checks, 'migrations').run(), /vector/i);
});

test('check migrations: FAIL si migrations en retard', async () => {
  const exec = (cmd, args) => {
    const sql = args.join(' ');
    if (sql.includes('pg_extension')) return { ok: true, stdout: '1' };       // vector présent
    if (sql.includes('__drizzle_migrations')) return { ok: true, stdout: '2' }; // 2 appliquées
    return { ok: true, stdout: '0' };
  };
  const ctx = { ...ctxWith({ exec }), journalEntries: 5 };                      // 5 attendues
  const checks = buildChecks(ctx, { full: true });
  await assert.rejects(byName(checks, 'migrations').run(), /migration/i);
});

test('check migrations: PASS si vector présent et migrations à jour', async () => {
  const exec = (cmd, args) => {
    const sql = args.join(' ');
    if (sql.includes('pg_extension')) return { ok: true, stdout: '1' };
    if (sql.includes('__drizzle_migrations')) return { ok: true, stdout: '5' };
    return { ok: true, stdout: '0' };
  };
  const ctx = { ...ctxWith({ exec }), journalEntries: 5 };
  const checks = buildChecks(ctx, { full: true });
  await byName(checks, 'migrations').run();
});

test('check rag: FAIL explicite si AI_SERVICE_TOKEN absent', async () => {
  const ctx = { config: { ...CFG, aiServiceToken: '' }, exec: () => ({ ok: true, stdout: '' }), fetchFn: async () => ({ ok: true, status: 200, json: async () => ({}) }) };
  const checks = buildChecks(ctx, { full: true });
  await assert.rejects(byName(checks, 'roundtrip').run(), /AI_SERVICE_TOKEN/);
});

test('check rag: FAIL si embed renvoie un dense vide', async () => {
  const fetchFn = async (url) => {
    if (url.includes('/embed')) return { ok: true, status: 200, json: async () => ({ embeddings: [{ dense: [], sparse: { indices: [], values: [] } }] }) };
    return { ok: true, status: 200, json: async () => ({ result: true, status: 'ok' }) };
  };
  const checks = buildChecks({ config: CFG, exec: () => ({}), fetchFn }, { full: true });
  await assert.rejects(byName(checks, 'roundtrip').run(), /embed|dense/i);
});

test('check rag: PASS quand embed + upsert + search retournent le point', async () => {
  const calls = [];
  const fetchFn = async (url, opts) => {
    calls.push(`${opts?.method ?? 'GET'} ${url}`);
    if (url.includes('/embed')) return { ok: true, status: 200, json: async () => ({ embeddings: [{ dense: Array(1024).fill(0.01), sparse: { indices: [], values: [] } }] }) };
    if (url.includes('/points/search')) return { ok: true, status: 200, json: async () => ({ status: 'ok', result: [{ id: 1, score: 1.0 }] }) };
    return { ok: true, status: 200, json: async () => ({ result: true, status: 'ok' }) };
  };
  const checks = buildChecks({ config: CFG, exec: () => ({}), fetchFn }, { full: true });
  await byName(checks, 'roundtrip').run();
  assert.equal(calls.at(-1)?.startsWith('DELETE'), true, 'le dernier appel doit être le DELETE de cleanup');
});

test('check rag: la collection est supprimée même si la search échoue (cleanup en finally)', async () => {
  const calls = [];
  const fetchFn = async (url, opts) => {
    calls.push(`${opts?.method ?? 'GET'} ${url}`);
    if (url.includes('/embed')) return { ok: true, status: 200, json: async () => ({ embeddings: [{ dense: Array(1024).fill(0.01), sparse: { indices: [], values: [] } }] }) };
    if (url.includes('/points/search')) return { ok: false, status: 500, text: async () => 'boom' };
    return { ok: true, status: 200, json: async () => ({ result: true, status: 'ok' }) };
  };
  const checks = buildChecks({ config: CFG, exec: () => ({}), fetchFn }, { full: true });
  await assert.rejects(byName(checks, 'roundtrip').run());
  const deleteCount = calls.filter((c) => c.startsWith('DELETE')).length;
  assert.ok(deleteCount >= 2, `doit y avoir au moins 2 DELETE (pre-flight + finally cleanup), got ${deleteCount}`);
});

test('check server: SKIP si connexion refusée (server non lancé)', async () => {
  const fetchFn = async (url) => { if (url.includes('curriculum-health')) throw Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }); return { ok: true, status: 200, json: async () => ({}) }; };
  const checks = buildChecks({ config: CFG, exec: () => ({}), fetchFn }, { full: true });
  const e = await byName(checks, 'server').run().then(() => null, (x) => x);
  assert.ok(e && e[Symbol.for('doctor.skip')], 'doit être un SKIP');
});

test('check server: FAIL (pas SKIP) si server répond HTTP 500', async () => {
  const fetchFn = async (url) => url.includes('curriculum-health')
    ? ({ ok: false, status: 500, json: async () => ({}) })
    : ({ ok: true, status: 200, json: async () => ({}) });
  const checks = buildChecks({ config: CFG, exec: () => ({}), fetchFn }, { full: true });
  const e = await byName(checks, 'server').run().then(() => null, (x) => x);
  assert.ok(e, 'doit lever une erreur');
  assert.ok(!e[Symbol.for('doctor.skip')], 'ne doit PAS être un SKIP — un 500 est un vrai FAIL');
  assert.match(e.message, /500/);
});

test('check server: FAIL si 200 degraded', async () => {
  const fetchFn = async (url) => url.includes('curriculum-health')
    ? ({ ok: true, status: 200, json: async () => ({ status: 'degraded', qdrant: false, aiService: true }) })
    : ({ ok: true, status: 200, json: async () => ({}) });
  const checks = buildChecks({ config: CFG, exec: () => ({}), fetchFn }, { full: true });
  await assert.rejects(byName(checks, 'server').run(), /degraded|qdrant/i);
});

test('check server: PASS si 200 healthy', async () => {
  const fetchFn = async (url) => url.includes('curriculum-health')
    ? ({ ok: true, status: 200, json: async () => ({ status: 'healthy', qdrant: true, aiService: true }) })
    : ({ ok: true, status: 200, json: async () => ({}) });
  const checks = buildChecks({ config: CFG, exec: () => ({}), fetchFn }, { full: true });
  await byName(checks, 'server').run();
});

// ─── Strict mode ─────────────────────────────────────────────────────────────

test('runChecks strict: un SKIP devient un FAIL (exitCode 1)', async () => {
  const SKIP = Symbol.for('doctor.skip');
  const checks = [
    { name: 'ok', run: async () => {} },
    { name: 'skipped', run: async () => { const e = new Error('server non lancé'); e[SKIP] = true; throw e; } },
  ];
  const lines = [];
  const summary = await runChecks(checks, { log: (l) => lines.push(l), strict: true });
  assert.equal(summary.failed, 1, 'le SKIP doit compter comme failed en mode strict');
  assert.equal(summary.exitCode, 1);
  assert.ok(lines.some((l) => l.includes('FAIL') && l.includes('e2e strict')), 'le message doit mentionner [e2e strict]');
});

test('runChecks non-strict: un SKIP ne compte pas comme FAIL (exitCode 0)', async () => {
  const SKIP = Symbol.for('doctor.skip');
  const checks = [
    { name: 'ok', run: async () => {} },
    { name: 'skipped', run: async () => { const e = new Error('server non lancé'); e[SKIP] = true; throw e; } },
  ];
  const summary = await runChecks(checks, { log: () => {} });
  assert.equal(summary.failed, 0, 'le SKIP ne doit PAS compter comme failed en mode non-strict');
  assert.equal(summary.exitCode, 0);
});

test('buildChecks e2e: ajoute le check mistral chat réel', async () => {
  const ctx = { config: { ...CFG, mistralKey: 'mk-test' }, exec: () => ({}), fetchFn: async () => ({ ok: true, json: async () => ({ choices: [{}] }) }) };
  const checks = buildChecks(ctx, { full: true, e2e: true });
  assert.ok(byName(checks, 'mistral'), 'le check mistral doit être présent quand e2e=true');
});

test('buildChecks non-e2e: pas de check mistral', async () => {
  const ctx = { config: { ...CFG, mistralKey: 'mk-test' }, exec: () => ({}), fetchFn: async () => ({}) };
  const checks = buildChecks(ctx, { full: true });
  assert.equal(byName(checks, 'mistral'), undefined, 'le check mistral ne doit PAS être présent en mode non-e2e');
});

test('check mistral chat réel: FAIL si MISTRAL_API_KEY absent', async () => {
  const ctx = { config: { ...CFG, mistralKey: undefined }, exec: () => ({}), fetchFn: async () => ({}) };
  const checks = buildChecks(ctx, { full: true, e2e: true });
  await assert.rejects(byName(checks, 'mistral').run(), /MISTRAL_API_KEY/);
});

test('check mistral chat réel: FAIL si HTTP non-ok (clé invalide)', async () => {
  const ctx = { config: { ...CFG, mistralKey: 'sk-invalid' }, exec: () => ({}), fetchFn: async () => ({ ok: false, status: 401 }) };
  const checks = buildChecks(ctx, { full: true, e2e: true });
  await assert.rejects(byName(checks, 'mistral').run(), /HTTP 401/);
});

test('check mistral chat réel: PASS si la complétion renvoie des choices', async () => {
  const ctx = { config: { ...CFG, mistralKey: 'sk-xxx' }, exec: () => ({}), fetchFn: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'pong' } }] }) }) };
  const checks = buildChecks(ctx, { full: true, e2e: true });
  await byName(checks, 'mistral').run(); // ne lève pas
});
