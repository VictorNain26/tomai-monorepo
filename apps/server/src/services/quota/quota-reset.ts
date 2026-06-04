/**
 * Scheduled quota reset jobs
 *
 * Extracted from quota-functions.ts to keep each file under the 400-line limit.
 */

import { userSubscriptionsRepository } from '../../db/repositories/user-subscriptions.repository.js';
import { logger } from '../../lib/observability.js';

/**
 * Cron-style sweep: resets daily counters for users whose lastResetAt is older
 * than 20 hours. Run from a scheduler (not per-request).
 */
export async function resetAllDailyTokens(): Promise<{ resetCount: number }> {
  try {
    const resetCount = await userSubscriptionsRepository.resetExpiredDaily();

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
