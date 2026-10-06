import { tz } from '@date-fns/tz';
import { addDays, differenceInMinutes, isBefore, setHours, startOfDay } from 'date-fns';

// =============================================
// CONFIGURATION QUOTAS
// =============================================

/**
 * Daily budget of each plan, in micro-euros of AI calls (`cost_tracking`). Provisional: Victor sets
 * them on the cost measured at the closing pass (`docs/vision.md`, « Offre et prix »).
 */
export const QUOTA_CONFIG = {
  free: {
    dailyBudgetMicroEur: 20_000,
  },
  premium: {
    dailyBudgetMicroEur: 100_000,
  },
} as const;

const RESET_HOUR_PARIS = 10;

// =============================================
// TYPES
// =============================================

type Plan = keyof typeof QUOTA_CONFIG;

export interface DailyUsage {
  plan: Plan;
  spentMicroEur: number;
  budgetMicroEur: number;
  usagePercent: number;
  resetsIn: string;
}

export interface QuotaCheckResult {
  allowed: boolean;
  /** The plan to gate features on; `premium` when the quota is off or could not be read. */
  plan: Plan;
  /** The day's usage; null when the quota is off or could not be read. */
  usage: DailyUsage | null;
}

// =============================================
// HELPER FUNCTIONS
// =============================================

const inParis = tz('Europe/Paris');

/** The last daily reset, at 10 h in Paris: what the budget counts from. */
export function lastDailyReset(now: Date): Date {
  const todayReset = setHours(startOfDay(now, { in: inParis }), RESET_HOUR_PARIS, { in: inParis });
  return isBefore(now, todayReset) ? addDays(todayReset, -1, { in: inParis }) : todayReset;
}

export function getDailyResetTime(): string {
  const now = new Date();
  const nextReset = addDays(lastDailyReset(now), 1, { in: inParis });
  const minutes = differenceInMinutes(nextReset, now, { roundingMethod: 'ceil' });
  return minutes < 60 ? `${minutes}min` : `${Math.round(minutes / 60)}h`;
}
