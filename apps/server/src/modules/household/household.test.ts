/**
 * The household on a real database, through the HTTP API as the web will call it: the access
 * matrix first (anonymous, two guardians, a student of each), then what a guardian does.
 */

import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import pino from 'pino';
import { createApp } from '../../app';
import { createAuth } from '../../platform/auth/auth';
import { user } from '../../platform/auth/schema';
import { createLifecycle } from '../../platform/lifecycle/shutdown';
import { testDatabase } from '../../testing/database';
import { householdMember, studentProfile } from './schema';

const ORIGIN = 'http://localhost:3002';
const { db } = await testDatabase();
const auth = createAuth(db, { publicUrl: ORIGIN, authSecret: 'x'.repeat(32) });

interface Student {
  id: string;
  name: string;
  username: string;
  level: string;
  birthMonth: string;
}

// One app per block: each has its own rate-limit budget, and every request here shares one address.
function client() {
  const app = createApp({
    config: { production: false, webDistDir: undefined },
    logger: pino({ level: 'silent' }),
    db,
    auth,
    lifecycle: createLifecycle(),
  });

  const request = (method: string, path: string, { cookie, body }: { cookie?: string | undefined; body?: unknown } = {}) =>
    app.request(`${ORIGIN}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...(cookie === undefined ? {} : { Cookie: cookie }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  const cookieOf = (res: Response) =>
    res.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith('better-auth.session_token='))
      ?.split(';')[0] ?? '';

  return {
    request,
    async guardian(email: string) {
      const res = await request('POST', '/api/auth/sign-up/email', { body: { name: 'Parent', email, password: 'un mot de passe solide' } });
      expect(res.status).toBe(200);
      return cookieOf(res);
    },
    async student(cookie: string, overrides: Partial<Record<keyof Student | 'password', string>> = {}) {
      const res = await request('POST', '/api/household/students', {
        cookie,
        body: {
          name: 'Léa',
          username: `eleve_${crypto.randomUUID().slice(0, 8)}`,
          password: 'motdepasse',
          level: 'cinquieme',
          birthMonth: '2014-03',
          ...overrides,
        },
      });
      expect(res.status).toBe(201);
      return (await res.json()) as Student;
    },
    async signInStudent(username: string, password = 'motdepasse') {
      const res = await request('POST', '/api/auth/sign-in/username', { body: { username, password } });
      return { status: res.status, cookie: cookieOf(res) };
    },
    async sessionUser(cookie: string) {
      const res = await request('GET', '/api/auth/get-session', { cookie });
      return ((await res.json()) as { user: { id: string } } | null)?.user;
    },
  };
}

const householdOf = async (userId: string) => (await db.select().from(householdMember).where(eq(householdMember.userId, userId)))[0]?.householdId;

const matrix = client();
const guardianA = await matrix.guardian('a@example.com');
const guardianB = await matrix.guardian('b@example.com');
const studentOfA = await matrix.student(guardianA);
const studentOfB = await matrix.student(guardianB);
const asStudentA = (await matrix.signInStudent(studentOfA.username)).cookie;
const asStudentB = (await matrix.signInStudent(studentOfB.username)).cookie;

describe('access matrix', () => {
  const api = matrix;
  const target = `/api/household/students/${studentOfA.id}`;
  const routes = [
    { method: 'GET', path: '/api/household/students' },
    {
      method: 'POST',
      path: '/api/household/students',
      body: { name: 'X', username: 'intrus', password: 'motdepasse', level: 'sixieme', birthMonth: '2015-01' },
    },
    { method: 'PATCH', path: target, body: { name: 'Changé' } },
    { method: 'PUT', path: `${target}/password`, body: { password: 'autre mot de passe' } },
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
      it(`refuses ${method} ${path.replace(studentOfA.id, ':id')} to ${actor} with ${String(status)}`, async () => {
        const res = await api.request(method, path, { cookie, body });
        expect(res.status).toBe(status);
        expect(res.headers.get('content-type')).toStartWith('application/problem+json');
      });
    }
  }

  it('left the student of A untouched, still able to sign in', async () => {
    const [row] = await db.select({ name: user.name }).from(user).where(eq(user.id, studentOfA.id));
    expect(row?.name).toBe('Léa');
    expect((await api.signInStudent(studentOfA.username)).status).toBe(200);
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

describe('a guardian creates a student', () => {
  const api = creation;
  const guardian = creator;

  it('returns the student, who signs in by username whatever its case', async () => {
    const student = await api.student(guardian, { name: 'Léo', username: 'Leo.Martin', level: 'sixieme', birthMonth: '2015-09' });
    expect(student).toMatchObject({ name: 'Léo', username: 'Leo.Martin', level: 'sixieme', birthMonth: '2015-09' });

    const signIn = await api.signInStudent('leo.martin');
    expect(signIn.status).toBe(200);
    expect((await api.sessionUser(signIn.cookie))?.id).toBe(student.id);
  });

  it('gives the student a non-routable address and no family name', async () => {
    const [student] = await db.select({ email: user.email, name: user.name }).from(user).where(eq(user.username, 'leo.martin'));
    expect(student?.email).toEndWith('.invalid');
    expect(student?.name).toBe('Léo');
  });

  it('puts every student in one household with their guardian', async () => {
    const second = await api.student(guardian);
    const [first] = await db.select({ id: user.id }).from(user).where(eq(user.username, 'leo.martin'));
    const home = await householdOf(second.id);
    expect(home).toBeDefined();
    expect(await householdOf(first?.id ?? '')).toBe(home);
    expect(await householdOf((await api.sessionUser(guardian))?.id ?? '')).toBe(home);
  });

  it('creates one household when two first students arrive at once', async () => {
    const parent = await api.guardian('simultane@example.com');
    const [one, two] = await Promise.all([api.student(parent), api.student(parent)]);
    expect(await householdOf(one.id)).toBe(await householdOf(two.id));
  });

  it('refuses a username already taken, in any case, and writes nothing', async () => {
    const parent = await api.guardian('sans-foyer@example.com');
    const res = await api.request('POST', '/api/household/students', {
      cookie: parent,
      body: { name: 'Autre', username: 'LEO.MARTIN', password: 'motdepasse', level: 'sixieme', birthMonth: '2015-01' },
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe('USERNAME_TAKEN');
    const parentId = (await api.sessionUser(parent))?.id ?? '';
    expect(await householdOf(parentId)).toBeUndefined();
  });

  for (const [field, value] of [
    ['username', 'ab'],
    ['username', 'léa'],
    ['username', 'a'.repeat(31)],
    ['password', 'court'],
    ['level', 'seconde'],
    ['birthMonth', '2999-01'],
    ['birthMonth', '1990-01'],
    ['birthMonth', '2014-13'],
    ['birthMonth', '2014-3'],
    ['name', '   '],
  ] as const) {
    it(`refuses ${field} ${JSON.stringify(value)}`, async () => {
      const body = {
        name: 'Léa',
        username: `ok_${crypto.randomUUID().slice(0, 8)}`,
        password: 'motdepasse',
        level: 'cinquieme',
        birthMonth: '2014-03',
        [field]: value,
      };
      const res = await api.request('POST', '/api/household/students', { cookie: guardian, body });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { code: string; detail: string }).detail).toStartWith(`${field}:`);
    });
  }
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

  it("changes the password, which ends the student's sessions", async () => {
    const student = await api.student(guardian);
    const before = await api.signInStudent(student.username);
    expect(await api.sessionUser(before.cookie)).toBeDefined();

    const res = await api.request('PUT', `/api/household/students/${student.id}/password`, {
      cookie: guardian,
      body: { password: 'nouveau mot de passe' },
    });
    expect(res.status).toBe(204);
    expect(await api.sessionUser(before.cookie)).toBeUndefined();
    expect((await api.signInStudent(student.username)).status).toBe(401);
    expect((await api.signInStudent(student.username, 'nouveau mot de passe')).status).toBe(200);
  });

  it('deletes the student, their session, membership and profile; a second delete is not found', async () => {
    const student = await api.student(guardian);
    const session = await api.signInStudent(student.username);

    const res = await api.request('DELETE', `/api/household/students/${student.id}`, { cookie: guardian });
    expect(res.status).toBe(204);
    expect(await api.sessionUser(session.cookie)).toBeUndefined();
    expect((await api.signInStudent(student.username)).status).toBe(401);
    expect(await householdOf(student.id)).toBeUndefined();
    expect(await db.select().from(studentProfile).where(eq(studentProfile.userId, student.id))).toEqual([]);

    const again = await api.request('DELETE', `/api/household/students/${student.id}`, { cookie: guardian });
    expect(again.status).toBe(404);
  });
});

const own = client();
const ownStudent = await own.student(await own.guardian('regles@example.com'));
const { cookie: ownCookie } = await own.signInStudent(ownStudent.username);

describe("a student, through better-auth's own routes", () => {
  const api = own;
  const student = ownStudent;
  const cookie = ownCookie;

  it('cannot change their username', async () => {
    await api.request('POST', '/api/auth/update-user', { cookie, body: { username: 'autre_nom' } });
    const [row] = await db.select({ username: user.username }).from(user).where(eq(user.id, student.id));
    expect(row?.username).toBe(student.username.toLowerCase());
  });

  it('cannot change their email nor delete their account', async () => {
    const change = await api.request('POST', '/api/auth/change-email', { cookie, body: { newEmail: 'eleve@example.com' } });
    const remove = await api.request('POST', '/api/auth/delete-user', { cookie, body: {} });
    expect(change.ok).toBe(false);
    expect(remove.ok).toBe(false);
    const [row] = await db.select({ email: user.email }).from(user).where(eq(user.id, student.id));
    expect(row?.email).toEndWith('.invalid');
  });
});
