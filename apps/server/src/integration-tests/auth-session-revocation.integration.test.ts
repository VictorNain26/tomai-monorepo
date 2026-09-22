import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { eq, sql } from 'drizzle-orm';

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

describe.skipIf(!dbReachable)('requireAuth — a deleted account loses access immediately', () => {
  const email = `revocation_${Date.now()}@internal.tomai`;
  let cookie = '';

  beforeAll(async () => {
    const { auth } = await import('../lib/auth');
    const { headers } = await auth.api.signUpEmail({
      body: { email, password: 'revocation-password-123!', name: 'Revocation' },
      returnHeaders: true,
    });
    cookie = headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  });

  afterAll(async () => {
    const { db } = await import('../db/connection');
    const { user } = await import('../db/schema');
    await db.delete(user).where(eq(user.email, email)).catch(() => null);
  });

  it('authenticates the fresh session', async () => {
    const { requireAuth } = await import('../middleware/auth.middleware');
    const result = await requireAuth(new Headers({ cookie }));
    expect(result.success).toBe(true);
  });

  it('rejects the same cookies once the user row is deleted', async () => {
    const { db } = await import('../db/connection');
    const { user } = await import('../db/schema');
    const { requireAuth } = await import('../middleware/auth.middleware');
    await db.delete(user).where(eq(user.email, email));

    const result = await requireAuth(new Headers({ cookie }));

    expect(result.success).toBe(false);
    if (!result.success) expect(result.status).toBe(401);
  });
});
