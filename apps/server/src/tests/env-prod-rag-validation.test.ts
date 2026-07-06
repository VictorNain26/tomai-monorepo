/**
 * Production boot must fail fast if RAG is unconfigured, not degrade
 * silently. env.ts validates Bun.env at *module load time*, so the only
 * reliable way to exercise both the pass and fail paths is to boot a real
 * subprocess with a controlled env — importing config/env.ts in-process
 * would just reuse the already-parsed singleton for this test file's own
 * NODE_ENV=test.
 */

import { describe, it, expect } from 'bun:test';
import { join } from 'node:path';

const envModulePath = join(import.meta.dir, '../config/env.ts');

const basePassingProdEnv: Record<string, string> = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'https://api.tomia.fr',
  REVENUECAT_WEBHOOK_AUTH: 'b'.repeat(32),
  PRONOTE_ENCRYPTION_KEY: 'c'.repeat(32),
  AI_SERVICE_URL: 'https://ai-service.internal',
  AI_SERVICE_TOKEN: 'ai-token',
  QDRANT_ENABLED: 'true',
  QDRANT_API_KEY: 'qdrant-key',
};

function bootWithEnv(overrides: Record<string, string | undefined>) {
  const env: Record<string, string> = { ...(process.env as Record<string, string>) };
  for (const [key, value] of Object.entries({ ...basePassingProdEnv, ...overrides })) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }

  return Bun.spawnSync({
    // --env-file=/dev/null: disable Bun's automatic apps/server/.env loading,
    // otherwise the dev .env leaks AI_SERVICE_URL/QDRANT_* into this
    // deliberately-controlled env and masks the missing-var cases below.
    cmd: [
      'bun',
      '--env-file=/dev/null',
      '-e',
      `import(${JSON.stringify(envModulePath)}).then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); })`,
    ],
    env,
    stdout: 'pipe',
    stderr: 'pipe',
  });
}

describe('production boot — RAG configuration is mandatory', () => {
  it('boots successfully when AI_SERVICE_URL and QDRANT_ENABLED=true are both set', () => {
    const proc = bootWithEnv({});

    expect(proc.exitCode).toBe(0);
  });

  it('fails fast when AI_SERVICE_URL is missing', () => {
    const proc = bootWithEnv({ AI_SERVICE_URL: undefined, AI_SERVICE_TOKEN: undefined });

    expect(proc.exitCode).toBe(1);
    expect(proc.stderr.toString()).toContain('AI_SERVICE_URL is required');
  });

  it('fails fast when QDRANT_ENABLED is not "true"', () => {
    const proc = bootWithEnv({ QDRANT_ENABLED: 'false', QDRANT_API_KEY: undefined });

    expect(proc.exitCode).toBe(1);
    expect(proc.stderr.toString()).toContain('QDRANT_ENABLED must be "true"');
  });
});
