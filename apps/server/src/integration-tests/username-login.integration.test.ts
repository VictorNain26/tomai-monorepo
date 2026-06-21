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
import { sql } from 'drizzle-orm';

// ============================================================
// DB reachability check — evaluated before any describe/it
// ============================================================

async function checkDbReachable(): Promise<boolean> {
  try {
    const { db } = await import('../db/connection');
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

if (!dbReachable) {
  console.warn('[username-login.integration] DB unreachable — all tests will be skipped');
}

// ============================================================
// Test state
// ============================================================

let auth: Awaited<typeof import('../lib/auth')>['auth'];
let parentService: InstanceType<typeof import('../services/parent.service')['ParentService']>;
let createdParentId: string;
let childUsername: string;
const childPassword = 'child-password-123!';

beforeAll(async () => {
  if (!dbReachable) return;

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
  if (!dbReachable) return;
  // Best-effort cleanup — cascade delete handles child via parent_child FK
  if (createdParentId) {
    const { db } = await import('../db/connection');
    const { user } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');
    await db.delete(user).where(eq(user.id, createdParentId)).catch(() => null);
  }
});

// ============================================================
// Suite
// ============================================================

describe.skipIf(!dbReachable)('username plugin — autonomous child login', () => {
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
});
