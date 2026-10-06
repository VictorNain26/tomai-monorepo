import { afterAll, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ENV_MODULE = new URL('../platform/config/env.ts', import.meta.url).pathname;

// env.ts parses Bun.env once, at load: each case loads it in a fresh process.
function loadEnv(extra: Record<string, string>) {
  const result = Bun.spawnSync(
    ['bun', '--no-env-file', '-e', `const m = await import(${JSON.stringify(ENV_MODULE)}); console.log(JSON.stringify(m.env.WEB_DIST_DIR ?? null))`],
    {
      cwd: tmpdir(),
      env: {
        PATH: process.env.PATH ?? '',
        DATABASE_URL: 'postgresql://test:test@localhost/test',
        BETTER_AUTH_SECRET: 'x'.repeat(32),
        ...extra,
      },
      stderr: 'pipe',
    },
  );
  return {
    exitCode: result.exitCode,
    stderr: result.stderr.toString(),
    value: result.exitCode === 0 ? (JSON.parse(result.stdout.toString()) as string | null) : undefined,
  };
}

const root = mkdtempSync(join(tmpdir(), 'env-web-'));
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function dir(name: string): string {
  const path = join(root, name);
  mkdirSync(path);
  return path;
}

function webBuild(): string {
  const path = dir('dist');
  writeFileSync(join(path, 'index.html'), '<!doctype html>');
  return path;
}

const PRODUCTION = { NODE_ENV: 'production', BETTER_AUTH_URL: 'https://tom.example' };

describe('env — web client', () => {
  it('refuses to boot in production without the web build', () => {
    const { exitCode, stderr } = loadEnv(PRODUCTION);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('WEB_DIST_DIR');
  });

  it('refuses a directory without index.html', () => {
    const { exitCode, stderr } = loadEnv({ ...PRODUCTION, WEB_DIST_DIR: dir('empty') });
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('index.html');
  });

  it('accepts a web build in production', () => {
    const build = webBuild();
    expect(loadEnv({ ...PRODUCTION, WEB_DIST_DIR: build }).value).toBe(build);
  });

  it('runs without a web build in development, where Vite serves it', () => {
    expect(loadEnv({ NODE_ENV: 'development' }).value).toBeNull();
  });
});
