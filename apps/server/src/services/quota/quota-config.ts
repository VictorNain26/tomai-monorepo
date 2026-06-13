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

function getParisHour(): number {
  const parisFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    hour12: false,
  });
  return parseInt(parisFormatter.format(new Date()));
}

export function isWindowExpired(windowStartAt: Date, windowHours: number): boolean {
  const windowAgeMs = Date.now() - windowStartAt.getTime();
  const windowDurationMs = windowHours * 60 * 60 * 1000;
  return windowAgeMs >= windowDurationMs;
}

export function needsDailyReset(lastResetAt: Date): boolean {
  const now = new Date();
  const parisHour = getParisHour();

  // Derive the current Paris-UTC offset dynamically so the reset boundary is
  // correct across DST transitions (CET = UTC+1 in winter, CEST = UTC+2 in
  // summer). Using a fixed offset silently drifts the reset by 1h for ~7 months
  // of the year.
  const nowUtcHour = now.getUTCHours();
  const parisOffsetHours = ((parisHour - nowUtcHour) + 24) % 24;
  const utcResetHour = ((RESET_HOUR_PARIS - parisOffsetHours) + 24) % 24;

  const todayReset = new Date(now);
  todayReset.setUTCHours(utcResetHour, 0, 0, 0);

  // If the computed boundary is still in the future, walk back one calendar
  // day to land on the most recent reset that has actually occurred. Comparing
  // todayReset to `now` is robust to the case where Paris has crossed midnight
  // but UTC hasn't (parisHour < 10 was over-rewinding by one full day there).
  if (todayReset > now) {
    todayReset.setUTCDate(todayReset.getUTCDate() - 1);
  }

  return lastResetAt < todayReset;
}

export function getDailyResetTime(): string {
  const parisHour = getParisHour();

  let hoursRemaining: number;
  if (parisHour >= RESET_HOUR_PARIS) {
    hoursRemaining = 24 - parisHour + RESET_HOUR_PARIS;
  } else {
    hoursRemaining = RESET_HOUR_PARIS - parisHour;
  }

  if (hoursRemaining < 1) {
    const minutes = Math.round(hoursRemaining * 60);
    return `${minutes}min`;
  }
  return `${Math.round(hoursRemaining)}h`;
}

export function needsWeeklyReset(lastWeeklyResetAt: Date): boolean {
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

  const daysSinceMonday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(dayOfWeek ?? 'Mon');
  const adjustedDays = daysSinceMonday === 0 ? 6 : daysSinceMonday - 1;

  const thisMonday = new Date(now);
  thisMonday.setDate(thisMonday.getDate() - adjustedDays);
  thisMonday.setUTCHours(0, 0, 0, 0);

  return lastWeeklyResetAt < thisMonday;
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
