/**
 * doctor-checks.mjs — bibliothèque injectable de checks dev-stack.
 * Chaque check : { name: string, run: async () => void } — throw = FAIL, return = PASS.
 * Runner agrège et calcule l'exit code.
 */

import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

// ─── SKIP helper ────────────────────────────────────────────────────────────

export const SKIP = Symbol.for('doctor.skip');

// ─── Config ──────────────────────────────────────────────────────────────────

/** Lit un fichier .env avec le parseur de la plateforme (commentaires en fin de ligne compris). Absent = {} ; toute autre erreur de lecture remonte. */
export function parseEnvFile(path) {
  try {
    return parseEnv(readFileSync(path, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw error;
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
    mistralServerUrl: env('MISTRAL_SERVER_URL') ?? 'https://api.eu.mistral.ai',
    mistralModel:     env('MISTRAL_MODEL')      ?? 'mistral-small-2603',
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
      if (!row) throw new Error(`service '${svc}' absent (pas démarré) — lance 'bun run dev' ou 'docker compose up -d'`);
      if (row.Health && row.Health !== 'healthy') throw new Error(`service '${svc}' non healthy (Health='${row.Health}')`);
      if (row.State !== 'running') throw new Error(`service '${svc}' non running (State='${row.State}')`);
    }
  }};
}

// ─── Migrations check ────────────────────────────────────────────────────────

import { existsSync } from 'node:fs';

/** Nombre de migrations attendues = entrées du journal Drizzle. */
/** The `when` of each journal entry: Drizzle stores it as `created_at` of the applied migration. */
export function journalWhens(path = new URL('../apps/server/drizzle/meta/_journal.json', import.meta.url).pathname) {
  if (!existsSync(path)) return [];
  try { return (JSON.parse(readFileSync(path, 'utf8')).entries ?? []).map((entry) => String(entry.when)); } catch { return []; }
}

function psqlScalar(ctx, sql) {
  // -tA : tuple-only, unaligned -> sortie = la valeur brute
  const r = ctx.exec('docker', ['exec', ctx.config.pgContainer, 'psql', '-U', 'tomai_dev', '-d', 'tomai_dev', '-tA', '-c', sql]);
  if (!r.ok) throw new Error(`psql a échoué: ${r.stderr || sql}`);
  return r.stdout.trim();
}

function checkMigrations(ctx) {
  return { name: 'postgres: migrations Drizzle à jour', run: async () => {
    const applied = psqlScalar(ctx, "SELECT string_agg(created_at::text, ',' ORDER BY created_at) FROM drizzle.__drizzle_migrations;")
      .split(',').filter(Boolean);
    const expected = ctx.journalWhens ?? journalWhens();
    // Drizzle applies only the migrations newer than the last applied one: a history the journal
    // does not know, such as the one before the base migration, would never be replayed.
    const unknown = applied.filter((when) => !expected.includes(when));
    if (unknown.length > 0) throw new Error(`${unknown.length} migration(s) appliquée(s) absente(s) du journal — base d'un autre historique : recrée-la ('docker compose rm -sf postgres', 'docker volume rm tomai_postgres_dev_data', puis 'bun run setup')`);
    if (applied.length < expected.length) throw new Error(`migrations en retard: ${applied.length}/${expected.length} appliquées — lance 'bun run db:migrate' dans apps/server`);
  }};
}

// ─── Mistral chat check (e2e only) ───────────────────────────────────────────

// Preuve réelle du chemin LLM : un chat completion 1 token sur le modèle et
// l'endpoint du serveur. Échoue sur clé invalide, quota épuisé, modèle absent
// de l'endpoint ou panne API — ce qu'une simple présence de clé ne prouve pas.
function checkMistralReal(ctx) {
  return { name: `mistral chat réel (${ctx.config.mistralModel}, ${ctx.config.mistralServerUrl}, 1 token)`, run: async () => {
    if (!ctx.config.mistralKey) {
      throw new Error('MISTRAL_API_KEY absente — définis-la dans apps/server/.env ou ton shell');
    }
    const res = await ctx.fetchFn(`${ctx.config.mistralServerUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ctx.config.mistralKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ctx.config.mistralModel,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        reasoning_effort: 'none',
      }),
    });
    if (!res.ok) throw new Error(`mistral chat -> HTTP ${res.status} (clé invalide, quota, modèle absent de l'endpoint ou panne API)`);
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
