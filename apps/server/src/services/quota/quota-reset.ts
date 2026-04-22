/**
 * Scheduled quota reset jobs
 *
 * Extracted from quota-functions.ts to keep each file under the 400-line limit.
 */

import { db } from '../../db/connection.js';
import { userSubscriptions } from '../../db/schema.js';
import { sql } from 'drizzle-orm';
import { logger } from '../../lib/observability.js';

/**
 * Cron-style sweep: resets daily counters for users whose lastResetAt is older
 * than 20 hours. Run from a scheduler (not per-request).
 */
export async function resetAllDailyTokens(): Promise<{ resetCount: number }> {
  try {
    const result = await db
      .update(userSubscriptions)
      .set({
        tokensUsedToday: 0,
        decksGeneratedToday: 0,
        lastResetAt: new Date(),
        updatedAt: new Date(),
      })
      .where(sql`${userSubscriptions.lastResetAt} < NOW() - INTERVAL '20 hours'`);

    const resetCount = (result as unknown as { rowCount?: number }).rowCount ?? 0;

    if (resetCount > 0) {
      logger.info('Daily quota reset completed', {
        resetCount,
        resetTime: new Date().toISOString(),
      });
    }

    return { resetCount };

  } catch (error) {
    logger.error('Error during daily token reset', {
      _error: error instanceof Error ? error.message : String(error),
      severity: 'high' as const,
    });

    return { resetCount: 0 };
  }
}
