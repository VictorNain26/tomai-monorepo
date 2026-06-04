/**
 * Deck quota functions (flashcard generation limits)
 *
 * Extracted from quota-functions.ts to keep each file under the 400-line limit.
 */

import { userSubscriptionsRepository } from '../../db/repositories/user-subscriptions.repository.js';
import { logger } from '../../lib/observability.js';
import { env } from '../../config/env.js';
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
  if (!env.QUOTA_ENFORCEMENT_ENABLED) {
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
    const row = await userSubscriptionsRepository.findByUserId(userId);

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

    const current = await userSubscriptionsRepository.findByUserId(userId);

    if (!current) {
      throw new Error('Subscription not found');
    }

    // Atomic increment (same pattern as incrementTokenUsage) — prevents
    // lost-write races between concurrent deck generations for the same user.
    const updated = await userSubscriptionsRepository.applyDeckIncrement(userId, {
      shouldResetDaily: needsDailyReset(current.lastResetAt),
      lastResetAt: current.lastResetAt,
      shouldResetMonthly: needsMonthlyReset(current.lastMonthlyResetAt),
      lastMonthlyResetAt: current.lastMonthlyResetAt,
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
