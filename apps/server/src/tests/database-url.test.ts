import { afterEach, describe, expect, it } from 'bun:test';
import { databaseSsl, resolveDatabaseUrl } from '../platform/config/database-url';

const previousUrl = Bun.env.DATABASE_URL;
afterEach(() => {
  if (previousUrl === undefined) delete Bun.env.DATABASE_URL;
  else Bun.env.DATABASE_URL = previousUrl;
});

describe('database connection settings', () => {
  it('requires TLS in production', () => {
    expect(databaseSsl('production')).toEqual({ ssl: 'require' });
  });

  it('leaves TLS to the URL elsewhere, so a sslmode in DATABASE_URL still applies', () => {
    expect(databaseSsl('development')).toEqual({});
    expect(databaseSsl('test')).toEqual({});
  });

  it('reads DATABASE_URL, and fails without it', () => {
    Bun.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
    expect(resolveDatabaseUrl()).toBe('postgresql://u:p@localhost:5432/db');

    delete Bun.env.DATABASE_URL;
    expect(() => resolveDatabaseUrl()).toThrow('DATABASE_URL is required');
  });
});
