/**
 * A guardian's account on a real database, through the HTTP API: the password reset, which ends
 * every session, and the deletion given the password, which takes a sole guardian's household and
 * students with it. A student's `.invalid` address is never sent to.
 */

import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import pino from 'pino';
import { createBackgroundTasks } from '../lifecycle/background';
import { createApp } from '../../app';
import { accountDeletion } from '../../modules/household';
import { household, householdMember } from '../../modules/household/schema';
import { testDatabase } from '../../testing/database';
import { ORIGIN } from '../../testing/http';
import { fakeMistral } from '../../testing/mistral';
import { memoryMailer } from '../../testing/mailer';
import { createLifecycle } from '../lifecycle/shutdown';
import { createAuth } from './auth';
import { invitationIdentifier, invite } from './invitation';
import { session, user, verification } from './schema';

const PASSWORD = 'un mot de passe solide';
const { db } = await testDatabase();
const mistral = fakeMistral();
const mail = memoryMailer();
const auth = createAuth(
  db,
  { publicUrl: ORIGIN, authSecret: 'x'.repeat(32) },
  { mailer: mail.mailer, logger: pino({ level: 'silent' }), background: createBackgroundTasks().run, deleteUser: accountDeletion(db) },
);
const app = createApp({
  config: { production: false, webDistDir: undefined, apiRateLimit: 100 },
  logger: pino({ level: 'silent' }),
  db,
  ...mistral.deps(db, pino({ level: 'silent' })),
  auth,
  lifecycle: createLifecycle(),
  background: createBackgroundTasks().run,
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

const signUp = async (email: string) => request('POST', '/api/auth/sign-up/email', { body: { name: 'Parent', email, password: PASSWORD } });

async function guardian(email: string) {
  await invite(db, email);
  await signUp(email);
  return cookieOf(await app.request(mail.linkTo(email, 'Confirmez')));
}

const signIn = async (email: string, password: string) => request('POST', '/api/auth/sign-in/email', { body: { email, password } });
const sessionUser = async (cookie: string) =>
  ((await (await request('GET', '/api/auth/get-session', { cookie })).json()) as { user: { id: string } } | null)?.user;

describe('invitation', () => {
  const invitations = (email: string) =>
    db
      .select()
      .from(verification)
      .where(eq(verification.identifier, invitationIdentifier(email)));
  const refused = async (res: Response) => {
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe('INVITATION_REQUIRED');
  };

  it('refuses an address without one, creating and sending nothing', async () => {
    const sentBefore = mail.sent.length;
    await refused(await signUp('pas-invite@example.com'));
    expect(await db.select().from(user).where(eq(user.email, 'pas-invite@example.com'))).toEqual([]);
    expect(mail.sent.length).toBe(sentBefore);
  });

  it('opens one sign-up, whatever the case of the address, and is spent by it', async () => {
    await invite(db, ' Invitee@Example.com ');
    expect((await signUp('invitee@example.com')).status).toBe(200);
    expect(await invitations('invitee@example.com')).toEqual([]);
  });

  it('is kept by a sign-up that fails', async () => {
    await invite(db, 'trop-court@example.com');
    const short = await request('POST', '/api/auth/sign-up/email', { body: { name: 'Parent', email: 'trop-court@example.com', password: 'court' } });
    expect(short.status).toBe(400);
    expect((await signUp('trop-court@example.com')).status).toBe(200);
  });

  it("refuses an account's address without one as any other: the answer tells no account", async () => {
    await guardian('deja@example.com');
    await refused(await signUp('deja@example.com'));
  });

  it('refuses an expired one', async () => {
    await invite(db, 'en-retard@example.com');
    await db
      .update(verification)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(verification.identifier, invitationIdentifier('en-retard@example.com')));
    await refused(await signUp('en-retard@example.com'));
  });

  it('is replaced when the address is invited again', async () => {
    await invite(db, 'deux-fois@example.com');
    const { expiresAt } = await invite(db, 'deux-fois@example.com');
    expect((await invitations('deux-fois@example.com')).map((row) => row.expiresAt)).toEqual([expiresAt]);
  });
});

describe('the error page', () => {
  it("is the web's, not better-auth's own, whose inline style the CSP blocks", async () => {
    const res = await request('GET', '/api/auth/error?error=boom');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`${ORIGIN}/erreur-connexion?error=boom`);
  });
});

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

describe('email verification', () => {
  it('sends the link again when the guardian tries to sign in before confirming', async () => {
    const email = 'distrait@example.com';
    await invite(db, email);
    await signUp(email);
    const links = () => mail.sent.filter((each) => each.to === email && each.subject.includes('Confirmez')).length;
    expect(links()).toBe(1);

    expect((await signIn(email, PASSWORD)).status).toBe(403);
    expect(links()).toBe(2);
    expect((await app.request(mail.linkTo(email, 'Confirmez'))).status).toBeLessThan(400);
    expect((await signIn(email, PASSWORD)).status).toBe(200);
  });
});

describe('account deletion', () => {
  it("takes a sole guardian's household, students and their devices with it, given the password", async () => {
    const email = 'depart@example.com';
    const parent = await guardian(email);
    const created = await request('POST', '/api/household/students', {
      cookie: parent,
      body: { name: 'Léo', level: 'sixieme', birthMonth: '2015-09' },
    });
    const { id: studentId } = (await created.json()) as { id: string };
    const pairing = await request('POST', `/api/household/students/${studentId}/pairing-code`, { cookie: parent });
    const { code } = (await pairing.json()) as { code: string };
    const device = cookieOf(await request('POST', '/api/auth/device-pairing/redeem', { body: { code } }));
    const parentId = (await sessionUser(parent))?.id ?? '';
    const [member] = await db.select({ householdId: householdMember.householdId }).from(householdMember).where(eq(householdMember.userId, parentId));

    expect((await request('POST', '/api/auth/delete-user', { cookie: parent, body: { password: PASSWORD } })).status).toBe(200);
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
    expect(await sessionUser(parent)).toBeUndefined();
    expect((await signIn(email, PASSWORD)).status).toBe(401);
    expect(mail.sent.some((each) => each.to === email && each.subject.includes('supprimé'))).toBe(true);
  });

  it('refuses a deletion without the password, or with a wrong one, and keeps the account', async () => {
    const email = 'prudent@example.com';
    const parent = await guardian(email);
    expect((await request('POST', '/api/auth/delete-user', { cookie: parent, body: {} })).status).toBe(400);
    expect((await request('POST', '/api/auth/delete-user', { cookie: parent, body: { password: 'pas le bon' } })).status).toBe(400);
    expect(await db.select({ id: user.id }).from(user).where(eq(user.email, email))).toHaveLength(1);
    expect(await sessionUser(parent)).toBeDefined();
  });

  it('deletes a guardian who never created a student', async () => {
    const email = 'seul@example.com';
    const parent = await guardian(email);
    expect((await request('POST', '/api/auth/delete-user', { cookie: parent, body: { password: PASSWORD } })).status).toBe(200);
    expect(await db.select().from(user).where(eq(user.email, email))).toEqual([]);
  });
});
