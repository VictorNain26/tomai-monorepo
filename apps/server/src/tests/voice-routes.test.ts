import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { createMockLogger } from './_helpers/mock-logger';
import type { AppEnv } from '../platform/http/context';

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));
mock.module('../platform/auth/session', () => {
  const ok = () => Promise.resolve({ success: true as const, user: { id: 'u1', role: 'student' }, session: { id: 's1' } });
  return { requireAuth: ok, requireParentRole: ok };
});
const synthesize = mock((_text: string, _owner: unknown, _options: unknown) =>
  Promise.resolve({ success: true, audioData: 'AAA', mimeType: 'audio/mpeg' }),
);
mock.module('../modules/voice/text-to-speech.service', () => ({ textToSpeechService: { synthesize } }));
let allowed = true;
mock.module('../modules/billing/index', () => ({ checkQuota: mock(async () => ({ allowed })) }));

const { voiceRoutes } = await import('../modules/voice/voice.routes');
const { handleError } = await import('../platform/http/error-handler');
const app = new Hono<AppEnv>().route('/api/tts', voiceRoutes).onError(handleError);

function post(body: unknown) {
  return app.request('/api/tts/synthesize', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('voice routes', () => {
  beforeEach(() => {
    synthesize.mockClear();
    allowed = true;
  });

  it.each([
    ['a language without a voice', { text: 'Bonjour', language: 'de' }],
    ['an unknown school level', { text: 'Bonjour', schoolLevel: 'zzzz' }],
  ])('reject %s before synthesis', async (_label, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(synthesize).not.toHaveBeenCalled();
  });

  it('synthesises French text for a known level', async () => {
    const res = await post({ text: 'Bonjour', schoolLevel: 'cinquieme' });
    expect(res.status).toBe(200);
    expect(synthesize.mock.calls[0]?.slice(1)).toEqual([{ userId: 'u1' }, { language: 'fr', schoolLevel: 'cinquieme' }]);
  });

  it('refuses speech once the day\'s budget is spent, before any synthesis', async () => {
    allowed = false;
    const res = await post({ text: 'Bonjour' });
    expect(res.status).toBe(429);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('QUOTA_EXCEEDED');
    expect(synthesize).not.toHaveBeenCalled();
  });
});
