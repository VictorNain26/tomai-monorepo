/**
 * The HTTP calls of a test, as the web makes them: a guardian invited and in by the code their
 * address received, a student created, a device paired by the guardian's code. `app` is the
 * test's app, built by createApp.
 */

import { expect } from 'bun:test';
import { invite } from '../platform/auth/invitation';
import type { Db } from '../platform/db/client';
import type { memoryMailer } from './mailer';

export const ORIGIN = 'http://localhost:3002';

interface App {
  request: (input: string, init?: RequestInit) => Response | Promise<Response>;
}

export interface Student {
  id: string;
  name: string;
  level: string;
  birthMonth: string;
}

interface Device {
  id: string;
  pairedAt: string;
  userAgent: string | null;
}

export function httpClient(app: App, mail: ReturnType<typeof memoryMailer>, db: Db) {
  const request = (method: string, path: string, { cookie, body }: { cookie?: string | undefined; body?: unknown } = {}) =>
    app.request(`${ORIGIN}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'User-Agent': 'test-device',
        ...(cookie === undefined ? {} : { Cookie: cookie }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  const cookieOf = (res: Response) =>
    res.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith('better-auth.session_token='))
      ?.split(';')[0] ?? '';

  const api = {
    request,
    /** Invited, then in by the code their address received: the session it opens. */
    async guardian(email: string) {
      await invite(db, email);
      return api.signIn(email);
    },
    /** In by the code the address receives, named on a first sign-in: the session cookie. */
    async signIn(email: string) {
      const received = mail.next(email);
      expect((await request('POST', '/api/auth/email-otp/send-verification-otp', { body: { email, type: 'sign-in' } })).status).toBe(200);
      const res = await request('POST', '/api/auth/sign-in/email-otp', { body: { email, otp: mail.codeIn(await received), name: 'Parent' } });
      expect(res.status).toBe(200);
      return cookieOf(res);
    },
    async student(cookie: string, overrides: Partial<Omit<Student, 'id'>> = {}) {
      const res = await request('POST', '/api/household/students', {
        cookie,
        body: { name: 'Léa', level: 'cinquieme', birthMonth: '2014-03', ...overrides },
      });
      expect(res.status).toBe(201);
      return (await res.json()) as Student;
    },
    async pairingCode(cookie: string, studentId: string) {
      const res = await request('POST', `/api/household/students/${studentId}/pairing-code`, { cookie });
      expect(res.status).toBe(201);
      return ((await res.json()) as { code: string; expiresAt: string }).code;
    },
    async redeem(code: string) {
      const res = await request('POST', '/api/auth/device-pairing/redeem', { body: { code } });
      return { status: res.status, cookie: cookieOf(res) };
    },
    /** A guardian's code, redeemed on a new device: that device's session cookie. */
    async pair(cookie: string, studentId: string) {
      const { status, cookie: device } = await api.redeem(await api.pairingCode(cookie, studentId));
      expect(status).toBe(200);
      return device;
    },
    async sessionUser(cookie: string) {
      const res = await request('GET', '/api/auth/get-session', { cookie });
      return ((await res.json()) as { user: { id: string } } | null)?.user;
    },
    async devices(cookie: string, studentId: string) {
      return (await (await request('GET', `/api/household/students/${studentId}/devices`, { cookie })).json()) as Device[];
    },
  };
  return api;
}
