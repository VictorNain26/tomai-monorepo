/**
 * env.ts parses Bun.env once, at load: a test of the schema boots it in a fresh process, with the
 * variables the case gives on top of the two that every environment requires.
 */

import { afterAll } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ENV_MODULE = new URL('../../platform/config/env.ts', import.meta.url).pathname;

/** Boots env.ts; `read` names a variable of the parsed env to return, as JSON, in `value`. */
export function bootEnv(extra: Record<string, string>, read?: string) {
  const print = read ? `console.log(JSON.stringify(m.env[${JSON.stringify(read)}] ?? null))` : '';
  const result = Bun.spawnSync(['bun', '--no-env-file', '-e', `const m = await import(${JSON.stringify(ENV_MODULE)}); ${print}`], {
    cwd: tmpdir(),
    env: {
      PATH: process.env.PATH ?? '',
      DATABASE_URL: 'postgresql://test:test@localhost/test',
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      ...extra,
    },
    stderr: 'pipe',
  });
  return {
    exitCode: result.exitCode,
    stderr: result.stderr.toString(),
    value: read && result.exitCode === 0 ? (JSON.parse(result.stdout.toString()) as unknown) : undefined,
  };
}

/** A directory that stands for the build of apps/web, removed after the file's tests. */
export function fakeWebBuild(): string {
  const dir = mkdtempSync(join(tmpdir(), 'web-dist-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Tom</title>');
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}
