import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runChecks, loadConfig, buildChecks } from './doctor-checks.mjs';

const CFG = { serverUrl: 'http://s:3000' };

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
    { name: 'bad', run: async () => { throw new Error('postgres injoignable'); } },
  ];
  const lines = [];
  const summary = await runChecks(checks, { log: (l) => lines.push(l) });
  assert.equal(summary.failed, 1);
  assert.equal(summary.exitCode, 1);
  assert.ok(lines.some((l) => l.includes('FAIL') && l.includes('bad') && l.includes('postgres injoignable')));
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
  assert.equal(cfg.serverUrl, 'http://localhost:3000');
});

test('loadConfig: .env server prioritaire sur défaut, processEnv prioritaire sur .env', () => {
  const cfg = loadConfig({
    processEnv: { SERVER_HEALTH_URL: 'http://from-shell:3000' },
    readEnvFile: (p) => (p.includes('server') ? { SERVER_HEALTH_URL: 'http://from-file:3000', PG_CONTAINER: 'pg-from-file' } : {}),
  });
  assert.equal(cfg.serverUrl, 'http://from-shell:3000');
  assert.equal(cfg.pgContainer, 'pg-from-file');
});

test('check conteneurs: FAIL si postgres absent du ps', async () => {
  const checks = buildChecks(ctxWith({ exec: () => ({ ok: true, stdout: '{"Service":"adminer","Health":"healthy","State":"running"}' }) }), { full: false });
  await assert.rejects(byName(checks, 'conteneurs').run(), /postgres/);
});

test('check conteneurs: FAIL si un service non healthy', async () => {
  const psJson = '{"Service":"postgres","Health":"starting","State":"running"}';
  const checks = buildChecks(ctxWith({ exec: () => ({ ok: true, stdout: psJson }) }), { full: false });
  await assert.rejects(byName(checks, 'conteneurs').run(), /postgres/);
});

test('check conteneurs: PASS si postgres healthy', async () => {
  const psJson = '{"Service":"postgres","Health":"healthy","State":"running"}';
  const checks = buildChecks(ctxWith({ exec: () => ({ ok: true, stdout: psJson }) }), { full: false });
  await byName(checks, 'conteneurs').run(); // ne lève pas
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
  let sentBody = null;
  const ctx = {
    config: { ...CFG, mistralKey: 'sk-xxx' },
    exec: () => ({}),
    fetchFn: async (url, opts) => {
      sentBody = opts?.body ? JSON.parse(opts.body) : null;
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'pong' } }] }) };
    },
  };
  const checks = buildChecks(ctx, { full: true, e2e: true });
  await byName(checks, 'mistral').run(); // ne lève pas
  assert.equal(sentBody?.model, 'ministral-3b-latest', 'doit envoyer le modèle pinné ministral-3b-latest');
});
