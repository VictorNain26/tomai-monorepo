import { userSubscriptionsRepository } from './user-subscriptions.repository.js';
import { logger } from '../../platform/observability/logger.js';
import { env } from '../../platform/config/env.js';
import {
  QUOTA_CONFIG,
  getDailyResetTime,
  lastDailyReset,
  type Plan,
  type QuotaCheckResult,
} from './quota-config.js';

function result(plan: Plan, spentMicroEur: number, budgetMicroEur: number): QuotaCheckResult {
  return {
    allowed: spentMicroEur < budgetMicroEur,
    plan,
    spentMicroEur,
    budgetMicroEur,
    usagePercent: Math.round((spentMicroEur / budgetMicroEur) * 100),
    resetsIn: getDailyResetTime(),
  };
}

/**
 * The user's day against their plan's budget: what their AI calls cost since the last reset
 * (`cost_tracking`, every billed call, cache at its price, speech included). Without a
 * subscription row, the Gratuit plan.
 */
export async function checkQuota(userId: string): Promise<QuotaCheckResult> {
  // Enforcement off: every caller gets unlimited access; `cost_tracking` still records each call.
  if (!env.QUOTA_ENFORCEMENT_ENABLED) {
    return result('premium', 0, Number.MAX_SAFE_INTEGER);
  }
  try {
    const plan = (await userSubscriptionsRepository.findByUserId(userId))?.plan ?? 'free';
    const spent = await userSubscriptionsRepository.spentSince(userId, lastDailyReset(new Date()));
    return result(plan, spent, QUOTA_CONFIG[plan].dailyBudgetMicroEur);
  } catch (error) {
    logger.error('checkQuota failed, falling back to allowed', {
      operation: 'quota:check:error',
      err: error,
      severity: 'high' as const,
      userId,
    });
    // Fail-open: a DB blip should not block legitimate traffic; the spend stays recorded.
    return result('free', 0, QUOTA_CONFIG.free.dailyBudgetMicroEur);
  }
}
