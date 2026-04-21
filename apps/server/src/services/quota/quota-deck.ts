/**
 * Deck quota functions (flashcard generation limits)
 *
 * Extracted from quota-functions.ts to keep each file under the 400-line limit.
 */

import { db } from '../../db/connection.js';
import { userSubscriptions } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../../lib/observability.js';
import {
  QUOTA_CONFIG,
  needsDailyReset,
  needsMonthlyReset,
  type DeckQuotaResult,
  type DeckUsageResult,
} from './quota-config.js';
import { ensureUserSubscription } from './quota-functions.js';

export async function checkDeckQuota(userId: string): Promise<DeckQuotaResult> {
  void userId;
  return {
    allowed: true,
    decksRemainingToday: 999,
    decksRemainingThisMonth: 999,
    dailyLimit: 999,
    monthlyLimit: 999,
  };
}

export async function incrementDeckUsage(userId: string): Promise<DeckUsageResult> {
  const { dailyDecks, monthlyDecks } = QUOTA_CONFIG.premium;

  try {
    await ensureUserSubscription(userId);

    const [current] = await db
      .select({
        decksGeneratedToday: userSubscriptions.decksGeneratedToday,
        decksGeneratedThisMonth: userSubscriptions.decksGeneratedThisMonth,
        lastResetAt: userSubscriptions.lastResetAt,
        lastMonthlyResetAt: userSubscriptions.lastMonthlyResetAt,
      })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);

    if (!current) {
      throw new Error('Subscription not found');
    }

    const shouldDailyReset = needsDailyReset(current.lastResetAt);
    const baseDecksToday = shouldDailyReset ? 0 : current.decksGeneratedToday;
    const newDecksToday = baseDecksToday + 1;
    const decksRemainingToday = Math.max(0, dailyDecks - newDecksToday);

    const shouldMonthlyReset = needsMonthlyReset(current.lastMonthlyResetAt);
    const baseDecksMonth = shouldMonthlyReset ? 0 : current.decksGeneratedThisMonth;
    const newDecksMonth = baseDecksMonth + 1;
    const decksRemainingThisMonth = Math.max(0, monthlyDecks - newDecksMonth);

    await db
      .update(userSubscriptions)
      .set({
        decksGeneratedToday: newDecksToday,
        decksGeneratedThisMonth: newDecksMonth,
        ...(shouldDailyReset && { tokensUsedToday: 0, windowTokensUsed: 0, windowStartAt: new Date() }),
        lastResetAt: shouldDailyReset ? new Date() : current.lastResetAt,
        lastMonthlyResetAt: shouldMonthlyReset ? new Date() : current.lastMonthlyResetAt,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.userId, userId));

    logger.info('Deck usage incremented', {
      userId,
      newDecksToday,
      newDecksMonth,
      decksRemainingToday,
      decksRemainingThisMonth,
    });

    return {
      success: true,
      newDecksGeneratedToday: newDecksToday,
      newDecksGeneratedThisMonth: newDecksMonth,
      decksRemainingToday,
      decksRemainingThisMonth,
    };

  } catch (error) {
    logger.error('Error incrementing deck usage', {
      _error: error instanceof Error ? error.message : String(error),
      severity: 'medium' as const,
      userId,
    });

    return {
      success: false,
      newDecksGeneratedToday: 0,
      newDecksGeneratedThisMonth: 0,
      decksRemainingToday: 0,
      decksRemainingThisMonth: 0,
    };
  }
}
