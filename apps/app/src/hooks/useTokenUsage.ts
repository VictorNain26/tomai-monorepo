/**
 * useTokenUsage - React Query hook for fetching token usage
 *
 * Architecture 2025 inspirée ChatGPT/Claude:
 * - Rolling window 5h: quota se recharge progressivement
 * - Daily cap: limite max journalière (reset 10h Paris)
 * - Weekly stats: pour dashboard parent
 */

import { useQuery } from '@tanstack/react-query';
import { getTokenUsage } from '@/lib/subscription';
import type { IUsageResponse, IWindowUsage, IDailyUsage, IWeeklyUsage } from '@/types';

interface UseTokenUsageOptions {
  userId: string | undefined;
  enabled?: boolean;
}

interface UseTokenUsageResult {
  /** Rolling window 5h - primary display */
  window: IWindowUsage | null;
  /** Daily cap (reset 10h Paris) - secondary */
  daily: IDailyUsage | null;
  /** Weekly stats for parent dashboard */
  weekly: IWeeklyUsage | null;
  /** User plan */
  plan: 'free' | 'premium';
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  isError: boolean;
  /** Error object */
  error: Error | null;
  /** Refetch function */
  refetch: () => void;
  /** Raw response for advanced usage */
  rawResponse: IUsageResponse | null;
}

/** Default window usage for initial state */
const DEFAULT_WINDOW_USAGE: IWindowUsage = {
  tokensUsed: 0,
  tokensRemaining: 5_000,
  limit: 5_000,
  usagePercent: 0,
  refreshIn: '5h 0min',
};

/** Default daily usage for initial state */
const DEFAULT_DAILY_USAGE: IDailyUsage = {
  tokensUsed: 0,
  tokensRemaining: 15_000,
  limit: 15_000,
  usagePercent: 0,
  resetsIn: '24h 0min',
};

/** Default weekly usage */
const DEFAULT_WEEKLY_USAGE: IWeeklyUsage = {
  tokensUsed: 0,
};

export function useTokenUsage({
  userId,
  enabled = true,
}: UseTokenUsageOptions): UseTokenUsageResult {
  const query = useQuery<IUsageResponse>({
    queryKey: ['tokenUsage', userId],
    queryFn: () => getTokenUsage(userId as string),
    enabled: enabled && !!userId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
    retry: 2,
  });

  // Return default values if no data yet
  if (!query.data) {
    return {
      window: query.isLoading ? null : DEFAULT_WINDOW_USAGE,
      daily: query.isLoading ? null : DEFAULT_DAILY_USAGE,
      weekly: query.isLoading ? null : DEFAULT_WEEKLY_USAGE,
      plan: 'free',
      isLoading: query.isLoading,
      isError: query.isError,
      error: query.error,
      refetch: query.refetch,
      rawResponse: null,
    };
  }

  return {
    window: query.data.window,
    daily: query.data.daily,
    weekly: query.data.weekly,
    plan: query.data.plan,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    rawResponse: query.data,
  };
}
