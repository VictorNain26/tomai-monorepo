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

const MAIL = {
  SCW_ACCESS_KEY: 'SCWACCESSKEY',
  SCW_SECRET_KEY: 'secret',
  SCW_DEFAULT_PROJECT_ID: '6170692e-7363-616c-6577-61792e636f6d',
  MAIL_FROM: 'tom@mail.tom.example',
};

const PRODUCTION = {
  ...BASE,
  ...MAIL,
  NODE_ENV: 'production',
  BETTER_AUTH_URL: 'https://tom.example',
  WEB_DIST_DIR: build,
  MISTRAL_API_KEY: 'key',
};

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
      mail: undefined,
      mistral: { apiKey: undefined, serverUrl: 'https://api.eu.mistral.ai', model: 'mistral-small-2603', timeoutMs: 30_000, retryAttempts: 2 },
    });
  });

  it('returns a frozen object', () => {
    expect(Object.isFrozen(loadConfig(BASE))).toBe(true);
  });

  it('accepts a production environment with its public origin, the web build and the mail settings', () => {
    expect(loadConfig(PRODUCTION)).toMatchObject({
      production: true,
      publicUrl: 'https://tom.example',
      webDistDir: build,
      mail: { accessKey: MAIL.SCW_ACCESS_KEY, secretKey: MAIL.SCW_SECRET_KEY, projectId: MAIL.SCW_DEFAULT_PROJECT_ID, from: MAIL.MAIL_FROM },
    });
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
    [{ ...PRODUCTION, SCW_SECRET_KEY: undefined }, 'SCW_SECRET_KEY'],
    [{ ...BASE, ...MAIL, SCW_DEFAULT_PROJECT_ID: 'not-a-uuid' }, 'SCW_DEFAULT_PROJECT_ID'],
    [{ ...BASE, ...MAIL, MAIL_FROM: 'tom' }, 'MAIL_FROM'],
    [{ ...BASE, SCW_ACCESS_KEY: 'SCWACCESSKEY' }, 'SCW_SECRET_KEY: requis avec SCW_ACCESS_KEY'],
    [{ ...PRODUCTION, MISTRAL_API_KEY: undefined }, 'MISTRAL_API_KEY'],
    [{ ...PRODUCTION, MISTRAL_SERVER_URL: 'https://api.mistral.ai' }, 'MISTRAL_SERVER_URL: https://api.eu.mistral.ai requis en production'],
    [{ ...BASE, MISTRAL_MODEL: 'mistral-small-latest' }, 'MISTRAL_MODEL'],
    [{ ...BASE, MISTRAL_SERVER_URL: 'https://api.eu.mistral.ai/v1' }, 'MISTRAL_SERVER_URL'],
    [{ ...BASE, MISTRAL_RETRY_ATTEMPTS: '9' }, 'MISTRAL_RETRY_ATTEMPTS'],
  ])('refuses %o, naming %s', (environment, named) => {
    expect(() => loadConfig(environment)).toThrow(named);
  });
});

describe('loadConfig — every fault at once', () => {
  it('names every invalid or missing variable of a production environment in one error', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', BETTER_AUTH_SECRET: 'x'.repeat(32) })).toThrow(
      /DATABASE_URL[\s\S]*BETTER_AUTH_URL[\s\S]*WEB_DIST_DIR/,
    );
  });

  it('treats an empty variable as unset, so that its default applies', () => {
    expect(loadConfig({ ...BASE, PORT: '', LOG_LEVEL: '' })).toMatchObject({ port: 3000, logLevel: 'info' });
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
