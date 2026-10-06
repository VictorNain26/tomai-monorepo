import { userSubscriptionsRepository } from './user-subscriptions.repository.js';
import { logger } from '../../platform/observability/logger.js';
import { env } from '../../platform/config/env.js';
import {
  QUOTA_CONFIG,
  getDailyResetTime,
  lastDailyReset,
  type DailyUsage,
  type QuotaCheckResult,
} from './quota-config.js';

/**
 * The user's day against their plan's budget: what their AI calls cost since the last reset
 * (`cost_tracking`, every billed call, cache at its price, speech included). Without a
 * subscription row, the Gratuit plan. A failed read throws: what it shows must be true.
 */
export async function dailyUsage(userId: string): Promise<DailyUsage> {
  const [subscription, spentMicroEur] = await Promise.all([
    userSubscriptionsRepository.findByUserId(userId),
    userSubscriptionsRepository.spentSince(userId, lastDailyReset(new Date())),
  ]);
  // A Complet plan counts while it is active and not expired; otherwise the Gratuit budget.
  const plan = subscription?.plan === 'premium' && subscription.status === 'active' && (subscription.expiresAt === null || subscription.expiresAt > new Date())
    ? 'premium'
    : 'free';
  const budgetMicroEur = QUOTA_CONFIG[plan].dailyBudgetMicroEur;
  return {
    plan,
    spentMicroEur,
    budgetMicroEur,
    usagePercent: Math.round((spentMicroEur / budgetMicroEur) * 100),
    resetsIn: getDailyResetTime(),
  };
}

/**
 * Whether the user may start a call: budget not spent and, for a call whose cost is known
 * beforehand (`plannedMicroEur`, speech), not exceeded by it.
 */
export async function checkQuota(userId: string, plannedMicroEur = 0): Promise<QuotaCheckResult> {
  // Enforcement off: every caller gets unlimited access; `cost_tracking` still records each call.
  if (!env.QUOTA_ENFORCEMENT_ENABLED) return { allowed: true, flashcards: true, usage: null };
  try {
    const usage = await dailyUsage(userId);
    const allowed = usage.spentMicroEur < usage.budgetMicroEur && usage.spentMicroEur + plannedMicroEur <= usage.budgetMicroEur;
    return { allowed, flashcards: usage.plan === 'premium', usage };
  } catch (error) {
    logger.error('checkQuota failed, falling back to allowed', {
      operation: 'quota:check:error',
      err: error,
      severity: 'high' as const,
      userId,
    });
    // Fail-open on the budget: a DB blip must not block a paying user; the spend stays recorded.
    // Not on the plan: a failed read does not make anyone Complet.
    return { allowed: true, flashcards: null, usage: null };
  }
}
