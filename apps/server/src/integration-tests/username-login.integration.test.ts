/**
 * Integration test — Better Auth username plugin (autonomous child login)
 *
 * Verifies that a child account created via parentService.createChild
 * can sign in using username + password (not email).
 *
 * Requires a live DB connection. Skips cleanly when DB is absent (CI without DB).
 *
 * No mocks on auth or DB — full real path.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { checkDbReachable } from './_helpers/db';

// ============================================================
// DB reachability check — evaluated before any describe/it
// ============================================================

const dbReachable = await checkDbReachable();

if (!dbReachable) {
  console.warn('[username-login.integration] DB unreachable — all tests will be skipped');
}

// ============================================================
// Test state
// ============================================================

let auth: Awaited<typeof import('../platform/auth/auth')>['auth'];
let parentService: InstanceType<(typeof import('../modules/family/parent.service'))['ParentService']>;
let createdParentId: string;
let createdChildId: string;
let childUsername: string;
const childPassword = 'child-password-123!';

beforeAll(async () => {
  if (!dbReachable) return;

  const authMod = await import('../platform/auth/auth');
  auth = authMod.auth;

  const { ParentService } = await import('../modules/family/parent.service');
  parentService = new ParentService();

  // Create a parent account to own the child
  const suffix = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const parent = await auth.api.signUpEmail({
    body: {
      email: `test_parent_${suffix}@internal.tomai`,
      password: 'parent-password-456!',
      name: 'Test Parent',
    },
  });
  createdParentId = parent.user.id;

  // Create the child via parentService (mirrors production flow)
  childUsername = `kid_${suffix}`;
  const child = await parentService.createChild(createdParentId, {
    firstName: 'Test',
    lastName: 'Child',
    username: childUsername,
    password: childPassword,
    schoolLevel: 'sixieme',
    dateOfBirth: '2014-03-01',
  });
  createdChildId = child.id;
});

afterAll(async () => {
  if (!dbReachable) return;
  // Best-effort cleanup. Deleting the parent cascades only to the parent_child link, not to the child account.
  const { db } = await import('../db/connection');
  const { user } = await import('../db/schema');
  const { inArray } = await import('drizzle-orm');
  await db
    .delete(user)
    .where(inArray(user.id, [createdParentId, createdChildId].filter(Boolean)))
    .catch(() => null);
});

// ============================================================
// Suite
// ============================================================

describe.skipIf(!dbReachable)('username plugin — autonomous child login', () => {
  it('should expose signInUsername API method', async () => {
    const apiMethods = Object.keys(auth.api);
    expect(apiMethods).toContain('signInUsername');
  });

  it('should sign in a child account with username + password', async () => {
    const signedIn = await auth.api.signInUsername({
      body: {
        username: childUsername,
        password: childPassword,
      },
    });

    expect(signedIn).toBeTruthy();
    expect(signedIn.user.username).toBe(childUsername);
  });

  it('should reject sign-in with correct username but wrong password', async () => {
    let threw = false;
    try {
      await auth.api.signInUsername({
        body: {
          username: childUsername,
          password: 'wrong-password-!',
        },
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it('signs in with the new password once setPassword replaced it', async () => {
    const { setPassword } = await import('../modules/auth/index');
    const newPassword = 'new-child-password-789!';

    await setPassword(createdChildId, newPassword);

    const signedIn = await auth.api.signInUsername({ body: { username: childUsername, password: newPassword } });
    expect(signedIn.user.username).toBe(childUsername);
    const oldPassword = await auth.api.signInUsername({ body: { username: childUsername, password: childPassword } }).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(oldPassword).toBeInstanceOf(Error);
  });
});

describe.skipIf(!dbReachable)('role and level, written by the server only', () => {
  it('a public sign-up gets the parent role whatever it sends, and cannot set a level', async () => {
    const suffix = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const body = { email: `test_role_${suffix}@internal.tomai`, password: 'parent-password-456!', name: 'Test' };
    const signedUp = await auth.api.signUpEmail({ body: { ...body, role: 'student' } as typeof body });
    const { usersRepository } = await import('../modules/auth/index');
    expect((await usersRepository.findById(signedUp.user.id))?.role).toBe('parent');
    await usersRepository.deleteById(signedUp.user.id);

    const withLevel = await auth.api.signUpEmail({ body: { ...body, email: `level_${body.email}`, schoolLevel: 'seconde' } as typeof body }).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(withLevel).toBeInstanceOf(Error);
  });

  it('a child cannot change its own role or level through update-user', async () => {
    const { setPassword } = await import('../modules/auth/index');
    await setPassword(createdChildId, 'role-test-password-1!');
    const { headers } = await auth.api.signInUsername({ body: { username: childUsername, password: 'role-test-password-1!' }, returnHeaders: true });
    const cookie = headers
      .getSetCookie()
      .map((line) => line.split(';')[0])
      .join('; ');
    for (const change of [{ role: 'parent' }, { schoolLevel: 'troisieme' }]) {
      const refused = await auth.api.updateUser({ body: change as { name?: string }, headers: { cookie } }).then(
        () => undefined,
        (error: unknown) => error,
      );
      expect(refused).toBeInstanceOf(Error);
    }
    const { usersRepository } = await import('../modules/auth/index');
    const child = await usersRepository.findById(createdChildId);
    expect(child?.role).toBe('student');
    expect(child?.schoolLevel).toBe('sixieme');
  });
});
