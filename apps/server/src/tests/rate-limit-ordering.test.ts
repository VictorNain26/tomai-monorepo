/**
 * Rate-limit hook ordering vs auth `resolve`.
 *
 * Elysia runs `resolve` (which authMacro uses to inject `user`) at the END of the
 * beforeHandle phase, in registration order. A rate-limit registered BEFORE
 * `.guard({ auth: true })` therefore sees `user === undefined` and silently
 * falls back to per-IP keying. These tests pin the correct wiring and guard
 * against regressing the order.
 */

import { describe, it, expect, mock } from 'bun:test';
import type { Context } from 'elysia';

// authMacro calls requireAuth(headers); mock it so a deterministic user is
// injected without hitting Better Auth / the DB.
mock.module('../middleware/auth.middleware', () => ({
  requireAuth: () =>
    Promise.resolve({ success: true, user: { id: 'U1' }, session: { id: 's1' } }),
  requireParentRole: () =>
    Promise.resolve({ success: true, user: { id: 'U1', role: 'parent' }, session: { id: 's1' } }),
}));

const { Elysia } = await import('elysia');
const { authMacro } = await import('../lib/auth-macro');
const { RateLimitPresets } = await import('../middleware/rate-limit.middleware');

function keyCapture() {
  let key: string | undefined;
  return {
    hook: (ctx: Context) => {
      key = RateLimitPresets.pronote.keyGenerator?.(ctx);
    },
    get: () => key,
  };
}

describe('rate-limit hook ordering vs auth resolve', () => {
  it('keys by user when the rate-limit runs AFTER .guard({ auth: true })', async () => {
    const cap = keyCapture();
    const app = new Elysia()
      .use(authMacro)
      .guard({ auth: true })
      .onBeforeHandle(cap.hook)
      .get('/api/pronote/x', () => 'ok');

    const res = await app.handle(new Request('http://localhost/api/pronote/x'));
    expect(res.status).toBe(200);
    expect(cap.get()).toBe('pronote:user:U1');
  });

  it('REGRESSION: falls back to IP when the rate-limit runs BEFORE the guard', async () => {
    const cap = keyCapture();
    const app = new Elysia()
      .use(authMacro)
      .onBeforeHandle(cap.hook)
      .guard({ auth: true })
      .get('/api/pronote/x', () => 'ok');

    const res = await app.handle(
      new Request('http://localhost/api/pronote/x', { headers: { 'x-real-ip': '4.4.4.4' } })
    );
    expect(res.status).toBe(200);
    expect(cap.get()?.startsWith('ip:')).toBe(true);
  });
});
