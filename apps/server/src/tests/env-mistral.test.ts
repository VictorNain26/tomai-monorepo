import { describe, expect, it } from 'bun:test';
import { bootEnv, fakeWebBuild } from './_helpers/boot-env';

// Production also requires the web build.
const WEB_DIST_DIR = fakeWebBuild();

describe('env — Mistral model ids', () => {
  it('boots with the dated defaults', () => {
    expect(bootEnv({}).exitCode).toBe(0);
  });

  it('refuses a -latest alias for the text model', () => {
    const result = bootEnv({ MISTRAL_MODEL: 'mistral-small-latest' });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('MISTRAL_MODEL');
  });

  it('refuses a -latest alias for the speech model', () => {
    const result = bootEnv({ MISTRAL_TTS_MODEL: 'voxtral-mini-tts-latest' });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('MISTRAL_TTS_MODEL');
  });

  it('refuses a server URL that is not a URL', () => {
    const result = bootEnv({ MISTRAL_SERVER_URL: 'api.eu.mistral.ai' });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('MISTRAL_SERVER_URL');
  });

  it('refuses a server URL with a path', () => {
    const result = bootEnv({ MISTRAL_SERVER_URL: 'https://api.eu.mistral.ai/v1' });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('MISTRAL_SERVER_URL');
  });

  it('refuses a server URL with a trailing slash', () => {
    const result = bootEnv({ MISTRAL_SERVER_URL: 'https://api.eu.mistral.ai/' });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('MISTRAL_SERVER_URL');
  });

  it('refuses a non-EU server URL in production', () => {
    const result = bootEnv({
      NODE_ENV: 'production',
      MISTRAL_SERVER_URL: 'https://api.mistral.ai',
      BETTER_AUTH_URL: 'https://tomia.fr',
      WEB_DIST_DIR,
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('MISTRAL_SERVER_URL');
  });

  it('accepts the EU server URL in production', () => {
    const result = bootEnv({
      NODE_ENV: 'production',
      MISTRAL_SERVER_URL: 'https://api.eu.mistral.ai',
      BETTER_AUTH_URL: 'https://tomia.fr',
      WEB_DIST_DIR,
    });
    expect(result.exitCode).toBe(0);
  });
});
