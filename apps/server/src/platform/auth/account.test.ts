/**
 * A guardian's account on a real database, through the HTTP API: the password reset, which ends
 * every session, and the deletion confirmed by email, which takes a sole guardian's household and
 * students with it. A student's `.invalid` address is never sent to.
 */

import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import pino from 'pino';
import { createApp } from '../../app';
import { householdDeletion } from '../../modules/household';
import { household, householdMember } from '../../modules/household/schema';
import { testDatabase } from '../../testing/database';
import { memoryMailer } from '../../testing/mailer';
import { createLifecycle } from '../lifecycle/shutdown';
import { createAuth } from './auth';
import { session, user } from './schema';

const ORIGIN = 'http://localhost:3002';
const PASSWORD = 'un mot de passe solide';
const { db } = await testDatabase();
const mail = memoryMailer();
const auth = createAuth(db, { publicUrl: ORIGIN, authSecret: 'x'.repeat(32) }, { mailer: mail.mailer, beforeDeleteUser: householdDeletion(db) });
const app = createApp({
  config: { production: false, webDistDir: undefined },
  logger: pino({ level: 'silent' }),
  db,
  auth,
  lifecycle: createLifecycle(),
});

const request = (method: string, path: string, { cookie, body }: { cookie?: string; body?: unknown } = {}) =>
  app.request(path.startsWith('http') ? path : `${ORIGIN}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...(cookie === undefined ? {} : { Cookie: cookie }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const cookieOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith('better-auth.session_token='))
    ?.split(';')[0] ?? '';

async function guardian(email: string) {
  await request('POST', '/api/auth/sign-up/email', { body: { name: 'Parent', email, password: PASSWORD } });
  return cookieOf(await app.request(mail.linkTo(email, 'Confirmez')));
}

const signIn = async (email: string, password: string) => request('POST', '/api/auth/sign-in/email', { body: { email, password } });
const sessionUser = async (cookie: string) =>
  ((await (await request('GET', '/api/auth/get-session', { cookie })).json()) as { user: { id: string } } | null)?.user;

describe('password reset', () => {
  it('sends a link; the new password works, the old one no longer does, and every session ends', async () => {
    const email = 'oubli@example.com';
    const before = await guardian(email);
    expect(await sessionUser(before)).toBeDefined();

    expect((await request('POST', '/api/auth/request-password-reset', { body: { email } })).status).toBe(200);
    const token = new URL(mail.linkTo(email, 'Réinitialiser')).pathname.split('/').pop() ?? '';
    const reset = await request('POST', '/api/auth/reset-password', { body: { token, newPassword: 'un tout nouveau mot de passe' } });
    expect(reset.status).toBe(200);

    expect(await sessionUser(before)).toBeUndefined();
    expect((await signIn(email, PASSWORD)).status).toBe(401);
    expect((await signIn(email, 'un tout nouveau mot de passe')).status).toBe(200);

    const again = await request('POST', '/api/auth/reset-password', { body: { token, newPassword: 'encore un autre mot de passe' } });
    expect(again.status).toBe(400);
  });

  it("answers an unknown address and a student's address alike, sending nothing", async () => {
    const parent = await guardian('parent-eleve@example.com');
    const created = await request('POST', '/api/household/students', {
      cookie: parent,
      body: { name: 'Léa', level: 'cinquieme', birthMonth: '2014-03' },
    });
    const { id } = (await created.json()) as { id: string };
    const [student] = await db.select({ email: user.email }).from(user).where(eq(user.id, id));
    const sentBefore = mail.sent.length;

    for (const email of ['inconnu@example.com', student?.email ?? '']) {
      expect((await request('POST', '/api/auth/request-password-reset', { body: { email } })).status).toBe(200);
    }
    expect(mail.sent.length).toBe(sentBefore);
  });
});

describe('account deletion', () => {
  it("takes a sole guardian's household, students and their devices with it, once confirmed by email", async () => {
    const email = 'depart@example.com';
    const parent = await guardian(email);
    const created = await request('POST', '/api/household/students', {
      cookie: parent,
      body: { name: 'Léo', level: 'sixieme', birthMonth: '2015-09' },
    });
    const { id: studentId } = (await created.json()) as { id: string };
    const { code } = (await (await request('POST', `/api/household/students/${studentId}/pairing-code`, { cookie: parent })).json()) as {
      code: string;
    };
    const device = cookieOf(await request('POST', '/api/auth/device-pairing/redeem', { body: { code } }));
    const parentId = (await sessionUser(parent))?.id ?? '';
    const [member] = await db.select({ householdId: householdMember.householdId }).from(householdMember).where(eq(householdMember.userId, parentId));

    expect((await request('POST', '/api/auth/delete-user', { cookie: parent, body: {} })).status).toBe(200);
    expect(await sessionUser(parent)).toBeDefined();

    const confirm = await request('GET', mail.linkTo(email, 'suppression'), { cookie: parent });
    expect(confirm.status).toBeLessThan(400);
    expect(await db.select().from(user).where(eq(user.id, parentId))).toEqual([]);
    expect(await db.select().from(user).where(eq(user.id, studentId))).toEqual([]);
    expect(await db.select().from(session).where(eq(session.userId, studentId))).toEqual([]);
    expect(
      await db
        .select()
        .from(household)
        .where(eq(household.id, member?.householdId ?? '')),
    ).toEqual([]);
    expect(await sessionUser(device)).toBeUndefined();
    expect((await signIn(email, PASSWORD)).status).toBe(401);
  });

  it('deletes a guardian who never created a student', async () => {
    const email = 'seul@example.com';
    const parent = await guardian(email);
    await request('POST', '/api/auth/delete-user', { cookie: parent, body: {} });
    await request('GET', mail.linkTo(email, 'suppression'), { cookie: parent });
    expect(await db.select().from(user).where(eq(user.email, email))).toEqual([]);
  });
});
