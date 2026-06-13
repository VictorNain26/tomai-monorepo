# Phase A — `pnpm doctor` + fail-fast `pnpm dev` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une commande `pnpm doctor` qui prouve la stack dev complète end-to-end (services + RAG réel embed→qdrant→search) avec exit code franc et PASS/FAIL par ligne, plus un fail-fast infra dans `pnpm dev` — zéro fallback silencieux, zéro faux positif.

**Architecture:** Une bibliothèque de checks pure et injectable (`scripts/doctor-checks.mjs`) — chaque check est `{ name, run }` où `run` lève une `Error` (message = raison du FAIL) ou résout (PASS). Un runner agrège et calcule l'exit code. `scripts/doctor.mjs` câble la config réelle + tous les checks ; `scripts/dev.mjs` réutilise le sous-ensemble infra en fail-fast. Tests unitaires via le runner natif `node:test` (zéro nouvelle dépendance), deps (`fetch`, `spawnSync`, lecture `.env`) injectées pour tester la logique sans services live ; la preuve d'intégration finale se fait en lançant `pnpm doctor` contre la vraie stack.

**Tech Stack:** Node 22 (`node:test`, `node:child_process`, `fetch` global, `process` env), Docker Compose v2, qdrant REST v1.18.2, ai-service FastAPI.

**Faits vérifiés empiriquement (2026-06-13, ne pas réinventer) :**
- `docker compose ps --format json` émet une ligne JSON par conteneur avec les clés `Service` (ex. `"qdrant"`), `Health` (ex. `"healthy"` ; vide si pas de healthcheck), `State` (ex. `"running"`).
- qdrant v1.18.2 REST : `PUT /collections/{n}` body `{"vectors":{"size":1024,"distance":"Cosine"}}` → `{"result":true,"status":"ok"}` ; `PUT /collections/{n}/points?wait=true` body `{"points":[{"id":1,"vector":[...]}]}` → `{"status":"ok","result":{"status":"completed"}}` ; `POST /collections/{n}/points/search` body `{"vector":[...],"limit":1}` → `{"status":"ok","result":[{"id":1,"score":1.0,...}]}` ; `DELETE /collections/{n}` → `{"result":true,"status":"ok"}`. Header `api-key: <key>` si `QDRANT_API_KEY` non vide.
- ai-service : `GET /health` (non authentifié) → `{"status":"ok"|"loading","embed_loaded":bool,"rerank_loaded":bool,...}`. `POST /embed` (header `Authorization: Bearer <AI_SERVICE_TOKEN>`) body `{"texts":["..."]}` → `{"model":...,"embeddings":[{"dense":[...1024...],"sparse":{"indices":[],"values":[]}}]}`.
- Conteneurs nommés `tomai-<service>-dev` (ex. `tomai-postgres-dev`) ; mais on adresse par **service** (`postgres`/`qdrant`/`ai-service`) via `docker compose ps`, jamais par nom de conteneur en dur.
- Ports host : postgres `5432`, qdrant `6333`, ai-service `8001`, server `3000`.

---

## File Structure

| Fichier | Action | Responsabilité |
|---|---|---|
| `scripts/doctor-checks.mjs` | Create | Config (lecture `.env`), implémentations des checks (injectables), runner d'agrégation. Source unique. |
| `scripts/doctor-checks.test.mjs` | Create | Tests `node:test` du runner + des checks avec deps injectées. |
| `scripts/doctor.mjs` | Create | Entrypoint `pnpm doctor` : config réelle + tous les checks + print + exit. |
| `scripts/dev.mjs` | Modify | Fail-fast : sous-ensemble infra avant `turbo run dev`. |
| `package.json` (racine) | Modify | Scripts `doctor` et `test:scripts`. |
| `README.md` | Modify | Documenter `pnpm doctor`. |
| `apps/server/CLAUDE.md` | Modify | Mentionner `pnpm doctor` dans le diagnostic RAG. |

---

## Task 1: Runner + config (squelette injectable, TDD)

**Files:**
- Create: `scripts/doctor-checks.mjs`
- Create: `scripts/doctor-checks.test.mjs`
- Modify: `package.json` (racine)

- [ ] **Step 1: Écrire les tests du runner et du chargement de config**

Create `scripts/doctor-checks.test.mjs` :
```js
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
```

- [ ] **Step 2: Lancer les tests (échec attendu : module absent)**

Run: `node --test scripts/doctor-checks.test.mjs`
Expected: FAIL — `Cannot find module './doctor-checks.mjs'`.

- [ ] **Step 3: Implémenter le runner + la config**

Create `scripts/doctor-checks.mjs` :
```js
// Source unique des checks du doctor + runner. Deps injectées pour testabilité.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

export const SKIP = Symbol.for('doctor.skip');
/** Lève une erreur SKIP : check non applicable, affiché mais non-FAIL. */
export function skip(reason) { const e = new Error(reason); e[SKIP] = true; return e; }

/** Parse minimal d'un fichier .env (KEY=VALUE, ignore # et lignes vides). */
function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

/**
 * Précédence : défauts < apps/server/.env < apps/curriculum/.env < processEnv.
 * `readEnvFile`/`processEnv` injectables pour les tests.
 */
export function loadConfig({ processEnv = process.env, readEnvFile = parseEnvFile } = {}) {
  const server = readEnvFile('apps/server/.env');
  const curriculum = readEnvFile('apps/curriculum/.env');
  const pick = (k, def) => processEnv[k] ?? curriculum[k] ?? server[k] ?? def;
  return {
    qdrantUrl: pick('QDRANT_URL', 'http://localhost:6333'),
    qdrantApiKey: pick('QDRANT_API_KEY', ''),
    aiServiceUrl: pick('AI_SERVICE_URL', 'http://localhost:8001'),
    aiServiceToken: pick('AI_SERVICE_TOKEN', ''),
    serverUrl: pick('SERVER_HEALTH_URL', 'http://localhost:3000'),
  };
}

/** Exécute une commande, renvoie { ok, stdout }. Injectable via ctx.exec. */
export function defaultExec(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return { ok: r.status === 0, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/**
 * Lance les checks séquentiellement. Chaque check : { name, run: async()=>void }.
 * run lève -> FAIL (ou SKIP si e[SKIP]). Résout -> PASS.
 * Renvoie { passed, failed, skipped, exitCode }.
 */
export async function runChecks(checks, { log = console.log } = {}) {
  let passed = 0, failed = 0, skipped = 0;
  for (const check of checks) {
    try {
      await check.run();
      passed++; log(`  PASS  ${check.name}`);
    } catch (err) {
      if (err && err[SKIP]) { skipped++; log(`  SKIP  ${check.name} — ${err.message}`); }
      else { failed++; log(`  FAIL  ${check.name} — ${err instanceof Error ? err.message : String(err)}`); }
    }
  }
  log(`\n${passed} PASS · ${failed} FAIL · ${skipped} SKIP`);
  return { passed, failed, skipped, exitCode: failed > 0 ? 1 : 0 };
}
```

- [ ] **Step 4: Lancer les tests (PASS attendu)**

Run: `node --test scripts/doctor-checks.test.mjs`
Expected: PASS — 5 tests.

- [ ] **Step 5: Câbler `test:scripts` dans `package.json` racine**

Ajouter dans `scripts` (après `"setup"`) :
```json
    "test:scripts": "node --test scripts/",
```

- [ ] **Step 6: Commit**

```bash
git add scripts/doctor-checks.mjs scripts/doctor-checks.test.mjs package.json
git commit -m "feat(dev): doctor checks runner + config loader (injectable, node:test)"
```

---

## Task 2: Checks infra (docker, conteneurs, qdrant, ai-service)

**Files:**
- Modify: `scripts/doctor-checks.mjs`
- Modify: `scripts/doctor-checks.test.mjs`

- [ ] **Step 1: Ajouter les tests des checks infra**

Ajouter à `scripts/doctor-checks.test.mjs` :
```js
import { buildChecks } from './doctor-checks.mjs';

const CFG = { qdrantUrl: 'http://q:6333', qdrantApiKey: '', aiServiceUrl: 'http://ai:8001', aiServiceToken: 't', serverUrl: 'http://s:3000' };

function ctxWith({ exec, fetchFn }) {
  return { config: CFG, exec: exec ?? (() => ({ ok: true, stdout: '' })), fetchFn: fetchFn ?? (async () => ({ ok: true, status: 200, json: async () => ({}) })) };
}
function byName(checks, name) { return checks.find((c) => c.name.includes(name)); }

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
```

- [ ] **Step 2: Lancer (échec attendu : `buildChecks` absent)**

Run: `node --test scripts/doctor-checks.test.mjs`
Expected: FAIL — `buildChecks is not a function` / export manquant.

- [ ] **Step 3: Implémenter `buildChecks` (infra)**

Ajouter à `scripts/doctor-checks.mjs` :
```js
const REQUIRED_SERVICES = ['postgres', 'qdrant', 'ai-service'];

function checkDockerDaemon(ctx) {
  return { name: 'docker daemon', run: async () => {
    const r = ctx.exec('docker', ['version', '--format', '{{.Server.Version}}']);
    if (!r.ok) throw new Error('daemon Docker injoignable (docker version a échoué)');
  }};
}

function checkContainers(ctx) {
  return { name: 'conteneurs healthy (postgres, qdrant, ai-service)', run: async () => {
    const r = ctx.exec('docker', ['compose', 'ps', '--format', 'json']);
    if (!r.ok) throw new Error('docker compose ps a échoué');
    const rows = r.stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const byService = new Map(rows.map((row) => [row.Service, row]));
    for (const svc of REQUIRED_SERVICES) {
      const row = byService.get(svc);
      if (!row) throw new Error(`service '${svc}' absent (pas démarré) — lance 'pnpm dev' ou 'docker compose up -d'`);
      if (row.Health && row.Health !== 'healthy') throw new Error(`service '${svc}' non healthy (Health='${row.Health}')`);
      if (row.State !== 'running') throw new Error(`service '${svc}' non running (State='${row.State}')`);
    }
  }};
}

function checkQdrantHealthz(ctx) {
  return { name: 'qdrant /healthz', run: async () => {
    const res = await ctx.fetchFn(`${ctx.config.qdrantUrl}/healthz`, {});
    if (!res.ok) throw new Error(`qdrant ${ctx.config.qdrantUrl}/healthz -> HTTP ${res.status}`);
  }};
}

function checkAiServiceHealth(ctx) {
  return { name: 'ai-service /health (modèles chargés)', run: async () => {
    const res = await ctx.fetchFn(`${ctx.config.aiServiceUrl}/health`, {});
    if (!res.ok) throw new Error(`ai-service ${ctx.config.aiServiceUrl}/health -> HTTP ${res.status}`);
    const body = await res.json();
    if (body.embed_loaded !== true || body.rerank_loaded !== true) {
      throw new Error(`modèles non chargés (status='${body.status}', embed=${body.embed_loaded}, rerank=${body.rerank_loaded})`);
    }
  }};
}

/**
 * Construit la liste des checks. full=false -> sous-ensemble infra (pour le fail-fast `dev`).
 * full=true -> ajoute migrations, roundtrip RAG, server health.
 */
export function buildChecks(ctx, { full } = { full: true }) {
  const infra = [
    checkDockerDaemon(ctx),
    checkContainers(ctx),
    checkQdrantHealthz(ctx),
    checkAiServiceHealth(ctx),
  ];
  if (!full) return infra;
  return infra; // étendu dans les tâches 3-5
}
```

- [ ] **Step 4: Lancer (PASS attendu)**

Run: `node --test scripts/doctor-checks.test.mjs`
Expected: PASS — tous les tests (anciens + 5 nouveaux).

- [ ] **Step 5: Commit**

```bash
git add scripts/doctor-checks.mjs scripts/doctor-checks.test.mjs
git commit -m "feat(dev): infra checks (docker, containers, qdrant, ai-service)"
```

---

## Task 3: Check migrations (postgres `vector` + Drizzle à jour)

**Files:**
- Modify: `scripts/doctor-checks.mjs`
- Modify: `scripts/doctor-checks.test.mjs`

**Vérif doc-first avant de coder :** confirmer le nom réel de la table de migrations Drizzle sur la base live :
```bash
docker exec tomai-postgres-dev psql -U tomai_dev -d tomai_dev -c "\dt drizzle.*" -c "\dx vector"
```
Drizzle pg stocke les migrations appliquées dans `drizzle.__drizzle_migrations`. La source des migrations attendues est `apps/server/drizzle/meta/_journal.json` (clé `entries[]`). Si la table réelle diffère, ajuster le SQL ci-dessous en conséquence et le noter.

- [ ] **Step 1: Tests du check migrations (logique pure injectée)**

Ajouter à `scripts/doctor-checks.test.mjs` :
```js
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
```

- [ ] **Step 2: Lancer (échec attendu : check `migrations` inexistant)**

Run: `node --test scripts/doctor-checks.test.mjs`
Expected: FAIL — `byName(...).run` sur `undefined`.

- [ ] **Step 3: Implémenter le check + injecter `journalEntries`**

Ajouter à `scripts/doctor-checks.mjs` :
```js
import { readFileSync as _rf, existsSync as _ex } from 'node:fs';

/** Nombre de migrations attendues = entrées du journal Drizzle. */
export function countJournalEntries(path = 'apps/server/drizzle/meta/_journal.json') {
  if (!_ex(path)) return 0;
  try { return (JSON.parse(_rf(path, 'utf8')).entries ?? []).length; } catch { return 0; }
}

function psqlScalar(ctx, sql) {
  // -tA : tuple-only, unaligned -> sortie = la valeur brute
  const r = ctx.exec('docker', ['exec', 'tomai-postgres-dev', 'psql', '-U', 'tomai_dev', '-d', 'tomai_dev', '-tA', '-c', sql]);
  if (!r.ok) throw new Error(`psql a échoué: ${r.stderr || sql}`);
  return r.stdout.trim();
}

function checkMigrations(ctx) {
  return { name: 'postgres: extension vector + migrations Drizzle à jour', run: async () => {
    const hasVector = psqlScalar(ctx, "SELECT count(*) FROM pg_extension WHERE extname='vector';");
    if (hasVector === '0') throw new Error("extension 'vector' absente — lance 'pnpm setup'");
    const applied = Number(psqlScalar(ctx, 'SELECT count(*) FROM drizzle.__drizzle_migrations;'));
    const expected = ctx.journalEntries ?? countJournalEntries();
    if (applied < expected) throw new Error(`migrations en retard: ${applied}/${expected} appliquées — lance 'pnpm setup' (ou 'bun run db:migrate' dans apps/server)`);
  }};
}
```
Puis, dans `buildChecks`, remplacer la branche `if (!full) return infra; return infra;` par :
```js
  if (!full) return infra;
  return [...infra, checkMigrations(ctx)]; // roundtrip + server ajoutés tâches 4-5
```

- [ ] **Step 4: Lancer (PASS attendu)**

Run: `node --test scripts/doctor-checks.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/doctor-checks.mjs scripts/doctor-checks.test.mjs
git commit -m "feat(dev): migrations check (vector extension + drizzle journal vs applied)"
```

---

## Task 4: Check roundtrip RAG réel (embed → qdrant → search → cleanup)

**Files:**
- Modify: `scripts/doctor-checks.mjs`
- Modify: `scripts/doctor-checks.test.mjs`

- [ ] **Step 1: Tests du roundtrip (fetch injecté)**

Ajouter à `scripts/doctor-checks.test.mjs` :
```js
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
  assert.ok(calls.some((c) => c.startsWith('DELETE')), 'la collection jetable doit être supprimée');
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
  assert.ok(calls.some((c) => c.startsWith('DELETE')), 'cleanup DELETE doit avoir lieu malgré l\'échec');
});
```

- [ ] **Step 2: Lancer (échec attendu : check `roundtrip` absent)**

Run: `node --test scripts/doctor-checks.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implémenter le check roundtrip**

Ajouter à `scripts/doctor-checks.mjs` :
```js
const SMOKE_COLLECTION = '_doctor_smoke';

function qdrantHeaders(ctx) {
  const h = { 'Content-Type': 'application/json' };
  if (ctx.config.qdrantApiKey) h['api-key'] = ctx.config.qdrantApiKey;
  return h;
}

function checkRagRoundtrip(ctx) {
  return { name: 'roundtrip RAG réel (embed → qdrant → search)', run: async () => {
    if (!ctx.config.aiServiceToken) throw new Error('AI_SERVICE_TOKEN absent — roundtrip RAG impossible (renseigne apps/server/.env)');
    const { qdrantUrl, aiServiceUrl, aiServiceToken } = ctx.config;

    // 1. embed réel
    const emb = await ctx.fetchFn(`${aiServiceUrl}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiServiceToken}` },
      body: JSON.stringify({ texts: ['doctor smoke test'] }),
    });
    if (!emb.ok) throw new Error(`embed -> HTTP ${emb.status}`);
    const dense = (await emb.json())?.embeddings?.[0]?.dense;
    if (!Array.isArray(dense) || dense.length === 0) throw new Error('embed: dense vide ou absent');

    const base = `${qdrantUrl}/collections/${SMOKE_COLLECTION}`;
    try {
      // 2. (re)create collection jetable, dim = taille du dense réel
      await ctx.fetchFn(base, { method: 'DELETE', headers: qdrantHeaders(ctx) }); // idempotence si résidu
      const created = await ctx.fetchFn(base, { method: 'PUT', headers: qdrantHeaders(ctx),
        body: JSON.stringify({ vectors: { size: dense.length, distance: 'Cosine' } }) });
      if (!created.ok) throw new Error(`create collection -> HTTP ${created.status}`);

      // 3. upsert
      const up = await ctx.fetchFn(`${base}/points?wait=true`, { method: 'PUT', headers: qdrantHeaders(ctx),
        body: JSON.stringify({ points: [{ id: 1, vector: dense }] }) });
      if (!up.ok) throw new Error(`upsert -> HTTP ${up.status}`);

      // 4. search
      const se = await ctx.fetchFn(`${base}/points/search`, { method: 'POST', headers: qdrantHeaders(ctx),
        body: JSON.stringify({ vector: dense, limit: 1 }) });
      if (!se.ok) throw new Error(`search -> HTTP ${se.status}`);
      const hits = (await se.json())?.result ?? [];
      if (hits.length === 0 || hits[0].id !== 1) throw new Error('search: le point upserté n\'est pas revenu');
    } finally {
      // 5. cleanup (toujours, même en cas d'échec partiel)
      await ctx.fetchFn(base, { method: 'DELETE', headers: qdrantHeaders(ctx) }).catch(() => {});
    }
  }};
}
```
Puis, dans `buildChecks`, remplacer la ligne `return [...infra, checkMigrations(ctx)];` par :
```js
  return [...infra, checkMigrations(ctx), checkRagRoundtrip(ctx)]; // server ajouté tâche 5
```

- [ ] **Step 4: Lancer (PASS attendu)**

Run: `node --test scripts/doctor-checks.test.mjs`
Expected: PASS — incl. les 4 tests roundtrip.

- [ ] **Step 5: Commit**

```bash
git add scripts/doctor-checks.mjs scripts/doctor-checks.test.mjs
git commit -m "feat(dev): real RAG roundtrip check (embed->qdrant->search, disposable collection)"
```

---

## Task 5: Check conditionnel server `/api/curriculum-health` (SKIP si server down)

**Files:**
- Modify: `scripts/doctor-checks.mjs`
- Modify: `scripts/doctor-checks.test.mjs`

**Vérif avant de coder :** confirmer le chemin et la garde de la route :
```bash
grep -n "curriculum-health" apps/server/src/routes/api/health.routes.ts
```
La route renvoie `{ status: 'healthy'|'degraded', qdrant, aiService }` ; elle est sous condition (404 si non autorisée). Le doctor doit traiter un 404/connexion refusée comme **SKIP** (« server non lancé / route non exposée »), un 200 `degraded` comme **FAIL**, un 200 `healthy` comme **PASS**.

- [ ] **Step 1: Tests du check server (SKIP vs FAIL vs PASS)**

Ajouter à `scripts/doctor-checks.test.mjs` :
```js
test('check server: SKIP si connexion refusée (server non lancé)', async () => {
  const fetchFn = async (url) => { if (url.includes('curriculum-health')) throw Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }); return { ok: true, status: 200, json: async () => ({}) }; };
  const checks = buildChecks({ config: CFG, exec: () => ({}), fetchFn }, { full: true });
  const e = await byName(checks, 'server').run().then(() => null, (x) => x);
  assert.ok(e && e[Symbol.for('doctor.skip')], 'doit être un SKIP');
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
```

- [ ] **Step 2: Lancer (échec attendu)**

Run: `node --test scripts/doctor-checks.test.mjs`
Expected: FAIL — check `server` absent.

- [ ] **Step 3: Implémenter le check conditionnel**

Ajouter à `scripts/doctor-checks.mjs` :
```js
function checkServerRagHealth(ctx) {
  return { name: 'server /api/curriculum-health (si lancé)', run: async () => {
    let res;
    try {
      res = await ctx.fetchFn(`${ctx.config.serverUrl}/api/curriculum-health`, {});
    } catch (e) {
      throw skip(`server non joignable sur ${ctx.config.serverUrl} (${e.code ?? e.message})`);
    }
    if (res.status === 404) throw skip('route /api/curriculum-health non exposée (garde dev)');
    if (!res.ok) throw skip(`server -> HTTP ${res.status}`);
    const body = await res.json();
    if (body.status !== 'healthy') throw new Error(`RAG dégradé côté server (qdrant=${body.qdrant}, aiService=${body.aiService})`);
  }};
}
```
Puis, dans `buildChecks`, remplacer la ligne du `return [...]` finale par :
```js
  return [...infra, checkMigrations(ctx), checkRagRoundtrip(ctx), checkServerRagHealth(ctx)];
```

- [ ] **Step 4: Lancer (PASS attendu)**

Run: `node --test scripts/doctor-checks.test.mjs`
Expected: PASS — toute la suite.

- [ ] **Step 5: Commit**

```bash
git add scripts/doctor-checks.mjs scripts/doctor-checks.test.mjs
git commit -m "feat(dev): conditional server RAG health check (skip if down, fail if degraded)"
```

---

## Task 6: Entrypoint `pnpm doctor` + preuve contre la stack live

**Files:**
- Create: `scripts/doctor.mjs`
- Modify: `package.json` (racine)

- [ ] **Step 1: Créer `scripts/doctor.mjs`**

```js
#!/usr/bin/env node
// pnpm doctor — preuve end-to-end de l'environnement de dev. Exit 0 si tout PASS, 1 sinon.
import { loadConfig, defaultExec, buildChecks, runChecks } from './doctor-checks.mjs';

const config = loadConfig();
const ctx = { config, exec: defaultExec, fetchFn: fetch };

console.log('[doctor] vérification de la stack de dev…\n');
const summary = await runChecks(buildChecks(ctx, { full: true }));
if (summary.exitCode !== 0) {
  console.error('\n[doctor] des checks ont échoué. Corrige-les avant de reprendre le dev (souvent : `pnpm setup` puis `pnpm dev`).');
}
process.exit(summary.exitCode);
```

- [ ] **Step 2: Ajouter le script racine**

Dans `package.json`, ajouter après `"test:scripts"` :
```json
    "doctor": "node scripts/doctor.mjs",
```

- [ ] **Step 3: Preuve — stack saine -> tout PASS, exit 0**

Prérequis : la stack tourne (`docker compose up -d --wait postgres qdrant ai-service`) et `apps/server/.env` contient `AI_SERVICE_TOKEN`/`QDRANT_*`. Run :
```bash
pnpm doctor; echo "exit=$?"
```
Expected: chaque ligne `PASS` (le check `server` peut être `SKIP` si le server n'est pas lancé), `exit=0`. Le roundtrip RAG réussit (collection `_doctor_smoke` créée puis supprimée — vérifier qu'elle n'existe plus : `curl -s http://localhost:6333/collections | grep -o _doctor_smoke || echo "absente (ok)"`).

- [ ] **Step 4: Preuve — panne détectée bruyamment (pas de faux positif)**

```bash
docker compose stop qdrant
pnpm doctor; echo "exit=$?"
```
Expected: check `conteneurs` et/ou `qdrant /healthz` en `FAIL` avec raison, `exit=1`. Remettre en route :
```bash
docker compose up -d --wait qdrant
pnpm doctor; echo "exit=$?"   # de nouveau exit=0
```

- [ ] **Step 5: Commit**

```bash
git add scripts/doctor.mjs package.json
git commit -m "feat(dev): pnpm doctor entrypoint (end-to-end proof, honest exit code)"
```

---

## Task 7: Fail-fast infra dans `pnpm dev`

**Files:**
- Modify: `scripts/dev.mjs`

- [ ] **Step 1: Lire l'état actuel de `scripts/dev.mjs`**

Run: `cat scripts/dev.mjs` — repérer l'endroit après le démarrage de l'infra et **avant** le `spawn` de turbo.

- [ ] **Step 2: Insérer le fail-fast infra avant le lancement des apps**

Dans `scripts/dev.mjs`, ajouter l'import en tête :
```js
import { loadConfig, defaultExec, buildChecks, runChecks } from "./doctor-checks.mjs";
```
Puis, juste **avant** le `spawn("pnpm", ["exec", "turbo", ...])` (le lancement des apps), insérer :
```js
console.log("[dev] vérification infra (fail-fast) avant de lancer les apps…");
const ctx = { config: loadConfig(), exec: defaultExec, fetchFn: fetch };
const infra = await runChecks(buildChecks(ctx, { full: false }));
if (infra.exitCode !== 0) {
  console.error("[dev] infra incomplète — apps non lancées. Lance `pnpm doctor` pour le détail, puis `pnpm setup`/`docker compose up -d`.");
  process.exit(1);
}
```
(Conserver le reste de `dev.mjs` inchangé — démarrage infra Docker au-dessus, `spawn` turbo en-dessous.)

- [ ] **Step 3: Preuve — `dev` abort si un service down**

```bash
docker compose stop qdrant
node -e "import('./scripts/dev.mjs')" &  DEVPID=$!
sleep 8; kill $DEVPID 2>/dev/null
```
Expected (dans la sortie) : le bloc « vérification infra (fail-fast) » s'affiche, un check `FAIL` apparaît, et le process sort **avant** la ligne turbo « lancement des apps ». (Note : `dev.mjs` relance d'abord l'infra via `docker compose up -d` ; si ton `dev.mjs` redémarre qdrant automatiquement, teste plutôt en simulant une panne ai-service : `docker compose stop ai-service` puis relance — adapte au comportement réel observé et **rapporte** ce que tu vois.)
Remettre la stack : `docker compose up -d --wait postgres qdrant ai-service`.

- [ ] **Step 4: Preuve — `dev` passe le fail-fast quand l'infra est saine**

```bash
docker compose up -d --wait postgres qdrant ai-service
pnpm exec turbo run dev --filter=!tom-mobile --dry-run=json >/dev/null && echo "turbo dry-run OK"
```
(On valide que le fail-fast passe sans réellement lancer le serveur en watch ; le dry-run turbo confirme que la suite s'exécuterait.)

- [ ] **Step 5: Commit**

```bash
git add scripts/dev.mjs
git commit -m "feat(dev): fail-fast infra checks before launching apps in pnpm dev"
```

---

## Task 8: Documentation + validation finale

**Files:**
- Modify: `README.md`
- Modify: `apps/server/CLAUDE.md`

- [ ] **Step 1: README — ajouter `pnpm doctor` au Quick Start**

Dans `README.md`, sous le bloc Quick Start (après la ligne `pnpm dev`), ajouter :
```markdown
pnpm doctor         # prouve la stack end-to-end (services + RAG réel) — exit ≠0 si quoi que ce soit est cassé
```
Et une ligne sous le bloc : `` `pnpm dev` lance désormais un fail-fast infra : si un service critique est down, les apps ne démarrent pas (lance `pnpm doctor` pour le détail). ``

- [ ] **Step 2: `apps/server/CLAUDE.md` — diagnostic RAG**

Dans la section Troubleshooting / RAG de `apps/server/CLAUDE.md`, ajouter une ligne : `` Diagnostic complet de l'infra RAG (qdrant + ai-service + roundtrip réel) : `pnpm doctor` depuis la racine. ``

- [ ] **Step 3: Validation finale (tests scripts + tooling)**

Run:
```bash
node --test scripts/                    # tous les tests doctor verts
pnpm doctor; echo "exit=$?"             # stack live : exit=0
pnpm typecheck && pnpm lint             # aucune régression
```
Expected: tests scripts PASS ; `pnpm doctor` exit=0 ; typecheck + lint PASS.

- [ ] **Step 4: Commit + push + PR**

```bash
git add README.md apps/server/CLAUDE.md
git commit -m "docs(dev): document pnpm doctor and dev fail-fast"
git push -u origin feat/dev-doctor-and-test-audit
gh pr create --base main --title "feat(dev): pnpm doctor — end-to-end dev-env proof + fail-fast" --body "Voir docs/superpowers/specs/2026-06-13-dev-env-doctor-and-test-audit-design.md (Phase A). Phase B (audit tests) = plan séparé."
```

---

## Self-Review

**Spec coverage (Phase A) :**
- §3 `pnpm doctor` 7 checks → Tasks 2 (1,2,4,5), 3 (3), 4 (6), 5 (7). ✔
- §3 fail-fast `dev` (checks 1,2,4,5) → Task 7 (`buildChecks(..,{full:false})`). ✔
- §3 source unique `doctor-checks.mjs` → Task 1, réutilisée par doctor.mjs (T6) et dev.mjs (T7). ✔
- §2 exit code franc + PASS/FAIL/SKIP → Task 1 (runner). ✔
- §2 FAIL explicite, jamais skip silencieux (token manquant) → Task 4 (test « FAIL si AI_SERVICE_TOKEN absent »). ✔
- §4 roundtrip collection jetable + cleanup finally → Task 4. ✔
- §6 pas de gate pre-push → aucun hook lefthook ajouté (intentionnel). ✔

**Placeholder scan :** les deux « vérif avant de coder » (Tasks 3 et 5) sont des étapes doc-first explicites (nom de table Drizzle, garde de route) avec commande de vérification fournie — pas des placeholders masqués. Tout le code est concret.

**Type/nom consistency :** `buildChecks(ctx, {full})`, `runChecks(checks,{log})`, `loadConfig({processEnv,readEnvFile})`, `defaultExec`, `skip()`/`SKIP`, `countJournalEntries`, `SMOKE_COLLECTION='_doctor_smoke'`, services `postgres`/`qdrant`/`ai-service`, conteneur `tomai-postgres-dev`, ports 6333/8001/3000 — cohérents entre toutes les tâches et avec la spec.

**Gap connu :** Task 7 step 3 dépend du comportement réel de `dev.mjs` (relance-t-il l'infra ?) — l'étape demande explicitement d'adapter et de rapporter, pas de deviner.
