/**
 * doctor-checks.mjs — bibliothèque injectable de checks dev-stack.
 * Chaque check : { name: string, run: async () => void } — throw = FAIL, return = PASS.
 * Runner agrège et calcule l'exit code.
 */

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

// ─── SKIP helper ────────────────────────────────────────────────────────────

export const SKIP = Symbol.for('doctor.skip');
/** Lève une erreur SKIP : check non applicable, affiché mais non-FAIL. */
export function skip(reason) { const e = new Error(reason); e[SKIP] = true; return e; }

// ─── Config ──────────────────────────────────────────────────────────────────

/** Parse minimal d'un fichier .env (KEY=VALUE, ignore # et lignes vides). */
function parseEnvFile(path) {
  try {
    const content = readFileSync(path, 'utf8');
    const out = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      out[key] = val;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Charge la config doctor depuis :
 *   1. apps/server/.env  (valeurs de base du projet)
 *   2. process.env       (overrides CI / shell)
 * Deps injectables pour les tests unitaires.
 */
export function loadConfig({
  processEnv = process.env,
  readEnvFile = (p) => parseEnvFile(p),
  rootDir = new URL('..', import.meta.url).pathname,
} = {}) {
  const serverEnv = readEnvFile(join(rootDir, 'apps/server/.env'));
  const env = (key) => processEnv[key] ?? serverEnv[key];

  return {
    qdrantUrl:       env('QDRANT_URL')         ?? 'http://localhost:6333',
    aiServiceUrl:    env('AI_SERVICE_URL')      ?? 'http://localhost:8001',
    aiServiceToken:  env('AI_SERVICE_TOKEN'),
    serverUrl:       env('SERVER_HEALTH_URL')    ?? 'http://localhost:3000',
    dbUrl:           env('DATABASE_URL'),
    qdrantApiKey:    env('QDRANT_API_KEY'),
    pgContainer:     env('PG_CONTAINER')        ?? 'tomai-postgres-dev',
    composeFile:     join(rootDir, 'docker-compose.yml'),
    mistralKey:      env('MISTRAL_API_KEY'),
  };
}

// ─── Runner ──────────────────────────────────────────────────────────────────

const STATUS = { pass: '✓ PASS', fail: '✗ FAIL', skip: '~ SKIP' };

/**
 * Exécute une liste de checks séquentiellement.
 * @param {Array<{name: string, run: () => Promise<void>}>} checks
 * @param {{ log?: (line: string) => void, strict?: boolean }} opts
 *   strict=true : un SKIP compte comme un FAIL (mode e2e — stack doit être 100 % up).
 * @returns {{ passed: number, failed: number, skipped: number, exitCode: number }}
 */
export async function runChecks(checks, { log = console.log, strict = false } = {}) {
  let passed = 0, failed = 0, skipped = 0;

  for (const check of checks) {
    try {
      await check.run();
      log(`${STATUS.pass}  ${check.name}`);
      passed++;
    } catch (err) {
      if (err[SKIP] && !strict) {
        log(`${STATUS.skip}  ${check.name} — ${err.message}`);
        skipped++;
      } else if (err[SKIP]) {
        log(`${STATUS.fail}  ${check.name} — [e2e strict] ${err.message}`);
        failed++;
      } else {
        log(`${STATUS.fail}  ${check.name} — ${err.message}`);
        failed++;
      }
    }
  }

  return { passed, failed, skipped, exitCode: failed > 0 ? 1 : 0 };
}

// ─── Default exec helper ─────────────────────────────────────────────────────

export function defaultExec(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return {
    ok: r.status === 0 && !r.error,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

// ─── Check implementations ───────────────────────────────────────────────────

const REQUIRED_SERVICES = ['postgres', 'qdrant', 'ai-service'];

function checkDockerDaemon(ctx) {
  return { name: 'docker daemon', run: async () => {
    const r = ctx.exec('docker', ['version', '--format', '{{.Server.Version}}']);
    if (!r.ok) throw new Error('daemon Docker injoignable (docker version a échoué)');
  }};
}

function checkContainers(ctx) {
  return { name: 'conteneurs healthy', run: async () => {
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
    const url = `${ctx.config.qdrantUrl}/healthz`;
    let res;
    try {
      // Qdrant Cloud secures /healthz once an API key is set: an unauthenticated
      // probe returns 403. Send the api-key header (same as every other Qdrant
      // call here) so the check validates reachability AND a valid key — a wrong
      // key must fail the doctor, not slip through an unauthenticated probe.
      res = await ctx.fetchFn(url, { headers: qdrantHeaders(ctx) });
    } catch (e) {
      throw new Error(`qdrant ${url} injoignable (${e.cause?.code ?? e.message})`);
    }
    if (!res.ok) throw new Error(`qdrant ${url} -> HTTP ${res.status}`);
  }};
}

function checkAiServiceHealth(ctx) {
  return { name: 'ai-service /health (modèle embed chargé)', run: async () => {
    const url = `${ctx.config.aiServiceUrl}/health`;
    let res;
    try {
      res = await ctx.fetchFn(url, {});
    } catch (e) {
      throw new Error(`ai-service ${url} injoignable (${e.cause?.code ?? e.message})`);
    }
    if (!res.ok) throw new Error(`ai-service ${url} -> HTTP ${res.status}`);
    const body = await res.json();
    if (body.embed_loaded !== true) {
      throw new Error(`modèle non chargé (status='${body.status}', embed=${body.embed_loaded})`);
    }
  }};
}

// ─── Migrations check ────────────────────────────────────────────────────────

import { existsSync } from 'node:fs';

/** Nombre de migrations attendues = entrées du journal Drizzle. */
export function countJournalEntries(path = new URL('../apps/server/drizzle/meta/_journal.json', import.meta.url).pathname) {
  if (!existsSync(path)) return 0;
  try { return (JSON.parse(readFileSync(path, 'utf8')).entries ?? []).length; } catch { return 0; }
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

// ─── RAG roundtrip check ─────────────────────────────────────────────────────

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

// ─── Server curriculum-health check ─────────────────────────────────────────

function checkServerRagHealth(ctx) {
  return { name: 'server /curriculum-health (si lancé)', run: async () => {
    let res;
    try {
      res = await ctx.fetchFn(`${ctx.config.serverUrl}/curriculum-health`, {});
    } catch (e) {
      throw skip(`server non joignable sur ${ctx.config.serverUrl} (${e.cause?.code ?? e.code ?? e.message})`);
    }
    if (res.status === 404) throw skip('route /curriculum-health non exposée (garde dev)');
    if (!res.ok) throw new Error(`server /curriculum-health -> HTTP ${res.status} (server joignable mais en erreur)`);
    const body = await res.json();
    if (body.status !== 'healthy') throw new Error(`RAG dégradé côté server (qdrant=${body.qdrant}, aiService=${body.aiService})`);
  }};
}

// ─── Mistral chat check (e2e only) ───────────────────────────────────────────

// Preuve réelle du chemin LLM : un chat completion 1 token sur le modèle le
// moins cher. Coût par run ≈ négligeable ; échoue sur clé invalide, quota
// épuisé ou panne API — ce qu'une simple présence de clé ne prouve pas.
function checkMistralReal(ctx) {
  return { name: 'mistral chat réel (ministral-3b, 1 token)', run: async () => {
    if (!ctx.config.mistralKey) {
      throw new Error('MISTRAL_API_KEY absente — définis-la dans apps/server/.env ou ton shell');
    }
    const res = await ctx.fetchFn('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ctx.config.mistralKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'ministral-3b-latest',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
    });
    if (!res.ok) throw new Error(`mistral chat -> HTTP ${res.status} (clé invalide, quota ou panne API)`);
    const body = await res.json();
    const message = body?.choices?.[0]?.message;
    if (typeof message?.content !== 'string') throw new Error('mistral chat: réponse sans message.content (shape inattendue)');
  }};
}

/**
 * Construit la liste des checks. full=false -> sous-ensemble infra (pour le fail-fast `dev`).
 * full=true -> ajoute migrations, roundtrip RAG, server health.
 * e2e=true -> ajoute le check mistral-key (SKIP interdit en mode strict).
 */
export function buildChecks(ctx, { full, e2e } = { full: true }) {
  const infra = [
    checkDockerDaemon(ctx),
    checkContainers(ctx),
    checkQdrantHealthz(ctx),
    checkAiServiceHealth(ctx),
  ];
  if (!full) return infra;
  const fullChecks = [...infra, checkMigrations(ctx), checkRagRoundtrip(ctx), checkServerRagHealth(ctx)];
  if (!e2e) return fullChecks;
  return [...fullChecks, checkMistralReal(ctx)];
}
