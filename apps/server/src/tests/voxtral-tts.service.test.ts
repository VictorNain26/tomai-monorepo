import { describe, it, expect, afterEach, mock, spyOn } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

mock.module('../lib/observability', () => ({ logger: createMockLogger() }));
mock.module('../config/env', () => ({
  env: {
    MISTRAL_API_KEY: 'test-mistral-key',
    MISTRAL_SERVER_URL: 'https://api.eu.mistral.ai',
    MISTRAL_TTS_MODEL: 'voxtral-mini-tts-2603',
    MISTRAL_TIMEOUT: 5000,
  },
}));

const { getVoxtralTTSService } = await import('../services/voxtral-tts.service');

describe('VoxtralTTSService', () => {
  let fetchSpy: ReturnType<typeof spyOn> | undefined;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('synthesises with the dated model on the configured endpoint', async () => {
    let request: Request | undefined;
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (input: Request) => {
      request = input;
      return new Response(JSON.stringify({ audio_data: 'AAAA' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch);

    const result = await getVoxtralTTSService().synthesize('Bonjour');

    expect(result.success).toBe(true);
    expect(request?.url).toBe('https://api.eu.mistral.ai/v1/audio/speech');
    const body = (await request?.json()) as { model: string };
    expect(body.model).toBe('voxtral-mini-tts-2603');
  });

  it('sends the chosen voice as voice_id and returns the base64 audio', async () => {
    let body: Record<string, unknown> = {};
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (input: Request) => {
      body = (await input.json()) as Record<string, unknown>;
      return new Response(JSON.stringify({ audio_data: 'QUJD' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch);

    const result = await getVoxtralTTSService().synthesize('Bonjour', { voiceId: 'fr_marie_neutral' });

    expect(body['voice_id']).toBe('fr_marie_neutral');
    expect(body['voice']).toBeUndefined();
    expect(result).toEqual({ success: true, audioData: 'QUJD', mimeType: 'audio/mpeg' });
  });

  it('uses the default voice fr_marie_neutral and sends no language field', async () => {
    let body: Record<string, unknown> = {};
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (input: Request) => {
      body = (await input.json()) as Record<string, unknown>;
      return new Response(JSON.stringify({ audio_data: 'AAAA' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch);

    await getVoxtralTTSService().synthesize('Bonjour');

    expect(body['voice_id']).toBe('fr_marie_neutral');
    expect('language' in body).toBe(false);
  });
});
