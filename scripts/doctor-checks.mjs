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
    serverUrl:       env('SERVER_URL')          ?? 'http://localhost:3000',
    dbUrl:           env('DATABASE_URL'),
    qdrantApiKey:    env('QDRANT_API_KEY'),
    pgContainer:     env('PG_CONTAINER')        ?? 'tomai-postgres-dev',
    composeFile:     join(rootDir, 'docker-compose.yml'),
  };
}

// ─── Runner ──────────────────────────────────────────────────────────────────

const STATUS = { pass: '✓ PASS', fail: '✗ FAIL', skip: '~ SKIP' };

/**
 * Exécute une liste de checks séquentiellement.
 * @param {Array<{name: string, run: () => Promise<void>}>} checks
 * @param {{ log?: (line: string) => void }} opts
 * @returns {{ passed: number, failed: number, skipped: number, exitCode: number }}
 */
export async function runChecks(checks, { log = console.log } = {}) {
  let passed = 0, failed = 0, skipped = 0;

  for (const check of checks) {
    try {
      await check.run();
      log(`${STATUS.pass}  ${check.name}`);
      passed++;
    } catch (err) {
      if (err[SKIP]) {
        log(`${STATUS.skip}  ${check.name} — ${err.message}`);
        skipped++;
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
