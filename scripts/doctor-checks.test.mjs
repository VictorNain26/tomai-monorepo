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
  const fetchFn = async () => ({ ok: true, status: 200, json: async () => ({ status: 'loading', embed_loaded: false, rerank_loaded: true }) });
  const checks = buildChecks(ctxWith({ fetchFn }), { full: false });
  await assert.rejects(byName(checks, 'ai-service').run(), /embed/);
});

test('check qdrant /healthz: FAIL si non-200', async () => {
  const fetchFn = async (url) => url.includes('healthz') ? ({ ok: false, status: 500, text: async () => 'err' }) : ({ ok: true, status: 200, json: async () => ({}) });
  const checks = buildChecks(ctxWith({ fetchFn }), { full: false });
  await assert.rejects(byName(checks, 'qdrant').run(), /6333|healthz|qdrant/i);
});
