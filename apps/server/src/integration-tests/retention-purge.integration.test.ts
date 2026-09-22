import { describe, it, expect, afterAll } from 'bun:test';
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

describe.skipIf(!dbReachable)('purgeExpiredData — counts from a real postgres-js result', () => {
  const userId = `retention_${Date.now()}`;

  afterAll(async () => {
    const { db } = await import('../db/connection');
    const { user } = await import('../db/schema');
    await db.delete(user).where(eq(user.id, userId)).catch(() => null);
  });

  it('reports the expired subject profiles it deleted', async () => {
    const { db } = await import('../db/connection');
    const { user, studentSubjectProfiles } = await import('../db/schema');
    const { purgeExpiredData } = await import('../services/retention-purge.service');

    await db.insert(user).values({ id: userId, email: `${userId}@internal.tomai` });
    await db.insert(studentSubjectProfiles).values({
      userId,
      subject: 'mathematiques',
      ttlUntil: new Date(Date.now() - 60_000),
    });

    const result = await purgeExpiredData();

    expect(result.profilesDeleted).toBeGreaterThanOrEqual(1);
    const remaining = await db
      .select({ id: studentSubjectProfiles.id })
      .from(studentSubjectProfiles)
      .where(eq(studentSubjectProfiles.userId, userId));
    expect(remaining).toHaveLength(0);
  });
});
