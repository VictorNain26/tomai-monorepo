import { describe, expect, it } from 'bun:test';
import { tmpdir } from 'node:os';

const ENV_MODULE = new URL('../config/env.ts', import.meta.url).pathname;

function bootEnv(extra: Record<string, string>) {
  return Bun.spawnSync(['bun', '--no-env-file', '-e', `await import(${JSON.stringify(ENV_MODULE)})`], {
    cwd: tmpdir(),
    env: {
      PATH: process.env['PATH'] ?? '',
      DATABASE_URL: 'postgresql://test:test@localhost/test',
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      ...extra,
    },
    stderr: 'pipe',
  });
}

describe('env — Mistral model ids', () => {
  it('boots with the dated defaults', () => {
    expect(bootEnv({}).exitCode).toBe(0);
  });

  it('refuses a -latest alias for the text model', () => {
    const result = bootEnv({ MISTRAL_MODEL: 'mistral-small-latest' });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('MISTRAL_MODEL');
  });

  it('refuses a -latest alias for the speech model', () => {
    const result = bootEnv({ MISTRAL_TTS_MODEL: 'voxtral-mini-tts-latest' });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('MISTRAL_TTS_MODEL');
  });

  it('refuses a server URL that is not a URL', () => {
    const result = bootEnv({ MISTRAL_SERVER_URL: 'api.eu.mistral.ai' });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('MISTRAL_SERVER_URL');
  });

  it('refuses a server URL with a path', () => {
    const result = bootEnv({ MISTRAL_SERVER_URL: 'https://api.eu.mistral.ai/v1' });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('MISTRAL_SERVER_URL');
  });

  it('refuses a server URL with a trailing slash', () => {
    const result = bootEnv({ MISTRAL_SERVER_URL: 'https://api.eu.mistral.ai/' });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('MISTRAL_SERVER_URL');
  });

  it('refuses a non-EU server URL in production', () => {
    const result = bootEnv({
      NODE_ENV: 'production',
      MISTRAL_SERVER_URL: 'https://api.mistral.ai',
      PRONOTE_ENCRYPTION_KEY: 'x'.repeat(32),
      BETTER_AUTH_URL: 'https://tomia.fr',
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('MISTRAL_SERVER_URL');
  });

  it('accepts the EU server URL in production', () => {
    const result = bootEnv({
      NODE_ENV: 'production',
      MISTRAL_SERVER_URL: 'https://api.eu.mistral.ai',
      PRONOTE_ENCRYPTION_KEY: 'x'.repeat(32),
      BETTER_AUTH_URL: 'https://tomia.fr',
    });
    expect(result.exitCode).toBe(0);
  });
});
