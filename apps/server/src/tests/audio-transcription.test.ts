import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));

let reply: { success: boolean; transcription?: string; detectedLanguage?: string; error?: string } = { success: true, transcription: 'Bonjour' };
const transcribe = mock(async (_audio: ArrayBuffer, _mimeType: string) => reply);
mock.module('../modules/voice/voxtral-transcribe.service', () => ({
  getVoxtralTranscribeService: () => ({ transcribe }),
  isVoxtralTranscribeConfigured: () => true,
}));

const { audioTranscriptionService } = await import('../modules/voice/audio-transcription.service');

beforeEach(() => {
  transcribe.mockClear();
});

describe('audioTranscriptionService.transcribeAudio', () => {
  it('transcribes the audio as it is, no language forced, and claims no language Voxtral did not give', async () => {
    reply = { success: true, transcription: 'Bonjour' };
    const audio = new ArrayBuffer(4);

    const result = await audioTranscriptionService.transcribeAudio(audio, 'audio/webm');

    expect(transcribe.mock.calls[0]).toEqual([audio, 'audio/webm']);
    expect(result).toEqual({ success: true, transcription: 'Bonjour' });
  });

  it('keeps the language the API gives', async () => {
    reply = { success: true, transcription: 'Hello', detectedLanguage: 'en' };
    expect(await audioTranscriptionService.transcribeAudio(new ArrayBuffer(4), 'audio/webm')).toEqual({ success: true, transcription: 'Hello', detectedLanguage: 'en' });
  });

  it('reports a failed transcription', async () => {
    reply = { success: false, error: 'Voxtral STT returned empty transcription' };
    expect(await audioTranscriptionService.transcribeAudio(new ArrayBuffer(4), 'audio/webm')).toEqual({ success: false, _error: 'Voxtral STT returned empty transcription' });
  });
});
