/**
 * Token Quota Service - Rolling Window 5h + Daily Cap
 *
 * Architecture 2025 inspirée de ChatGPT/Claude :
 * - Rolling window 5h : quota se recharge progressivement
 * - Daily cap : limite max journalière (sécurité anti-abus)
 * - Soft limits : dégradation progressive, jamais de blocage brutal
 * - Weekly stats : pour dashboard parent
 *
 * Limites :
 * - FREE: 5,000 tokens/window (5h), 15,000 tokens/jour max
 * - PREMIUM: 16,000 tokens/window (5h), 50,000 tokens/jour max
 */

import { db } from '../db/connection.js';
import { userSubscriptions, subscriptionPlans } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../lib/observability.js';

// =============================================
// CONFIGURATION QUOTAS
// =============================================

const QUOTA_CONFIG = {
  free: {
    windowTokens: 5_000,      // Par fenêtre 5h
    dailyMaxTokens: 15_000,   // Cap journalier
    windowHours: 5,
  },
  premium: {
    windowTokens: 25_000,     // Par fenêtre 5h (~25-40 échanges)
    dailyMaxTokens: 75_000,   // Cap journalier
    windowHours: 5,
    dailyDecks: 5,
    monthlyDecks: 50,
  },
} as const;

// Soft limit thresholds (pourcentage)
const SOFT_LIMITS = {
  NORMAL: 0.70,      // Pas d'affichage
  WARNING: 0.85,     // Badge "X% restant"
  THROTTLE: 0.95,    // Délai 2s
  HARD_STOP: 1.00,   // Blocage soft avec timer
} as const;

// Reset time: 10:00 AM Paris time (pour daily cap)
const RESET_HOUR_PARIS = 10;

// =============================================
// TYPES
// =============================================

type QuotaMode = 'normal' | 'warning' | 'throttle' | 'blocked';

interface QuotaCheckResult {
  allowed: boolean;
  mode: QuotaMode;

  // Window stats (rolling 5h)
  windowTokensUsed: number;
  windowTokensRemaining: number;
  windowLimit: number;
  windowUsagePercent: number;
  windowRefreshIn: string;  // "2h 30min"

  // Daily stats (cap journalier)
  dailyTokensUsed: number;
  dailyTokensRemaining: number;
  dailyLimit: number;
  dailyUsagePercent: number;
  dailyResetsIn: string;    // "5h"

  // Plan info
  plan: 'free' | 'premium';

  // Soft limit info
  throttleDelayMs?: number;
  message?: string;
}

interface TokenUsageResult {
  success: boolean;
  newWindowTokensUsed: number;
  newDailyTokensUsed: number;
  windowTokensRemaining: number;
  dailyTokensRemaining: number;
  mode: QuotaMode;
}

interface UsageStats {
  // Window (rolling 5h)
  windowTokensUsed: number;
  windowTokensRemaining: number;
  windowLimit: number;
  windowUsagePercent: number;
  windowRefreshIn: string;

  // Daily
  dailyTokensUsed: number;
  dailyTokensRemaining: number;
  dailyLimit: number;
  dailyUsagePercent: number;
  dailyResetsIn: string;

  // Weekly (pour dashboard parent)
  weeklyTokensUsed: number;

  // Lifetime
  totalTokensUsed: number;
  totalMessagesCount: number;

  // Plan
  plan: 'free' | 'premium';
}

interface DeckQuotaResult {
  allowed: boolean;
  decksRemainingToday: number;
  decksRemainingThisMonth: number;
  dailyLimit: number;
  monthlyLimit: number;
  message?: string;
}

interface DeckUsageResult {
  success: boolean;
  newDecksGeneratedToday: number;
  newDecksGeneratedThisMonth: number;
  decksRemainingToday: number;
  decksRemainingThisMonth: number;
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Get Paris timezone current hour
 */
function getParisHour(): number {
  const parisFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    hour12: false,
  });
  return parseInt(parisFormatter.format(new Date()));
}

/**
 * Check if rolling window (5h) has expired
 */
function isWindowExpired(windowStartAt: Date, windowHours: number): boolean {
  const windowAgeMs = Date.now() - windowStartAt.getTime();
  const windowDurationMs = windowHours * 60 * 60 * 1000;
  return windowAgeMs >= windowDurationMs;
}

/**
 * Calculate time remaining until window refresh
 */
function getWindowRefreshTime(windowStartAt: Date, windowHours: number): string {
  const windowEndMs = windowStartAt.getTime() + (windowHours * 60 * 60 * 1000);
  const remainingMs = Math.max(0, windowEndMs - Date.now());

  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

  if (hours === 0 && minutes === 0) return 'maintenant';
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

/**
 * Check if daily reset is needed (10h Paris)
 */
function needsDailyReset(lastResetAt: Date): boolean {
  const now = new Date();
  const parisHour = getParisHour();

  // Get today's reset time (10:00 AM Paris ≈ 09:00 UTC in winter, 08:00 UTC in summer)
  const todayReset = new Date(now);
  todayReset.setUTCHours(RESET_HOUR_PARIS - 1, 0, 0, 0); // Approximation UTC

  // If before 10 AM Paris, use yesterday's reset time
  if (parisHour < RESET_HOUR_PARIS) {
    todayReset.setDate(todayReset.getDate() - 1);
  }

  return lastResetAt < todayReset;
}

/**
 * Calculate hours until next daily reset (10h Paris)
 */
function getDailyResetTime(): string {
  const parisHour = getParisHour();

  let hoursRemaining: number;
  if (parisHour >= RESET_HOUR_PARIS) {
    // Reset tomorrow
    hoursRemaining = 24 - parisHour + RESET_HOUR_PARIS;
  } else {
    // Reset today
    hoursRemaining = RESET_HOUR_PARIS - parisHour;
  }

  if (hoursRemaining < 1) {
    const minutes = Math.round(hoursRemaining * 60);
    return `${minutes}min`;
  }
  return `${Math.round(hoursRemaining)}h`;
}

/**
 * Check if weekly reset is needed (Monday 00:00 Paris)
 */
function needsWeeklyReset(lastWeeklyResetAt: Date): boolean {
  const now = new Date();
  const parisFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const nowParts = parisFormatter.formatToParts(now);
  const dayOfWeek = nowParts.find(p => p.type === 'weekday')?.value;

  // Get Monday of current week
  const daysSinceMonday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(dayOfWeek ?? 'Mon');
  const adjustedDays = daysSinceMonday === 0 ? 6 : daysSinceMonday - 1; // Sun = 6, Mon = 0, etc.

  const thisMonday = new Date(now);
  thisMonday.setDate(thisMonday.getDate() - adjustedDays);
  thisMonday.setUTCHours(0, 0, 0, 0);

  return lastWeeklyResetAt < thisMonday;
}

/**
 * Check if monthly reset is needed (1st of month)
 */
function needsMonthlyReset(lastMonthlyResetAt: Date): boolean {
  const now = new Date();
  const parisFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
  });

  const nowParis = parisFormatter.format(now);
  const lastResetParis = parisFormatter.format(lastMonthlyResetAt);

  return nowParis !== lastResetParis;
}

/**
 * Determine quota mode based on usage percentage
 */
function getQuotaMode(usagePercent: number): QuotaMode {
  if (usagePercent >= SOFT_LIMITS.HARD_STOP) return 'blocked';
  if (usagePercent >= SOFT_LIMITS.THROTTLE) return 'throttle';
  if (usagePercent >= SOFT_LIMITS.WARNING) return 'warning';
  return 'normal';
}

/**
 * Get user-friendly message based on quota mode
 */
function getQuotaMessage(mode: QuotaMode, refreshIn: string, plan: 'free' | 'premium'): string | undefined {
  switch (mode) {
    case 'blocked':
      return `Quota atteint. Refresh dans ${refreshIn}.${plan === 'free' ? ' Passez à Premium pour plus de questions !' : ''}`;
    case 'throttle':
      return 'Presque au quota, les réponses peuvent être plus lentes.';
    case 'warning':
      return 'Tu approches de ta limite de questions.';
    default:
      return undefined;
  }
}

// =============================================
// ENSURE USER SUBSCRIPTION
// =============================================

async function ensureUserSubscription(userId: string): Promise<{
  planId: string;
  windowLimit: number;
  dailyLimit: number;
  planName: 'free' | 'premium';
}> {
  // Check existing subscription
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

  // Get free plan
  const [freePlan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.name, 'free'))
    .limit(1);

  if (!freePlan) {
    throw new Error('Free plan not found in database');
  }

  // Create subscription for user
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

/**
 * Check if user has enough tokens remaining (rolling window + daily cap)
 * Handles automatic resets for window, daily, weekly, and monthly
 */
export async function checkQuota(userId: string): Promise<QuotaCheckResult> {
  try {
    const { windowLimit, dailyLimit, planName } = await ensureUserSubscription(userId);
    const windowHours = QUOTA_CONFIG[planName].windowHours;

    // Get current usage
    const [subscription] = await db
      .select({
        windowTokensUsed: userSubscriptions.windowTokensUsed,
        windowStartAt: userSubscriptions.windowStartAt,
        tokensUsedToday: userSubscriptions.tokensUsedToday,
        tokensUsedThisWeek: userSubscriptions.tokensUsedThisWeek,
        lastResetAt: userSubscriptions.lastResetAt,
        lastWeeklyResetAt: userSubscriptions.lastWeeklyResetAt,
        lastMonthlyResetAt: userSubscriptions.lastMonthlyResetAt,
      })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);

    if (!subscription) {
      // Should not happen after ensureUserSubscription
      return createDefaultQuotaResult(windowLimit, dailyLimit, planName);
    }

    // Check and perform resets
    const updates: Record<string, unknown> = {};
    let currentWindowTokens = subscription.windowTokensUsed;
    let currentDailyTokens = subscription.tokensUsedToday;
    let windowStart = subscription.windowStartAt;

    // Rolling window reset (5h)
    if (isWindowExpired(subscription.windowStartAt, windowHours)) {
      currentWindowTokens = 0;
      windowStart = new Date();
      updates.windowTokensUsed = 0;
      updates.windowStartAt = windowStart;
      logger.debug('Rolling window reset', { userId, plan: planName });
    }

    // Daily reset (10h Paris)
    if (needsDailyReset(subscription.lastResetAt)) {
      currentDailyTokens = 0;
      updates.tokensUsedToday = 0;
      updates.decksGeneratedToday = 0;
      updates.lastResetAt = new Date();
      logger.info('Daily quota reset', { userId, plan: planName });
    }

    // Weekly reset (Monday)
    if (needsWeeklyReset(subscription.lastWeeklyResetAt)) {
      updates.tokensUsedThisWeek = 0;
      updates.lastWeeklyResetAt = new Date();
      logger.debug('Weekly stats reset', { userId });
    }

    // Monthly reset (1st of month)
    if (needsMonthlyReset(subscription.lastMonthlyResetAt)) {
      updates.decksGeneratedThisMonth = 0;
      updates.lastMonthlyResetAt = new Date();
      logger.debug('Monthly stats reset', { userId });
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      await db
        .update(userSubscriptions)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(userSubscriptions.userId, userId));
    }

    // Calculate remaining tokens
    const windowTokensRemaining = Math.max(0, windowLimit - currentWindowTokens);
    const dailyTokensRemaining = Math.max(0, dailyLimit - currentDailyTokens);

    // Use the more restrictive limit
    const effectiveRemaining = Math.min(windowTokensRemaining, dailyTokensRemaining);

    // Calculate usage percentages
    const windowUsagePercent = Math.min(100, Math.round((currentWindowTokens / windowLimit) * 100));
    const dailyUsagePercent = Math.min(100, Math.round((currentDailyTokens / dailyLimit) * 100));

    // Use highest usage percentage for mode determination
    const maxUsagePercent = Math.max(windowUsagePercent, dailyUsagePercent) / 100;
    const mode = getQuotaMode(maxUsagePercent);

    const windowRefreshIn = getWindowRefreshTime(windowStart, windowHours);
    const dailyResetsIn = getDailyResetTime();

    return {
      allowed: effectiveRemaining > 0,
      mode,

      windowTokensUsed: currentWindowTokens,
      windowTokensRemaining,
      windowLimit,
      windowUsagePercent,
      windowRefreshIn,

      dailyTokensUsed: currentDailyTokens,
      dailyTokensRemaining,
      dailyLimit,
      dailyUsagePercent,
      dailyResetsIn,

      plan: planName,

      throttleDelayMs: mode === 'throttle' ? 2000 : undefined,
      message: getQuotaMessage(mode, windowRefreshIn, planName),
    };

  } catch (error) {
    logger.error('Error checking token quota', {
      _error: error instanceof Error ? error.message : String(error),
      severity: 'medium' as const,
      userId,
    });

    // Fail open but log
    return createDefaultQuotaResult(
      QUOTA_CONFIG.free.windowTokens,
      QUOTA_CONFIG.free.dailyMaxTokens,
      'free'
    );
  }
}

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

/**
 * Increment token usage after AI response
 * Updates window, daily, weekly, and total counters
 */
export async function incrementTokenUsage(
  userId: string,
  tokensUsed: number
): Promise<TokenUsageResult> {
  try {
    const { windowLimit, dailyLimit, planName } = await ensureUserSubscription(userId);
    const windowHours = QUOTA_CONFIG[planName].windowHours;

    // Get current state
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

    // Calculate new values with potential resets
    let newWindowTokens = current.windowTokensUsed;
    let newDailyTokens = current.tokensUsedToday;
    let newWeeklyTokens = current.tokensUsedThisWeek;
    let windowStart = current.windowStartAt;

    // Check window reset
    if (isWindowExpired(current.windowStartAt, windowHours)) {
      newWindowTokens = 0;
      windowStart = new Date();
    }

    // Check daily reset
    if (needsDailyReset(current.lastResetAt)) {
      newDailyTokens = 0;
    }

    // Check weekly reset
    if (needsWeeklyReset(current.lastWeeklyResetAt)) {
      newWeeklyTokens = 0;
    }

    // Add new tokens
    newWindowTokens += tokensUsed;
    newDailyTokens += tokensUsed;
    newWeeklyTokens += tokensUsed;

    // Calculate remaining
    const windowTokensRemaining = Math.max(0, windowLimit - newWindowTokens);
    const dailyTokensRemaining = Math.max(0, dailyLimit - newDailyTokens);

    // Determine mode
    const windowUsage = newWindowTokens / windowLimit;
    const dailyUsage = newDailyTokens / dailyLimit;
    const maxUsage = Math.max(windowUsage, dailyUsage);
    const mode = getQuotaMode(maxUsage);

    // Update database
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

/**
 * Get comprehensive usage stats for display (student or parent dashboard)
 */
export async function getUsageStats(userId: string): Promise<UsageStats> {
  const quota = await checkQuota(userId);

  // Get additional stats from DB
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
    // Window (rolling 5h)
    windowTokensUsed: quota.windowTokensUsed,
    windowTokensRemaining: quota.windowTokensRemaining,
    windowLimit: quota.windowLimit,
    windowUsagePercent: quota.windowUsagePercent,
    windowRefreshIn: quota.windowRefreshIn,

    // Daily
    dailyTokensUsed: quota.dailyTokensUsed,
    dailyTokensRemaining: quota.dailyTokensRemaining,
    dailyLimit: quota.dailyLimit,
    dailyUsagePercent: quota.dailyUsagePercent,
    dailyResetsIn: quota.dailyResetsIn,

    // Weekly (for parent dashboard)
    weeklyTokensUsed: subscription?.tokensUsedThisWeek ?? 0,

    // Lifetime
    totalTokensUsed: subscription?.totalTokensUsed ?? 0,
    totalMessagesCount: subscription?.totalMessagesCount ?? 0,

    // Plan
    plan: quota.plan,
  };
}

/**
 * Get hours until next window refresh (for display)
 */
export function getHoursUntilReset(): string {
  return getDailyResetTime();
}

// =============================================
// DECK QUOTA FUNCTIONS (Premium only)
// =============================================

/**
 * Check if user can generate a new deck
 * Limits: 5/day, 50/month (premium users only)
 */
export async function checkDeckQuota(userId: string): Promise<DeckQuotaResult> {
  const { dailyDecks, monthlyDecks } = QUOTA_CONFIG.premium;

  try {
    await ensureUserSubscription(userId);

    const [subscription] = await db
      .select({
        decksGeneratedToday: userSubscriptions.decksGeneratedToday,
        decksGeneratedThisMonth: userSubscriptions.decksGeneratedThisMonth,
        lastResetAt: userSubscriptions.lastResetAt,
        lastMonthlyResetAt: userSubscriptions.lastMonthlyResetAt,
      })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);

    if (!subscription) {
      return {
        allowed: true,
        decksRemainingToday: dailyDecks,
        decksRemainingThisMonth: monthlyDecks,
        dailyLimit: dailyDecks,
        monthlyLimit: monthlyDecks,
      };
    }

    // Calculate with potential resets
    const dailyNeedsReset = needsDailyReset(subscription.lastResetAt);
    const decksToday = dailyNeedsReset ? 0 : subscription.decksGeneratedToday;
    const decksRemainingToday = Math.max(0, dailyDecks - decksToday);

    const monthlyNeedsReset = needsMonthlyReset(subscription.lastMonthlyResetAt);
    const decksThisMonth = monthlyNeedsReset ? 0 : subscription.decksGeneratedThisMonth;
    const decksRemainingThisMonth = Math.max(0, monthlyDecks - decksThisMonth);

    // Check daily limit
    if (decksRemainingToday <= 0) {
      return {
        allowed: false,
        decksRemainingToday: 0,
        decksRemainingThisMonth,
        dailyLimit: dailyDecks,
        monthlyLimit: monthlyDecks,
        message: `Tu as atteint la limite de ${dailyDecks} decks par jour. Réinitialisation dans ${getDailyResetTime()}.`,
      };
    }

    // Check monthly limit
    if (decksRemainingThisMonth <= 0) {
      return {
        allowed: false,
        decksRemainingToday,
        decksRemainingThisMonth: 0,
        dailyLimit: dailyDecks,
        monthlyLimit: monthlyDecks,
        message: `Tu as atteint la limite de ${monthlyDecks} decks ce mois-ci. Réinitialisation le 1er du mois prochain.`,
      };
    }

    return {
      allowed: true,
      decksRemainingToday,
      decksRemainingThisMonth,
      dailyLimit: dailyDecks,
      monthlyLimit: monthlyDecks,
    };

  } catch (error) {
    logger.error('Error checking deck quota', {
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

/**
 * Increment deck usage after successful generation
 */
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

    // Calculate with resets
    const shouldDailyReset = needsDailyReset(current.lastResetAt);
    const baseDecksToday = shouldDailyReset ? 0 : current.decksGeneratedToday;
    const newDecksToday = baseDecksToday + 1;
    const decksRemainingToday = Math.max(0, dailyDecks - newDecksToday);

    const shouldMonthlyReset = needsMonthlyReset(current.lastMonthlyResetAt);
    const baseDecksMonth = shouldMonthlyReset ? 0 : current.decksGeneratedThisMonth;
    const newDecksMonth = baseDecksMonth + 1;
    const decksRemainingThisMonth = Math.max(0, monthlyDecks - newDecksMonth);

    // Update database
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

/**
 * Reset all users' daily tokens (for cron job at 10:00 AM Paris)
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

// =============================================
// EXPORT SERVICE
// =============================================

export const tokenQuotaService = {
  checkQuota,
  incrementTokenUsage,
  getUsageStats,
  resetAllDailyTokens,
  getHoursUntilReset,
  checkDeckQuota,
  incrementDeckUsage,
  // Export config for frontend reference
  QUOTA_CONFIG,
  SOFT_LIMITS,
};
