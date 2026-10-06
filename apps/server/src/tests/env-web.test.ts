import { afterAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootEnv, fakeWebBuild } from './_helpers/boot-env';

const loadEnv = (extra: Record<string, string>) => bootEnv(extra, 'WEB_DIST_DIR');

const build = fakeWebBuild();
const empty = mkdtempSync(join(tmpdir(), 'empty-'));
afterAll(() => {
  rmSync(empty, { recursive: true, force: true });
});

const PRODUCTION = { NODE_ENV: 'production', BETTER_AUTH_URL: 'https://tom.example' };

describe('env — web client', () => {
  it('refuses to boot in production without the web build', () => {
    const { exitCode, stderr } = loadEnv(PRODUCTION);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('WEB_DIST_DIR');
  });

  it('refuses a directory without index.html', () => {
    const { exitCode, stderr } = loadEnv({ ...PRODUCTION, WEB_DIST_DIR: empty });
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('index.html');
  });

  it('accepts a web build in production', () => {
    expect(loadEnv({ ...PRODUCTION, WEB_DIST_DIR: build }).value).toBe(build);
  });

  it('runs without a web build in development, where Vite serves it', () => {
    expect(loadEnv({ NODE_ENV: 'development' }).value).toBeNull();
  });

  it('takes the Vite dev server as the public origin in development, so redirects land on the web', () => {
    expect(bootEnv({ NODE_ENV: 'development' }, 'BETTER_AUTH_URL').value).toBe('http://localhost:3002');
  });
});
