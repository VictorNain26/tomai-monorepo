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
  getQuotaMode,
  type QuotaCheckResult,
  type TokenUsageResult,
  type UsageStats,
} from './quota-config.js';

// =============================================
// ENSURE USER SUBSCRIPTION
// =============================================

export async function ensureUserSubscription(userId: string): Promise<{
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
    // Read current state (needed for plan config + reset decisions).
    const [currentWithPlan] = await db
      .select({
        planName: subscriptionPlans.name,
        windowStartAt: userSubscriptions.windowStartAt,
        lastResetAt: userSubscriptions.lastResetAt,
        lastWeeklyResetAt: userSubscriptions.lastWeeklyResetAt,
      })
      .from(userSubscriptions)
      .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);

    // Brand-new user path: create subscription row, then retry
    let current = currentWithPlan;
    let planName: 'free' | 'premium';
    if (!current) {
      const ensured = await ensureUserSubscription(userId);
      planName = ensured.planName;
      const [refetched] = await db
        .select({
          planName: subscriptionPlans.name,
          windowStartAt: userSubscriptions.windowStartAt,
          lastResetAt: userSubscriptions.lastResetAt,
          lastWeeklyResetAt: userSubscriptions.lastWeeklyResetAt,
        })
        .from(userSubscriptions)
        .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
        .where(eq(userSubscriptions.userId, userId))
        .limit(1);
      if (!refetched) {
        throw new Error('Subscription not found after ensure');
      }
      current = refetched;
    } else {
      planName = current.planName === 'premium' ? 'premium' : 'free';
    }

    const windowHours = QUOTA_CONFIG[planName].windowHours;
    const windowLimit = QUOTA_CONFIG[planName].windowTokens;
    const dailyLimit = QUOTA_CONFIG[planName].dailyMaxTokens;

    // Decide resets from the snapshot we just read. Worst case: a concurrent writer
    // also crosses the same boundary simultaneously — the CASE WHEN below still produces
    // a correct "reset + delta" outcome atomically.
    const shouldResetWindow = isWindowExpired(current.windowStartAt, windowHours);
    const shouldResetDaily = needsDailyReset(current.lastResetAt);
    const shouldResetWeekly = needsWeeklyReset(current.lastWeeklyResetAt);

    // Atomic increment in a single UPDATE ... RETURNING. Eliminates the lost-write
    // race between two concurrent streams for the same user (billing-critical).
    const [updated] = await db
      .update(userSubscriptions)
      .set({
        windowTokensUsed: shouldResetWindow
          ? tokensUsed
          : sql`${userSubscriptions.windowTokensUsed} + ${tokensUsed}`,
        windowStartAt: shouldResetWindow ? new Date() : current.windowStartAt,
        tokensUsedToday: shouldResetDaily
          ? tokensUsed
          : sql`${userSubscriptions.tokensUsedToday} + ${tokensUsed}`,
        lastResetAt: shouldResetDaily ? new Date() : current.lastResetAt,
        tokensUsedThisWeek: shouldResetWeekly
          ? tokensUsed
          : sql`${userSubscriptions.tokensUsedThisWeek} + ${tokensUsed}`,
        lastWeeklyResetAt: shouldResetWeekly ? new Date() : current.lastWeeklyResetAt,
        totalTokensUsed: sql`${userSubscriptions.totalTokensUsed} + ${tokensUsed}`,
        totalMessagesCount: sql`${userSubscriptions.totalMessagesCount} + ${1}`,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.userId, userId))
      .returning({
        windowTokensUsed: userSubscriptions.windowTokensUsed,
        tokensUsedToday: userSubscriptions.tokensUsedToday,
      });

    if (!updated) {
      throw new Error('Failed to update token usage');
    }

    const newWindowTokens = updated.windowTokensUsed;
    const newDailyTokens = updated.tokensUsedToday;

    const windowTokensRemaining = Math.max(0, windowLimit - newWindowTokens);
    const dailyTokensRemaining = Math.max(0, dailyLimit - newDailyTokens);

    const windowUsage = newWindowTokens / windowLimit;
    const dailyUsage = newDailyTokens / dailyLimit;
    const maxUsage = Math.max(windowUsage, dailyUsage);
    const mode = getQuotaMode(maxUsage);

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

// Deck quota functions are now in ./quota-deck.ts
// Scheduled reset sweep is now in ./quota-reset.ts
export { checkDeckQuota, incrementDeckUsage } from './quota-deck.js';
export { resetAllDailyTokens } from './quota-reset.js';
