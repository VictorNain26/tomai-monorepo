import { afterAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, loadDatabaseConfig } from './config';

const BASE = {
  DATABASE_URL: 'postgresql://tom:tom@localhost:5432/tom',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
};

const build = mkdtempSync(join(tmpdir(), 'web-dist-'));
writeFileSync(join(build, 'index.html'), '<!doctype html>');
const empty = mkdtempSync(join(tmpdir(), 'empty-'));
afterAll(() => {
  rmSync(build, { recursive: true, force: true });
  rmSync(empty, { recursive: true, force: true });
});

const PRODUCTION = { ...BASE, NODE_ENV: 'production', BETTER_AUTH_URL: 'https://tom.example', WEB_DIST_DIR: build };

describe('loadConfig', () => {
  it('fills the development defaults, the Vite dev server as public origin', () => {
    expect(loadConfig(BASE)).toEqual({
      production: false,
      port: 3000,
      logLevel: 'info',
      databaseUrl: BASE.DATABASE_URL,
      publicUrl: 'http://localhost:3002',
      authSecret: BASE.BETTER_AUTH_SECRET,
      webDistDir: undefined,
    });
  });

  it('returns a frozen object', () => {
    expect(Object.isFrozen(loadConfig(BASE))).toBe(true);
  });

  it('accepts a production environment with its public origin and the web build', () => {
    expect(loadConfig(PRODUCTION)).toMatchObject({ production: true, publicUrl: 'https://tom.example', webDistDir: build });
  });

  it.each([
    [{ ...BASE, DATABASE_URL: undefined }, 'DATABASE_URL'],
    [{ ...BASE, DATABASE_URL: 'mysql://tom@localhost/tom' }, 'DATABASE_URL'],
    [{ ...BASE, BETTER_AUTH_SECRET: 'short' }, 'BETTER_AUTH_SECRET'],
    [{ ...BASE, PORT: '70000' }, 'PORT'],
    [{ ...BASE, LOG_LEVEL: 'verbose' }, 'LOG_LEVEL'],
    [{ ...BASE, WEB_DIST_DIR: empty }, 'index.html'],
    [{ ...PRODUCTION, BETTER_AUTH_URL: undefined }, 'BETTER_AUTH_URL'],
    [{ ...PRODUCTION, WEB_DIST_DIR: undefined }, 'WEB_DIST_DIR'],
  ])('refuses %o, naming %s', (environment, named) => {
    expect(() => loadConfig(environment)).toThrow(named);
  });
});

describe('loadDatabaseConfig', () => {
  it('needs the database only, not the server secrets', () => {
    expect(loadDatabaseConfig({ DATABASE_URL: BASE.DATABASE_URL, NODE_ENV: 'production' })).toEqual({
      production: true,
      databaseUrl: BASE.DATABASE_URL,
    });
  });

  it('refuses a missing DATABASE_URL', () => {
    expect(() => loadDatabaseConfig({})).toThrow('DATABASE_URL');
  });
});
