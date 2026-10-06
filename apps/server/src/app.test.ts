/**
 * The application as main.ts composes it, on a real database: auth, health, errors, headers and
 * the web client.
 */

import { afterAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pino from 'pino';
import { createApp } from './app';
import { createAuth } from './platform/auth/auth';
import { createLifecycle } from './platform/lifecycle/shutdown';
import { testDatabase } from './testing/database';

const ORIGIN = 'http://localhost:3002';
const { db } = await testDatabase();
const dist = mkdtempSync(join(tmpdir(), 'web-dist-'));
writeFileSync(join(dist, 'index.html'), '<!doctype html><title>Tom</title>');
afterAll(() => {
  rmSync(dist, { recursive: true, force: true });
});

const app = createApp({
  config: { production: false, webDistDir: dist },
  logger: pino({ level: 'silent' }),
  db,
  auth: createAuth(db, { publicUrl: ORIGIN, authSecret: 'x'.repeat(32) }),
  lifecycle: createLifecycle(),
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers },
    body: JSON.stringify(body),
  });

const sessionCookie = (res: Response) => res.headers.getSetCookie().find((cookie) => cookie.startsWith('better-auth.session_token='));

describe('auth', () => {
  const account = { name: 'Victor', email: 'victor@example.com', password: 'un mot de passe solide' };

  it('signs up with an email and a password, and sets a session cookie for this host only', async () => {
    const res = await post('/api/auth/sign-up/email', account);
    expect(res.status).toBe(200);
    const cookie = sessionCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Domain=');
  });

  it('signs in, and the cookie opens the session', async () => {
    const res = await post('/api/auth/sign-in/email', { email: account.email, password: account.password });
    expect(res.status).toBe(200);
    const token = sessionCookie(res)?.split(';')[0] ?? '';

    const session = await app.request(`${ORIGIN}/api/auth/get-session`, { headers: { Cookie: token } });
    expect(((await session.json()) as { user: { email: string } }).user.email).toBe(account.email);
  });

  it('refuses a wrong password', async () => {
    const res = await post('/api/auth/sign-in/email', { email: account.email, password: 'pas le bon' });
    expect(res.status).toBe(401);
  });

  it('refuses a request from another origin', async () => {
    const res = await post('/api/auth/sign-in/email', { email: account.email, password: account.password }, { Origin: 'https://evil.example' });
    expect(res.status).toBe(403);
  });

  it('ends the session on sign-out', async () => {
    const signIn = await post('/api/auth/sign-in/email', { email: account.email, password: account.password });
    const token = sessionCookie(signIn)?.split(';')[0] ?? '';
    await post('/api/auth/sign-out', {}, { Cookie: token });

    const session = await app.request(`${ORIGIN}/api/auth/get-session`, { headers: { Cookie: token } });
    expect(await session.json()).toBeNull();
  });
});

describe('composition', () => {
  it('generates a request id, whatever the client sends', async () => {
    const res = await app.request('/health/live', { headers: { 'X-Request-Id': 'forged' } });
    expect(res.headers.get('x-request-id')).not.toBe('forged');
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });

  it('keeps every API response out of caches', async () => {
    const res = await app.request(`${ORIGIN}/api/auth/get-session`);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('answers an unknown API route with a problem, not with the page', async () => {
    const res = await app.request('/api/nope', { headers: { Accept: 'text/html' } });
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toStartWith('application/problem+json');
  });

  it('serves the web build under the CSP, and hands a client route to it', async () => {
    const res = await app.request('/parent/enfants', { headers: { Accept: 'text/html' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toStartWith("default-src 'self'");
    expect(await res.text()).toContain('<title>Tom</title>');
  });

  it('is ready on its database', async () => {
    expect((await app.request('/health/ready')).status).toBe(200);
  });
});
