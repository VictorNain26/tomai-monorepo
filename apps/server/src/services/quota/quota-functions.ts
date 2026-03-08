import { db } from '../../db/connection.js';
import { userSubscriptions, subscriptionPlans } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../../lib/observability.js';
import {
  QUOTA_CONFIG,
  getDailyResetTime,
  isWindowExpired,
  needsDailyReset,
  needsWeeklyReset,
  needsMonthlyReset,
  getQuotaMode,
  type QuotaCheckResult,
  type TokenUsageResult,
  type UsageStats,
  type DeckQuotaResult,
  type DeckUsageResult,
} from './quota-config.js';

// =============================================
// ENSURE USER SUBSCRIPTION
// =============================================

async function ensureUserSubscription(userId: string): Promise<{
  planId: string;
  windowLimit: number;
  dailyLimit: number;
  planName: 'free' | 'premium';
}> {
  const [existing] = await db
    .select({
      planId: userSubscriptions.planId,
      planName: subscriptionPlans.name,
      dailyLimit: subscriptionPlans.dailyTokenLimit,
    })
    .from(userSubscriptions)
    .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
    .where(eq(userSubscriptions.userId, userId))
    .limit(1);

  if (existing) {
    const planName = existing.planName === 'premium' ? 'premium' : 'free';
    const config = QUOTA_CONFIG[planName];
    return {
      planId: existing.planId,
      windowLimit: config.windowTokens,
      dailyLimit: config.dailyMaxTokens,
      planName,
    };
  }

  const [freePlan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.name, 'free'))
    .limit(1);

  if (!freePlan) {
    throw new Error('Free plan not found in database');
  }

  await db.insert(userSubscriptions).values({
    userId,
    planId: freePlan.id,
    status: 'active',
    windowTokensUsed: 0,
    windowStartAt: new Date(),
    tokensUsedToday: 0,
    tokensUsedThisWeek: 0,
    decksGeneratedToday: 0,
    decksGeneratedThisMonth: 0,
    lastResetAt: new Date(),
    lastWeeklyResetAt: new Date(),
    lastMonthlyResetAt: new Date(),
    totalTokensUsed: 0,
    totalMessagesCount: 0,
  });

  return {
    planId: freePlan.id,
    windowLimit: QUOTA_CONFIG.free.windowTokens,
    dailyLimit: QUOTA_CONFIG.free.dailyMaxTokens,
    planName: 'free',
  };
}

// =============================================
// MAIN QUOTA FUNCTIONS
// =============================================

function createDefaultQuotaResult(
  windowLimit: number,
  dailyLimit: number,
  plan: 'free' | 'premium'
): QuotaCheckResult {
  return {
    allowed: true,
    mode: 'normal',
    windowTokensUsed: 0,
    windowTokensRemaining: windowLimit,
    windowLimit,
    windowUsagePercent: 0,
    windowRefreshIn: '5h',
    dailyTokensUsed: 0,
    dailyTokensRemaining: dailyLimit,
    dailyLimit,
    dailyUsagePercent: 0,
    dailyResetsIn: getDailyResetTime(),
    plan,
  };
}

export async function checkQuota(userId: string): Promise<QuotaCheckResult> {
  void userId;
  return createDefaultQuotaResult(999_999, 999_999, 'premium');
}

export async function incrementTokenUsage(
  userId: string,
  tokensUsed: number
): Promise<TokenUsageResult> {
  try {
    const { windowLimit, dailyLimit, planName } = await ensureUserSubscription(userId);
    const windowHours = QUOTA_CONFIG[planName].windowHours;

    const [current] = await db
      .select({
        windowTokensUsed: userSubscriptions.windowTokensUsed,
        windowStartAt: userSubscriptions.windowStartAt,
        tokensUsedToday: userSubscriptions.tokensUsedToday,
        tokensUsedThisWeek: userSubscriptions.tokensUsedThisWeek,
        totalTokensUsed: userSubscriptions.totalTokensUsed,
        totalMessagesCount: userSubscriptions.totalMessagesCount,
        lastResetAt: userSubscriptions.lastResetAt,
        lastWeeklyResetAt: userSubscriptions.lastWeeklyResetAt,
      })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);

    if (!current) {
      throw new Error('Subscription not found after ensure');
    }

    let newWindowTokens = current.windowTokensUsed;
    let newDailyTokens = current.tokensUsedToday;
    let newWeeklyTokens = current.tokensUsedThisWeek;
    let windowStart = current.windowStartAt;

    if (isWindowExpired(current.windowStartAt, windowHours)) {
      newWindowTokens = 0;
      windowStart = new Date();
    }

    if (needsDailyReset(current.lastResetAt)) {
      newDailyTokens = 0;
    }

    if (needsWeeklyReset(current.lastWeeklyResetAt)) {
      newWeeklyTokens = 0;
    }

    newWindowTokens += tokensUsed;
    newDailyTokens += tokensUsed;
    newWeeklyTokens += tokensUsed;

    const windowTokensRemaining = Math.max(0, windowLimit - newWindowTokens);
    const dailyTokensRemaining = Math.max(0, dailyLimit - newDailyTokens);

    const windowUsage = newWindowTokens / windowLimit;
    const dailyUsage = newDailyTokens / dailyLimit;
    const maxUsage = Math.max(windowUsage, dailyUsage);
    const mode = getQuotaMode(maxUsage);

    await db
      .update(userSubscriptions)
      .set({
        windowTokensUsed: newWindowTokens,
        windowStartAt: windowStart,
        tokensUsedToday: newDailyTokens,
        tokensUsedThisWeek: newWeeklyTokens,
        totalTokensUsed: current.totalTokensUsed + tokensUsed,
        totalMessagesCount: current.totalMessagesCount + 1,
        lastResetAt: needsDailyReset(current.lastResetAt) ? new Date() : current.lastResetAt,
        lastWeeklyResetAt: needsWeeklyReset(current.lastWeeklyResetAt) ? new Date() : current.lastWeeklyResetAt,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.userId, userId));

    logger.debug('Token usage incremented', {
      userId,
      tokensAdded: tokensUsed,
      newWindowTokens,
      newDailyTokens,
      windowLimit,
      dailyLimit,
    });

    return {
      success: true,
      newWindowTokensUsed: newWindowTokens,
      newDailyTokensUsed: newDailyTokens,
      windowTokensRemaining,
      dailyTokensRemaining,
      mode,
    };

  } catch (error) {
    logger.error('Error incrementing token usage', {
      _error: error instanceof Error ? error.message : String(error),
      severity: 'medium' as const,
      userId,
      tokensUsed,
    });

    return {
      success: false,
      newWindowTokensUsed: 0,
      newDailyTokensUsed: 0,
      windowTokensRemaining: 0,
      dailyTokensRemaining: 0,
      mode: 'normal',
    };
  }
}

export async function getUsageStats(userId: string): Promise<UsageStats> {
  const quota = await checkQuota(userId);

  const [subscription] = await db
    .select({
      tokensUsedThisWeek: userSubscriptions.tokensUsedThisWeek,
      totalTokensUsed: userSubscriptions.totalTokensUsed,
      totalMessagesCount: userSubscriptions.totalMessagesCount,
    })
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId))
    .limit(1);

  return {
    windowTokensUsed: quota.windowTokensUsed,
    windowTokensRemaining: quota.windowTokensRemaining,
    windowLimit: quota.windowLimit,
    windowUsagePercent: quota.windowUsagePercent,
    windowRefreshIn: quota.windowRefreshIn,
    dailyTokensUsed: quota.dailyTokensUsed,
    dailyTokensRemaining: quota.dailyTokensRemaining,
    dailyLimit: quota.dailyLimit,
    dailyUsagePercent: quota.dailyUsagePercent,
    dailyResetsIn: quota.dailyResetsIn,
    weeklyTokensUsed: subscription?.tokensUsedThisWeek ?? 0,
    totalTokensUsed: subscription?.totalTokensUsed ?? 0,
    totalMessagesCount: subscription?.totalMessagesCount ?? 0,
    plan: quota.plan,
  };
}

export function getHoursUntilReset(): string {
  return getDailyResetTime();
}

// =============================================
// DECK QUOTA FUNCTIONS
// =============================================

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
