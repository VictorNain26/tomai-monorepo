import { describe, it, expect, afterEach, mock, spyOn } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

mock.module('../lib/observability', () => ({ logger: createMockLogger() }));
mock.module('../config/env', () => ({
  env: {
    MISTRAL_API_KEY: 'test-mistral-key',
    MISTRAL_SERVER_URL: 'https://api.eu.mistral.ai',
    MISTRAL_TTS_MODEL: 'voxtral-mini-tts-2603',
  },
}));

const { getVoxtralTTSService } = await import('../services/voxtral-tts.service');

describe('VoxtralTTSService', () => {
  let fetchSpy: ReturnType<typeof spyOn> | undefined;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('synthesises with the dated model on the configured endpoint', async () => {
    fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ audio_data: 'AAAA' }), { headers: { 'content-type': 'application/json' } }),
    );

    const result = await getVoxtralTTSService().synthesize('Bonjour');

    expect(result.success).toBe(true);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.eu.mistral.ai/v1/audio/speech');
    expect((JSON.parse(init.body as string) as { model: string }).model).toBe('voxtral-mini-tts-2603');
  });

  it('uses the default voice fr_marie_neutral and sends no language field', async () => {
    fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ audio_data: 'AAAA' }), { headers: { 'content-type': 'application/json' } }),
    );

    await getVoxtralTTSService().synthesize('Bonjour');

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body['voice']).toBe('fr_marie_neutral');
    expect('language' in body).toBe(false);
  });
});
