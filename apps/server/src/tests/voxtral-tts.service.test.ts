import { describe, it, expect, afterEach, mock, spyOn, type Mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));
mock.module('../platform/config/env', () => ({
  env: {
    MISTRAL_API_KEY: 'test-mistral-key',
    MISTRAL_SERVER_URL: 'https://api.eu.mistral.ai',
    MISTRAL_TTS_MODEL: 'voxtral-mini-tts-2603',
    MISTRAL_TIMEOUT: 50,
  },
}));

const recordAiCost = mock(async (_owner: unknown, _call: unknown) => {});
const costOf = mock((_model: string, usage: { characters?: number }) => (usage.characters ?? 0) * 18);
mock.module('../platform/ai/cost', () => ({ recordAiCost, costOf }));
const owner = { userId: 'u1' };

const { getVoxtralTTSService } = await import('../modules/voice/voxtral-tts.service');

describe('VoxtralTTSService', () => {
  let fetchSpy: Mock<typeof fetch> | undefined;

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

    const result = await getVoxtralTTSService().synthesize('Bonjour', owner);

    expect(result.success).toBe(true);
    expect(request?.url).toBe('https://api.eu.mistral.ai/v1/audio/speech');
    const body = (await request?.json()) as { model: string };
    expect(body.model).toBe('voxtral-mini-tts-2603');
  });

  it('bills the characters of the text read to the owner, and nothing for a failed call', async () => {
    recordAiCost.mockClear();
    fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ audio_data: 'AAAA' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    // Counted as graphemes: the emoji (two UTF-16 units) and the decomposed « é » (two code points) are one each.
    await getVoxtralTTSService().synthesize('Bonjour 🙂 e\u0301', owner);
    expect(recordAiCost.mock.calls).toEqual([[owner, { model: 'voxtral-mini-tts-2603', operation: 'text-to-speech', characters: 11 }]]);

    fetchSpy.mockRestore();
    fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{"detail":"Internal error"}', { status: 500 }));
    await getVoxtralTTSService().synthesize('Bonjour', owner);
    expect(recordAiCost).toHaveBeenCalledTimes(1);
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

    const result = await getVoxtralTTSService().synthesize('Bonjour', owner, { voiceId: 'fr_marie_neutral' });

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

    await getVoxtralTTSService().synthesize('Bonjour', owner);

    expect(body['voice_id']).toBe('fr_marie_neutral');
    expect('language' in body).toBe(false);
  });

  it('returns a failure on a non-2xx response', async () => {
    fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'invalid voice' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await getVoxtralTTSService().synthesize('Bonjour', owner);

    expect(result.success).toBe(false);
    expect(result.audioData).toBeUndefined();
  });

  it('returns a generic error without the upstream response body', async () => {
    fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'upstream-detail: voice fr_x unknown for org 42' }), {
        status: 422,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await getVoxtralTTSService().synthesize('Bonjour', owner);

    expect(result.error).toBe('Mistral TTS API error: 422');
  });

  it('aborts a hanging synthesis request', async () => {
    let captured: AbortSignal | undefined;
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(((input: Request) => {
      captured = input.signal;
      return new Promise((_, reject) => {
        input.signal.addEventListener('abort', () => {
          reject(input.signal.reason as Error);
        });
      });
    }) as unknown as typeof fetch);

    const result = await getVoxtralTTSService().synthesize('Bonjour', owner);

    expect(result.success).toBe(false);
    expect(captured?.aborted).toBe(true);
  });

  it('prices a reading before the call, on the graphemes of the text', () => {
    expect(getVoxtralTTSService().costMicroEur('Bonjour 🙂')).toBe(9 * 18);
    expect(costOf.mock.calls.at(-1)).toEqual(['voxtral-mini-tts-2603', { characters: 9 }]);
  });
});
