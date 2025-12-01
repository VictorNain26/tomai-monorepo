/**
 * useTokenUsage - React Query hook for fetching token usage
 *
 * Fetches daily token usage for a user (student or child).
 * Automatically refetches every minute to keep usage updated.
 */

import { useQuery } from '@tanstack/react-query';
import { getTokenUsage, FREE_DAILY_TOKENS, PREMIUM_DAILY_TOKENS } from '@/lib/subscription';
import type { IUsageResponse, ITokenUsage } from '@/types';

interface UseTokenUsageOptions {
  userId: string | undefined;
  enabled?: boolean;
}

interface UseTokenUsageResult {
  usage: ITokenUsage | null;
  plan: 'free' | 'premium';
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Default usage for when API fails or user has no subscription record
 */
const DEFAULT_FREE_USAGE: ITokenUsage = {
  tokensUsed: 0,
  tokensRemaining: FREE_DAILY_TOKENS,
  dailyLimit: FREE_DAILY_TOKENS,
  usagePercentage: 0,
  lastResetAt: new Date().toISOString(),
  resetsIn: '24h',
};

export function useTokenUsage({
  userId,
  enabled = true,
}: UseTokenUsageOptions): UseTokenUsageResult {
  const query = useQuery<IUsageResponse>({
    queryKey: ['tokenUsage', userId],
    queryFn: () => getTokenUsage(userId!),
    enabled: enabled && !!userId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
    retry: 2,
  });

  // Return default free usage if no data yet or error
  if (!query.data) {
    return {
      usage: query.isLoading ? null : DEFAULT_FREE_USAGE,
      plan: 'free',
      isLoading: query.isLoading,
      isError: query.isError,
      error: query.error,
      refetch: query.refetch,
    };
  }

  return {
    usage: query.data.usage,
    plan: query.data.plan,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
