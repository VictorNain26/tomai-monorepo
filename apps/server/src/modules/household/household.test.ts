/**
 * The household on a real database, through the HTTP API as the web will call it: the access
 * matrix first (anonymous, two guardians, a student of each), then what a guardian does, the
 * pairing of a student's device, and what a student may do with better-auth's own routes.
 */

import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import pino from 'pino';
import { createBackgroundTasks } from '../../platform/lifecycle/background';
import { createApp } from '../../app';
import { createAuth } from '../../platform/auth/auth';
import { PAIRING_PREFIX } from '../../platform/auth/pairing';
import { account, session, user, verification } from '../../platform/auth/schema';
import { createLifecycle } from '../../platform/lifecycle/shutdown';
import { testDatabase } from '../../testing/database';
import { fakeMistral } from '../../testing/mistral';
import { httpClient, ORIGIN, type Student } from '../../testing/http';
import { memoryMailer } from '../../testing/mailer';
import { accountDeletion } from './index';
import { householdMember, studentProfile } from './schema';

const { db } = await testDatabase();
const mistral = fakeMistral();
const mail = memoryMailer();
const auth = createAuth(
  db,
  { publicUrl: ORIGIN, authSecret: 'x'.repeat(32) },
  { mailer: mail.mailer, logger: pino({ level: 'silent' }), background: createBackgroundTasks().run, deleteUser: accountDeletion(db) },
);

// One app per block: each has its own rate-limit budget, and every request here shares one address.
function client() {
  return httpClient(
    createApp({
      config: { production: false, webDistDir: undefined },
      logger: pino({ level: 'silent' }),
      db,
      ...mistral.deps(db, pino({ level: 'silent' })),
      auth,
      lifecycle: createLifecycle(),
    }),
    mail,
  );
}

const householdOf = async (userId: string) => (await db.select().from(householdMember).where(eq(householdMember.userId, userId)))[0]?.householdId;

const matrix = client();
const guardianA = await matrix.guardian('a@example.com');
const guardianB = await matrix.guardian('b@example.com');
const studentOfA = await matrix.student(guardianA);
const studentOfB = await matrix.student(guardianB);
const asStudentA = await matrix.pair(guardianA, studentOfA.id);
const asStudentB = await matrix.pair(guardianB, studentOfB.id);
const [deviceOfA] = await matrix.devices(guardianA, studentOfA.id);

describe('access matrix', () => {
  const api = matrix;
  const target = `/api/household/students/${studentOfA.id}`;
  const routes = [
    { method: 'GET', path: '/api/household/students' },
    { method: 'POST', path: '/api/household/students', body: { name: 'X', level: 'sixieme', birthMonth: '2015-01' } },
    { method: 'PATCH', path: target, body: { name: 'Changé' } },
    { method: 'POST', path: `${target}/pairing-code` },
    { method: 'GET', path: `${target}/devices` },
    { method: 'DELETE', path: `${target}/devices/${deviceOfA?.id ?? ''}` },
    { method: 'DELETE', path: target },
  ];
  const refused = [
    { actor: 'anonymous', cookie: undefined, status: 401, routes },
    { actor: 'the student', cookie: asStudentA, status: 403, routes },
    { actor: 'a student of another household', cookie: asStudentB, status: 403, routes },
    { actor: 'the guardian of another household', cookie: guardianB, status: 404, routes: routes.slice(2) },
  ];

  for (const { actor, cookie, status, routes: denied } of refused) {
    for (const { method, path, body } of denied) {
      it(`refuses ${method} ${path.replace(studentOfA.id, ':id').replace(deviceOfA?.id ?? '-', ':device')} to ${actor} with ${String(status)}`, async () => {
        const res = await api.request(method, path, { cookie, body });
        expect(res.status).toBe(status);
        expect(res.headers.get('content-type')).toStartWith('application/problem+json');
      });
    }
  }

  it('left the student of A untouched, their device still signed in', async () => {
    const [row] = await db.select({ name: user.name }).from(user).where(eq(user.id, studentOfA.id));
    expect(row?.name).toBe('Léa');
    expect((await api.sessionUser(asStudentA))?.id).toBe(studentOfA.id);
  });

  it('lists to each guardian only the students of their household', async () => {
    const listA = (await (await api.request('GET', '/api/household/students', { cookie: guardianA })).json()) as Student[];
    const listB = (await (await api.request('GET', '/api/household/students', { cookie: guardianB })).json()) as Student[];
    expect(listA.map((s) => s.id)).toEqual([studentOfA.id]);
    expect(listB.map((s) => s.id)).toEqual([studentOfB.id]);
  });
});

const creation = client();
const creator = await creation.guardian('createur@example.com');
const leo = await creation.student(creator, { name: 'Léo', level: 'sixieme', birthMonth: '2015-09' });

describe('a guardian creates a student', () => {
  const api = creation;
  const guardian = creator;

  it('returns the student: a first name, a level and a month of birth', () => {
    expect(leo).toMatchObject({ name: 'Léo', level: 'sixieme', birthMonth: '2015-09' });
  });

  it('gives the student no credential: a non-routable address, no password', async () => {
    const [row] = await db.select({ email: user.email }).from(user).where(eq(user.id, leo.id));
    expect(row?.email).toEndWith('.invalid');
    expect(await db.select().from(account).where(eq(account.userId, leo.id))).toEqual([]);
  });

  it('puts every student in one household with their guardian', async () => {
    const second = await api.student(guardian);
    const home = await householdOf(second.id);
    expect(home).toBeDefined();
    expect(await householdOf(leo.id)).toBe(home);
    expect(await householdOf((await api.sessionUser(guardian))?.id ?? '')).toBe(home);
  });

  it('creates one household when two first students arrive at once', async () => {
    const parent = await api.guardian('simultane@example.com');
    const [one, two] = await Promise.all([api.student(parent), api.student(parent)]);
    expect(await householdOf(one.id)).toBe(await householdOf(two.id));
  });

  for (const [field, value] of [
    ['level', 'seconde'],
    ['birthMonth', '2999-01'],
    ['birthMonth', new Date().toISOString().slice(0, 7)],
    ['birthMonth', `${String(new Date().getUTCFullYear() - 3)}-01`],
    ['birthMonth', '1990-01'],
    ['birthMonth', '2014-13'],
    ['birthMonth', '2014-3'],
    ['name', '   '],
    ['name', 'a'.repeat(51)],
  ] as const) {
    it(`refuses ${field} ${JSON.stringify(value).slice(0, 20)}`, async () => {
      const body = { name: 'Léa', level: 'cinquieme', birthMonth: '2014-03', [field]: value };
      const res = await api.request('POST', '/api/household/students', { cookie: guardian, body });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { detail: string }).detail).toStartWith(`${field}:`);
    });
  }
});

const pairing = client();
const pairingGuardian = await pairing.guardian('jumelage@example.com');

describe("pairing a student's device", () => {
  const api = pairing;
  const guardian = pairingGuardian;

  it('opens a session for the student on the device that sends the code', async () => {
    const student = await api.student(guardian);
    const device = await api.pair(guardian, student.id);
    expect((await api.sessionUser(device))?.id).toBe(student.id);
  });

  it('serves a code once', async () => {
    const student = await api.student(guardian);
    const code = await api.pairingCode(guardian, student.id);
    expect((await api.redeem(code)).status).toBe(200);
    expect((await api.redeem(code)).status).toBe(400);
  });

  it('accepts the code as a person types it: lowercase, with a dash or spaces', async () => {
    const student = await api.student(guardian);
    const code = await api.pairingCode(guardian, student.id);
    const typed = ` ${code.slice(0, 4).toLowerCase()}-${code.slice(4).toLowerCase()} `;
    expect((await api.redeem(typed)).status).toBe(200);
  });

  it('refuses an unknown code and an expired one', async () => {
    expect((await api.redeem('AAAA-AAAA')).status).toBe(400);
    const student = await api.student(guardian);
    const code = await api.pairingCode(guardian, student.id);
    await db
      .update(verification)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(verification.value, student.id));
    expect((await api.redeem(code)).status).toBe(400);
  });

  it('stores the code hashed, never in clear', async () => {
    const student = await api.student(guardian);
    const code = await api.pairingCode(guardian, student.id);
    const [row] = await db.select({ identifier: verification.identifier }).from(verification).where(eq(verification.value, student.id));
    expect(row?.identifier).toBeDefined();
    expect(row?.identifier).not.toContain(code);
    expect(row?.identifier).not.toStartWith(PAIRING_PREFIX);
  });

  it("shows the guardian the student's devices, without their address, and disconnects one", async () => {
    const student = await api.student(guardian);
    const device = await api.pair(guardian, student.id);
    const devices = await api.devices(guardian, student.id);
    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({ userAgent: 'test-device' });
    expect(Object.keys(devices[0] ?? {}).sort()).toEqual(['id', 'pairedAt', 'userAgent']);

    const res = await api.request('DELETE', `/api/household/students/${student.id}/devices/${devices[0]?.id ?? ''}`, { cookie: guardian });
    expect(res.status).toBe(204);
    expect(await api.sessionUser(device)).toBeUndefined();
    expect(await api.devices(guardian, student.id)).toEqual([]);
  });

  it('no longer lists a device whose session has expired', async () => {
    const student = await api.student(guardian);
    await api.pair(guardian, student.id);
    await db
      .update(session)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(session.userId, student.id));
    expect(await api.devices(guardian, student.id)).toEqual([]);
  });

  it('closes the session the device already held, so none stays behind', async () => {
    const student = await api.student(guardian);
    const parent = await api.guardian('tablette@example.com');
    const parentId = (await api.sessionUser(parent))?.id ?? '';
    const code = await api.pairingCode(guardian, student.id);

    const res = await api.request('POST', '/api/auth/device-pairing/redeem', { cookie: parent, body: { code } });
    expect(res.status).toBe(200);
    expect(await db.select().from(session).where(eq(session.userId, parentId))).toEqual([]);
  });

  it('lets the student list their own devices', async () => {
    const student = await api.student(guardian);
    const device = await api.pair(guardian, student.id);
    const res = await api.request('GET', '/api/auth/list-sessions', { cookie: device });
    expect(res.status).toBe(200);
    expect(((await res.json()) as unknown[]).length).toBe(1);
  });
});

const management = client();
const manager = await management.guardian('gestion@example.com');

describe('a guardian manages a student', () => {
  const api = management;
  const guardian = manager;

  it('changes the name and the level', async () => {
    const student = await api.student(guardian);
    const res = await api.request('PATCH', `/api/household/students/${student.id}`, {
      cookie: guardian,
      body: { name: 'Léana', level: 'quatrieme' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: student.id, name: 'Léana', level: 'quatrieme', birthMonth: student.birthMonth });
  });

  it('refuses an empty change', async () => {
    const student = await api.student(guardian);
    const res = await api.request('PATCH', `/api/household/students/${student.id}`, { cookie: guardian, body: {} });
    expect(res.status).toBe(400);
  });

  it('deletes the student, their devices, membership and profile; a second delete is not found', async () => {
    const student = await api.student(guardian);
    const device = await api.pair(guardian, student.id);

    const res = await api.request('DELETE', `/api/household/students/${student.id}`, { cookie: guardian });
    expect(res.status).toBe(204);
    expect(await api.sessionUser(device)).toBeUndefined();
    expect(await householdOf(student.id)).toBeUndefined();
    expect(await db.select().from(studentProfile).where(eq(studentProfile.userId, student.id))).toEqual([]);

    const again = await api.request('DELETE', `/api/household/students/${student.id}`, { cookie: guardian });
    expect(again.status).toBe(404);
  });
});

const own = client();
const ownGuardian = await own.guardian('regles@example.com');
const ownStudent = await own.student(ownGuardian);
const ownCookie = await own.pair(ownGuardian, ownStudent.id);

describe("a student, through better-auth's own routes", () => {
  const api = own;
  const student = ownStudent;
  const cookie = ownCookie;

  it('cannot change their name, set a password, change their email nor delete their account', async () => {
    for (const [path, body] of [
      ['/api/auth/update-user', { name: 'Autre' }],
      ['/api/auth/set-password', { newPassword: 'un mot de passe à moi' }],
      ['/api/auth/change-email', { newEmail: 'eleve@example.com' }],
      ['/api/auth/delete-user', {}],
    ] as const) {
      expect((await api.request('POST', path, { cookie, body })).status).toBe(403);
    }
    const [row] = await db.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, student.id));
    expect(row?.name).toBe(student.name);
    expect(row?.email).toEndWith('.invalid');
    expect(await db.select().from(account).where(eq(account.userId, student.id))).toEqual([]);
  });

  it('still reads their session and signs out', async () => {
    const fresh = await api.pair(ownGuardian, student.id);
    expect((await api.sessionUser(fresh))?.id).toBe(student.id);
    expect((await api.request('POST', '/api/auth/sign-out', { cookie: fresh, body: {} })).status).toBe(200);
    expect(await api.sessionUser(fresh)).toBeUndefined();
  });

  it('leaves a guardian free to change their own name', async () => {
    const parent = await api.guardian('libre@example.com');
    const res = await api.request('POST', '/api/auth/update-user', { cookie: parent, body: { name: 'Victor' } });
    expect(res.status).toBe(200);
  });
});
