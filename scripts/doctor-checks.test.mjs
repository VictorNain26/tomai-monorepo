import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runChecks, loadConfig } from './doctor-checks.mjs';

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
