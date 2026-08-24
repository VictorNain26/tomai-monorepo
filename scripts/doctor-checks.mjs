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
    serverUrl:       env('SERVER_HEALTH_URL')    ?? 'http://localhost:3000',
    dbUrl:           env('DATABASE_URL'),
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

const REQUIRED_SERVICES = ['postgres'];

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
 * full=true -> ajoute les migrations.
 * e2e=true -> ajoute le check mistral réel (SKIP interdit en mode strict).
 */
export function buildChecks(ctx, { full, e2e } = { full: true }) {
  const infra = [
    checkDockerDaemon(ctx),
    checkContainers(ctx),
  ];
  if (!full) return infra;
  const fullChecks = [...infra, checkMigrations(ctx)];
  if (!e2e) return fullChecks;
  return [...fullChecks, checkMistralReal(ctx)];
}
