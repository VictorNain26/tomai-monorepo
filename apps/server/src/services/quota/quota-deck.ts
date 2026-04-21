/**
 * Deck quota functions (flashcard generation limits)
 *
 * Extracted from quota-functions.ts to keep each file under the 400-line limit.
 */

import { db } from '../../db/connection.js';
import { userSubscriptions } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../../lib/observability.js';
import { appConfig } from '../../config/app.config.js';
import {
  QUOTA_CONFIG,
  needsDailyReset,
  needsMonthlyReset,
  type DeckQuotaResult,
  type DeckUsageResult,
} from './quota-config.js';
import { ensureUserSubscription } from './quota-functions.js';

export async function checkDeckQuota(userId: string): Promise<DeckQuotaResult> {
  // Feature flag: unlimited access when enforcement is off. Counters still
  // increment in DB for analytics.
  if (!appConfig.features.quotaEnforcementEnabled) {
    return {
      allowed: true,
      decksRemainingToday: 999,
      decksRemainingThisMonth: 999,
      dailyLimit: 999,
      monthlyLimit: 999,
    };
  }
  return checkDeckQuotaReal(userId);
}

async function checkDeckQuotaReal(userId: string): Promise<DeckQuotaResult> {
  const { dailyDecks, monthlyDecks } = QUOTA_CONFIG.premium;

  try {
    const [row] = await db
      .select({
        decksGeneratedToday: userSubscriptions.decksGeneratedToday,
        decksGeneratedThisMonth: userSubscriptions.decksGeneratedThisMonth,
        lastResetAt: userSubscriptions.lastResetAt,
        lastMonthlyResetAt: userSubscriptions.lastMonthlyResetAt,
      })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);

    if (!row) {
      return {
        allowed: true,
        decksRemainingToday: dailyDecks,
        decksRemainingThisMonth: monthlyDecks,
        dailyLimit: dailyDecks,
        monthlyLimit: monthlyDecks,
      };
    }

    const effectiveToday = needsDailyReset(row.lastResetAt) ? 0 : row.decksGeneratedToday;
    const effectiveMonth = needsMonthlyReset(row.lastMonthlyResetAt) ? 0 : row.decksGeneratedThisMonth;
    const remainingToday = Math.max(0, dailyDecks - effectiveToday);
    const remainingMonth = Math.max(0, monthlyDecks - effectiveMonth);

    return {
      allowed: remainingToday > 0 && remainingMonth > 0,
      decksRemainingToday: remainingToday,
      decksRemainingThisMonth: remainingMonth,
      dailyLimit: dailyDecks,
      monthlyLimit: monthlyDecks,
    };
  } catch (error) {
    logger.error('checkDeckQuota failed, falling back to allowed', {
      operation: 'quota:deck:check:error',
      _error: error instanceof Error ? error.message : String(error),
      severity: 'medium' as const,
      userId,
    });
    return {
      allowed: true,
      decksRemainingToday: dailyDecks,
      decksRemainingThisMonth: monthlyDecks,
      dailyLimit: dailyDecks,
      monthlyLimit: monthlyDecks,
    };
  }
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
    const shouldMonthlyReset = needsMonthlyReset(current.lastMonthlyResetAt);

    // Atomic increment (same pattern as incrementTokenUsage) — prevents
    // lost-write races between concurrent deck generations for the same user.
    const [updated] = await db
      .update(userSubscriptions)
      .set({
        decksGeneratedToday: shouldDailyReset
          ? 1
          : sql`${userSubscriptions.decksGeneratedToday} + ${1}`,
        decksGeneratedThisMonth: shouldMonthlyReset
          ? 1
          : sql`${userSubscriptions.decksGeneratedThisMonth} + ${1}`,
        ...(shouldDailyReset && { tokensUsedToday: 0, windowTokensUsed: 0, windowStartAt: new Date() }),
        lastResetAt: shouldDailyReset ? new Date() : current.lastResetAt,
        lastMonthlyResetAt: shouldMonthlyReset ? new Date() : current.lastMonthlyResetAt,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.userId, userId))
      .returning({
        decksGeneratedToday: userSubscriptions.decksGeneratedToday,
        decksGeneratedThisMonth: userSubscriptions.decksGeneratedThisMonth,
      });

    if (!updated) {
      throw new Error('Failed to update deck usage');
    }

    const newDecksToday = updated.decksGeneratedToday;
    const newDecksMonth = updated.decksGeneratedThisMonth;
    const decksRemainingToday = Math.max(0, dailyDecks - newDecksToday);
    const decksRemainingThisMonth = Math.max(0, monthlyDecks - newDecksMonth);

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
