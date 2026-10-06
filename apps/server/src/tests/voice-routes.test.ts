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
mock.module('../modules/voice/text-to-speech.service', () => ({
  textToSpeechService: { synthesize, costMicroEur: (text: string) => text.length * 18 },
}));
let allowed = true;
const checkQuota = mock(async (_userId: string, _plannedMicroEur?: number) => ({ allowed }));
mock.module('../modules/billing/index', () => ({ checkQuota }));

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
    checkQuota.mockClear();
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

  it("refuses speech once the day's budget is spent, before any synthesis", async () => {
    allowed = false;
    const res = await post({ text: 'Bonjour' });
    expect(res.status).toBe(429);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('QUOTA_EXCEEDED');
    expect(synthesize).not.toHaveBeenCalled();
  });

  it('checks the budget against the cost of the reading, known before the call', async () => {
    await post({ text: 'Bonjour' });
    expect(checkQuota.mock.calls[0]).toEqual(['u1', 7 * 18]);
  });

  it('reads one text at a time per student, and frees the slot once done', async () => {
    let finish = () => {};
    synthesize.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => {
            resolve({ success: true, audioData: 'AAA', mimeType: 'audio/mpeg' });
          };
        }),
    );
    const first = post({ text: 'Bonjour' });
    await Bun.sleep(5);
    const second = await post({ text: 'Bonjour' });
    expect(second.status).toBe(409);
    finish();
    expect((await first).status).toBe(200);
    expect((await post({ text: 'Bonjour' })).status).toBe(200);
  });
});
