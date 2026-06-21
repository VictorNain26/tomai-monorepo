/**
 * Test — Better Auth username plugin (autonomous child login)
 *
 * Verifies that a child account created via parentService.createChild
 * can sign in using username + password (not email).
 *
 * This is an integration test against the dev DB: no mocks on auth or DB.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';

// ============================================
// IMPORTS after the note: no mocks here
// ============================================

let auth: Awaited<typeof import('../lib/auth')>['auth'];
let parentService: InstanceType<typeof import('../services/parent.service')['ParentService']>;
let createdParentId: string;
let childUsername: string;
const childPassword = 'child-password-123!';

beforeAll(async () => {
  const authMod = await import('../lib/auth');
  auth = authMod.auth;

  const { ParentService } = await import('../services/parent.service');
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
  await parentService.createChild(createdParentId, {
    firstName: 'Test',
    lastName: 'Child',
    username: childUsername,
    password: childPassword,
    schoolLevel: 'sixieme',
  });
});

afterAll(async () => {
  // Best-effort cleanup — DB test isolation not guaranteed but avoids accumulation
  // We only have the child's username; sign in to get the id, then trust cascade delete
  if (createdParentId) {
    const { db } = await import('../db/connection');
    const { user } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');
    await db.delete(user).where(eq(user.id, createdParentId)).catch(() => null);
    // child is cascade-deleted via parent_child FK
  }
});

describe('username plugin — autonomous child login', () => {
  it('should expose signInUsername API method', async () => {
    const apiMethods = Object.keys(auth.api as Record<string, unknown>);
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
    expect(signedIn?.user?.username).toBe(childUsername);
  });
});
