/**
 * A guardian's passkey on a real database, through the HTTP API: its options bound to the public
 * origin, for a session opened minutes before; refused to a student; gone with the account. The browser's own ceremony runs in the web's end-to-end suite.
 */

import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import pino from 'pino';
import { createApp } from '../../app';
import { accountDeletion } from '../../modules/household';
import { testDatabase } from '../../testing/database';
import { httpClient, ORIGIN } from '../../testing/http';
import { memoryMailer } from '../../testing/mailer';
import { fakeMistral } from '../../testing/mistral';
import { createBackgroundTasks } from '../lifecycle/background';
import { createLifecycle } from '../lifecycle/shutdown';
import { createAuth } from './auth';
import { passkey, session } from './schema';

const { db } = await testDatabase();
const mistral = fakeMistral();
const mail = memoryMailer();
const auth = createAuth(
  db,
  { publicUrl: ORIGIN, authSecret: 'x'.repeat(32) },
  { mailer: mail.mailer, logger: pino({ level: 'silent' }), background: createBackgroundTasks().run, deleteUser: accountDeletion(db) },
);
const api = httpClient(
  createApp({
    config: { production: false, webDistDir: undefined, apiRateLimit: 1000, trustedProxyHops: 0 },
    logger: pino({ level: 'silent' }),
    db,
    ...mistral.deps(db, pino({ level: 'silent' })),
    auth,
    lifecycle: createLifecycle(),
    background: createBackgroundTasks().run,
  }),
  mail,
  db,
);

const registerOptions = (cookie: string) => api.request('GET', '/api/auth/passkey/generate-register-options', { cookie });

interface RegistrationOptions {
  rp: { id: string; name: string };
  user: { name: string };
  authenticatorSelection: { residentKey: string };
}

describe('passkey registration', () => {
  it("offers a guardian's fresh session a discoverable credential, for the public origin's host", async () => {
    const parent = await api.guardian('cle@example.com');
    const res = await registerOptions(parent);
    expect(res.status).toBe(200);
    const options = (await res.json()) as RegistrationOptions;
    expect(options.rp).toEqual({ id: new URL(ORIGIN).hostname, name: 'Tom' });
    expect(options.user.name).toBe('cle@example.com');
    expect(options.authenticatorSelection.residentKey).toBe('required');
  });

  // Their guardian pairs their device: a passkey would let them in on any other.
  it("refuses a student's paired device, by the household's guard on better-auth's routes", async () => {
    const parent = await api.guardian('parent-cle@example.com');
    const student = await api.student(parent);
    const device = await api.pair(parent, student.id);
    const options = await registerOptions(device);
    expect(options.status).toBe(302);
    expect(options.headers.get('location')).toBe('/connexion');
    expect((await api.request('POST', '/api/auth/passkey/verify-registration', { cookie: device, body: {} })).status).toBe(403);
  });

  it('refuses a session opened more than ten minutes ago', async () => {
    const parent = await api.guardian('ancienne@example.com');
    const parentId = (await api.sessionUser(parent))?.id ?? '';
    await db
      .update(session)
      .set({ createdAt: new Date(Date.now() - 11 * 60_000) })
      .where(eq(session.userId, parentId));
    expect((await registerOptions(parent)).status).toBe(403);
  });

  it('refuses without a session', async () => {
    expect((await api.request('GET', '/api/auth/passkey/generate-register-options')).status).toBe(401);
  });
});

describe('account deletion', () => {
  it("takes the guardian's passkeys with it", async () => {
    const parent = await api.guardian('cles-parties@example.com');
    const userId = (await api.sessionUser(parent))?.id ?? '';
    await db.insert(passkey).values({
      id: 'passkey-1',
      publicKey: 'key',
      userId,
      credentialID: 'credential-1',
      counter: 0,
      deviceType: 'multiDevice',
      backedUp: true,
    });
    expect((await api.request('POST', '/api/auth/delete-user', { cookie: parent, body: {} })).status).toBe(200);
    expect(await db.select().from(passkey).where(eq(passkey.userId, userId))).toEqual([]);
  });
});
