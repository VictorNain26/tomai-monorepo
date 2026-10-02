import { describe, expect, it } from 'bun:test';
import { tmpdir } from 'node:os';

const ENV_MODULE = new URL('../platform/config/env.ts', import.meta.url).pathname;

function corsOrigins(extra: Record<string, string>): string[] {
  const result = Bun.spawnSync(
    ['bun', '--no-env-file', '-e', `const m = await import(${JSON.stringify(ENV_MODULE)}); console.log(JSON.stringify(m.getCorsOrigins()))`],
    {
      cwd: tmpdir(),
      env: {
        PATH: process.env['PATH'] ?? '',
        DATABASE_URL: 'postgresql://test:test@localhost/test',
        BETTER_AUTH_SECRET: 'x'.repeat(32),
        ...extra,
      },
      stderr: 'pipe',
    },
  );
  expect(result.exitCode).toBe(0);
  return JSON.parse(result.stdout.toString()) as string[];
}

describe('env — CORS origins', () => {
  it('does not trust the landing origin in development', () => {
    const origins = corsOrigins({ NODE_ENV: 'development' });
    expect(origins).toContain('http://localhost:3000');
    expect(origins).not.toContain('http://localhost:3001');
  });

  it('adds every CORS_ORIGINS entry', () => {
    const origins = corsOrigins({ NODE_ENV: 'development', CORS_ORIGINS: 'http://a.test, http://b.test' });
    expect(origins).toEqual(expect.arrayContaining(['http://a.test', 'http://b.test']));
  });
});
