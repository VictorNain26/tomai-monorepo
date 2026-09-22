import { tz } from '@date-fns/tz';
import { addDays, differenceInMinutes, isBefore, setHours, startOfDay, startOfWeek } from 'date-fns';

// =============================================
// CONFIGURATION QUOTAS
// =============================================

export const QUOTA_CONFIG = {
  free: {
    windowTokens: 5_000,
    dailyMaxTokens: 15_000,
    windowHours: 5,
  },
  premium: {
    windowTokens: 25_000,
    dailyMaxTokens: 75_000,
    windowHours: 5,
    dailyDecks: 5,
    monthlyDecks: 50,
  },
} as const;

export const SOFT_LIMITS = {
  NORMAL: 0.70,
  WARNING: 0.85,
  THROTTLE: 0.95,
  HARD_STOP: 1.00,
} as const;

const RESET_HOUR_PARIS = 10;

// =============================================
// TYPES
// =============================================

export type QuotaMode = 'normal' | 'warning' | 'throttle' | 'blocked';

export interface QuotaCheckResult {
  allowed: boolean;
  mode: QuotaMode;
  windowTokensUsed: number;
  windowTokensRemaining: number;
  windowLimit: number;
  windowUsagePercent: number;
  windowRefreshIn: string;
  dailyTokensUsed: number;
  dailyTokensRemaining: number;
  dailyLimit: number;
  dailyUsagePercent: number;
  dailyResetsIn: string;
  plan: 'free' | 'premium';
  throttleDelayMs?: number;
  message?: string;
}

export interface TokenUsageResult {
  success: boolean;
  newWindowTokensUsed: number;
  newDailyTokensUsed: number;
  windowTokensRemaining: number;
  dailyTokensRemaining: number;
  mode: QuotaMode;
}

export interface UsageStats {
  windowTokensUsed: number;
  windowTokensRemaining: number;
  windowLimit: number;
  windowUsagePercent: number;
  windowRefreshIn: string;
  dailyTokensUsed: number;
  dailyTokensRemaining: number;
  dailyLimit: number;
  dailyUsagePercent: number;
  dailyResetsIn: string;
  weeklyTokensUsed: number;
  totalTokensUsed: number;
  totalMessagesCount: number;
  plan: 'free' | 'premium';
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

export function isWindowExpired(windowStartAt: Date, windowHours: number): boolean {
  const windowAgeMs = Date.now() - windowStartAt.getTime();
  const windowDurationMs = windowHours * 60 * 60 * 1000;
  return windowAgeMs >= windowDurationMs;
}

const inParis = tz('Europe/Paris');

function lastDailyReset(now: Date): Date {
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

export function needsWeeklyReset(lastWeeklyResetAt: Date): boolean {
  return isBefore(lastWeeklyResetAt, startOfWeek(new Date(), { in: inParis, weekStartsOn: 1 }));
}

export function needsMonthlyReset(lastMonthlyResetAt: Date): boolean {
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

export function getQuotaMode(usagePercent: number): QuotaMode {
  if (usagePercent >= SOFT_LIMITS.HARD_STOP) return 'blocked';
  if (usagePercent >= SOFT_LIMITS.THROTTLE) return 'throttle';
  if (usagePercent >= SOFT_LIMITS.WARNING) return 'warning';
  return 'normal';
}
