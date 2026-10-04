import { sql } from 'drizzle-orm';

/**
 * Whether the test database answers. Locally, an unreachable database skips the integration
 * tests; in CI, where a postgres service is there to run them, it fails them instead of
 * letting them pass skipped.
 */
export async function checkDbReachable(): Promise<boolean> {
  try {
    const { db } = await import('../../db/connection');
    await db.execute(sql`SELECT 1`);
    return true;
  } catch (error) {
    if (Bun.env['CI']) throw new Error('the integration database is unreachable in CI', { cause: error });
    return false;
  }
}
