import { tz } from '@date-fns/tz';
import { addDays, differenceInMinutes, isBefore, setHours, startOfDay, startOfMonth } from 'date-fns';

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
    dailyDecks: 5,
    monthlyDecks: 50,
  },
} as const;

const RESET_HOUR_PARIS = 10;

// =============================================
// TYPES
// =============================================

export type Plan = keyof typeof QUOTA_CONFIG;

export interface QuotaCheckResult {
  allowed: boolean;
  plan: Plan;
  spentMicroEur: number;
  budgetMicroEur: number;
  usagePercent: number;
  resetsIn: string;
}

export interface DeckQuotaResult {
  allowed: boolean;
  decksRemainingToday: number;
  decksRemainingThisMonth: number;
  dailyLimit: number;
  monthlyLimit: number;
  message?: string;
}

export interface DeckUsageResult {
  success: boolean;
  newDecksGeneratedToday: number;
  newDecksGeneratedThisMonth: number;
  decksRemainingToday: number;
  decksRemainingThisMonth: number;
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

export function needsDailyReset(lastResetAt: Date): boolean {
  return isBefore(lastResetAt, lastDailyReset(new Date()));
}

export function getDailyResetTime(): string {
  const now = new Date();
  const nextReset = addDays(lastDailyReset(now), 1, { in: inParis });
  const minutes = differenceInMinutes(nextReset, now, { roundingMethod: 'ceil' });
  return minutes < 60 ? `${minutes}min` : `${Math.round(minutes / 60)}h`;
}

export function needsMonthlyReset(lastMonthlyResetAt: Date): boolean {
  return isBefore(lastMonthlyResetAt, startOfMonth(new Date(), { in: inParis }));
}
