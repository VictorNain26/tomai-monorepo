import { describe, expect, it } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ENV_MODULE = new URL('../platform/config/env.ts', import.meta.url).pathname;

// env.ts parses Bun.env once, at load: each case loads it in a fresh process.
function loadEnv(extra: Record<string, string>) {
  const result = Bun.spawnSync(
    [
      'bun',
      '--no-env-file',
      '-e',
      `const m = await import(${JSON.stringify(ENV_MODULE)}); console.log(JSON.stringify({ webDistDir: m.env.WEB_DIST_DIR ?? null, trusted: m.getTrustedOrigins() }))`,
    ],
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
    value: result.exitCode === 0 ? (JSON.parse(result.stdout.toString()) as { webDistDir: string | null; trusted: string[] }) : null,
  };
}

function webBuild(): string {
  const dir = mkdtempSync(join(tmpdir(), 'web-dist-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html>');
  return dir;
}

const PRODUCTION = { NODE_ENV: 'production', BETTER_AUTH_URL: 'https://tom.example' };

describe('env — web client', () => {
  it('refuses to boot in production without the web build', () => {
    const { exitCode, stderr } = loadEnv(PRODUCTION);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('WEB_DIST_DIR');
  });

  it('refuses a directory without index.html', () => {
    const { exitCode, stderr } = loadEnv({ ...PRODUCTION, WEB_DIST_DIR: mkdtempSync(join(tmpdir(), 'empty-')) });
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('index.html');
  });

  it('accepts a web build in production, and trusts no origin beyond the base URL', () => {
    const dir = webBuild();
    const { value } = loadEnv({ ...PRODUCTION, WEB_DIST_DIR: dir });
    expect(value).toEqual({ webDistDir: dir, trusted: [] });
  });

  it('runs without a web build in development, and trusts the Vite dev server', () => {
    const { value } = loadEnv({ NODE_ENV: 'development' });
    expect(value).toEqual({ webDistDir: null, trusted: ['http://localhost:3002'] });
  });
});
