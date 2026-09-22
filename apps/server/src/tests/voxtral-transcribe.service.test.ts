/**
 * Tests unitaires — Voxtral STT Service
 * Vérifie l'URL, le multipart model/language, le parsing {text} et les erreurs.
 */

import { describe, it, expect, afterEach, mock, spyOn } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

mock.module('../config/env', () => ({
  env: {
    MISTRAL_API_KEY: 'test-mistral-key',
    MISTRAL_SERVER_URL: 'https://api.eu.mistral.ai',
    MISTRAL_STT_MODEL: 'voxtral-mini-2602',
    MISTRAL_TIMEOUT: 50,
  },
}));

// ============================================
// Import après mocks
// ============================================

const { getVoxtralTranscribeService, isVoxtralTranscribeConfigured } = await import(
  '../services/voxtral-transcribe.service'
);

// ============================================
// Helpers
// ============================================

function makeAudioBuffer(size = 8): ArrayBuffer {
  return new Uint8Array(size).fill(1).buffer;
}

function mockFetchSuccess(text: string, model = 'voxtral-mini-2602') {
  return spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify({ model, text, language: null, usage: {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function mockFetchError(status: number, body = 'error') {
  return spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(body, { status }),
  );
}

function mockFetchThrow(message: string) {
  return spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error(message));
}

// ============================================
// Tests
// ============================================

describe('VoxtralTranscribeService', () => {
  let fetchSpy: ReturnType<typeof spyOn> | null = null;

  afterEach(() => {
    fetchSpy?.mockRestore();
    fetchSpy = null;
  });

  describe('isVoxtralTranscribeConfigured', () => {
    it('returns true when MISTRAL_API_KEY is set', () => {
      expect(isVoxtralTranscribeConfigured()).toBe(true);
    });
  });

  describe('transcribe — success', () => {
    it('calls the correct Mistral STT endpoint', async () => {
      fetchSpy = mockFetchSuccess('Bonjour le monde');
      const service = getVoxtralTranscribeService();

      await service.transcribe(makeAudioBuffer(), 'audio/webm');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [request] = fetchSpy.mock.calls[0] as [Request];
      expect(request.url).toBe('https://api.eu.mistral.ai/v1/audio/transcriptions');
    });

    it('sends Authorization Bearer header', async () => {
      fetchSpy = mockFetchSuccess('test');
      const service = getVoxtralTranscribeService();

      await service.transcribe(makeAudioBuffer(), 'audio/webm');

      const [request] = fetchSpy.mock.calls[0] as [Request];
      expect(request.headers.get('authorization')).toBe('Bearer test-mistral-key');
    });

    it('includes model=voxtral-mini-2602 in formData', async () => {
      fetchSpy = mockFetchSuccess('test');
      const service = getVoxtralTranscribeService();

      await service.transcribe(makeAudioBuffer(), 'audio/mp4');

      const [request] = fetchSpy.mock.calls[0] as [Request];
      const body = await request.formData();
      expect(body.get('model')).toBe('voxtral-mini-2602');
    });

    it('preserves the real audio mimeType in the multipart file part', async () => {
      fetchSpy = mockFetchSuccess('test');
      const service = getVoxtralTranscribeService();

      await service.transcribe(makeAudioBuffer(), 'audio/webm');

      const [request] = fetchSpy.mock.calls[0] as [Request];
      // Bun's Request#formData() doesn't reconstruct the per-part Content-Type
      // (the Blob it returns always has type ""), so this reads the raw
      // multipart body instead of relying on it.
      const raw = await request.text();
      const fileSection = raw.slice(raw.indexOf('name="file"'));
      expect(fileSection).toContain('Content-Type: audio/webm');
    });

    it('defaults to language=fr', async () => {
      fetchSpy = mockFetchSuccess('test');
      const service = getVoxtralTranscribeService();

      await service.transcribe(makeAudioBuffer(), 'audio/mp4');

      const [request] = fetchSpy.mock.calls[0] as [Request];
      const body = await request.formData();
      expect(body.get('language')).toBe('fr');
    });

    it('uses the provided language option', async () => {
      fetchSpy = mockFetchSuccess('hello');
      const service = getVoxtralTranscribeService();

      await service.transcribe(makeAudioBuffer(), 'audio/mp4', { language: 'en' });

      const [request] = fetchSpy.mock.calls[0] as [Request];
      const body = await request.formData();
      expect(body.get('language')).toBe('en');
    });

    it('returns success with the transcribed text', async () => {
      fetchSpy = mockFetchSuccess('Bonjour le monde');
      const service = getVoxtralTranscribeService();

      const result = await service.transcribe(makeAudioBuffer(), 'audio/webm');

      expect(result.success).toBe(true);
      expect(result.transcription).toBe('Bonjour le monde');
    });

    it('returns detectedLanguage equal to the requested language', async () => {
      fetchSpy = mockFetchSuccess('Hello');
      const service = getVoxtralTranscribeService();

      const result = await service.transcribe(makeAudioBuffer(), 'audio/webm', {
        language: 'en',
      });

      expect(result.detectedLanguage).toBe('en');
    });
  });

  describe('transcribe — API errors', () => {
    it('returns failure on non-2xx HTTP status', async () => {
      fetchSpy = mockFetchError(400, 'Bad Request');
      const service = getVoxtralTranscribeService();

      const result = await service.transcribe(makeAudioBuffer(), 'audio/webm');

      expect(result.success).toBe(false);
      expect(result.error).toContain('400');
    });

    it('returns failure on 401 Unauthorized (wrong/missing API key)', async () => {
      fetchSpy = mockFetchError(401, 'Unauthorized');
      const service = getVoxtralTranscribeService();

      const result = await service.transcribe(makeAudioBuffer(), 'audio/webm');

      expect(result.success).toBe(false);
      expect(result.error).toContain('401');
    });

    it('returns failure when API returns empty text', async () => {
      fetchSpy = mockFetchSuccess('');
      const service = getVoxtralTranscribeService();

      const result = await service.transcribe(makeAudioBuffer(), 'audio/webm');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns failure and logs on network error', async () => {
      fetchSpy = mockFetchThrow('Network failure');
      const service = getVoxtralTranscribeService();

      const result = await service.transcribe(makeAudioBuffer(), 'audio/webm');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network failure');
    });

    it('aborts a hanging transcription request', async () => {
      let captured: AbortSignal | undefined;
      fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(((input: Request) => {
        captured = input.signal;
        return new Promise((_, reject) =>
          input.signal.addEventListener('abort', () => reject(input.signal.reason)),
        );
      }) as unknown as typeof fetch);

      const result = await getVoxtralTranscribeService().transcribe(makeAudioBuffer(), 'audio/webm');

      expect(result.success).toBe(false);
      expect(captured?.aborted).toBe(true);
    });
  });
});
