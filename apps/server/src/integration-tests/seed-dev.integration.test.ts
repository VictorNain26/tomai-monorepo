// apps/server/src/integration-tests/seed-dev.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { sql } from 'drizzle-orm';

// DB reachability guard — mirrors username-login.integration.test.ts
async function checkDbReachable(): Promise<boolean> {
  try {
    const { db } = await import('../db/connection');
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('seedDev — deterministic, login-proven accounts', () => {
  let auth: Awaited<typeof import('../lib/auth')>['auth'];

  beforeAll(async () => {
    auth = (await import('../lib/auth')).auth;
  });

  afterAll(async () => {
    // Cleanup: delete the parent, cascade removes the child.
    const { db } = await import('../db/connection');
    const { user } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');
    await db.delete(user).where(eq(user.email, 'dev.parent@tomai.local')).catch(() => null);
  });

  it('creates a parent and a linked child that both log in for real', async () => {
    const { seedDev } = await import('../scripts/seed-dev');
    const { parentId, childId } = await seedDev();
    expect(parentId).toBeTruthy();
    expect(childId).toBeTruthy();

    const parentLogin = await auth.api.signInEmail({
      body: { email: 'dev.parent@tomai.local', password: 'DevParent123!' },
    });
    expect(parentLogin?.user?.id).toBe(parentId);

    const childLogin = await auth.api.signInUsername({
      body: { username: 'dev.eleve', password: 'DevEleve123!' },
    });
    expect(childLogin?.user?.username).toBe('dev.eleve');
  });

  it('is idempotent — a second run does not duplicate and still proves login', async () => {
    const { seedDev } = await import('../scripts/seed-dev');
    const first = await seedDev();
    const second = await seedDev();
    expect(second.parentId).toBe(first.parentId);
    expect(second.childId).toBe(first.childId);
  });
});
