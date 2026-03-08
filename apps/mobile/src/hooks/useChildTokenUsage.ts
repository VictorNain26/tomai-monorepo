/**
 * useChildTokenUsage Hook
 *
 * Fetches token usage for a specific child (used in parent dashboard).
 * Mirrors useTokenUsage from web app but for parent viewing child stats.
 */

import { useQuery } from '@tanstack/react-query';
import { getTreaty, unwrap } from '@repo/api';

// ============================================================================
// TYPES
// ============================================================================

export interface ChildWindowUsage {
  tokensUsed: number;
  tokensRemaining: number;
  limit: number;
  usagePercent: number;
  refreshIn: string;
}

export interface ChildDailyUsage {
  tokensUsed: number;
  tokensRemaining: number;
  limit: number;
  usagePercent: number;
  resetsIn: string;
}

export interface ChildWeeklyUsage {
  tokensUsed: number;
}

export interface ChildUsageResponse {
  userId: string;
  plan: 'free' | 'premium';
  window: ChildWindowUsage;
  daily: ChildDailyUsage;
  weekly: ChildWeeklyUsage;
}

// ============================================================================
// QUERY KEY
// ============================================================================

const queryKey = (childId: string) => ['subscription', 'usage', childId] as const;

// ============================================================================
// API FUNCTION
// ============================================================================

async function fetchChildUsage(childId: string): Promise<ChildUsageResponse> {
  return unwrap<ChildUsageResponse>(
    await getTreaty().api.subscriptions.usage.get({ query: { userId: childId } })
  );
}

// ============================================================================
// HOOK
// ============================================================================

interface UseChildTokenUsageOptions {
  childId: string | undefined;
  enabled?: boolean;
}

export function useChildTokenUsage({ childId, enabled = true }: UseChildTokenUsageOptions) {
  const query = useQuery({
    queryKey: queryKey(childId ?? ''),
    queryFn: () => fetchChildUsage(childId as string),
    enabled: enabled && !!childId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  return {
    window: query.data?.window ?? null,
    daily: query.data?.daily ?? null,
    weekly: query.data?.weekly ?? null,
    plan: query.data?.plan ?? 'free',
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}

export default useChildTokenUsage;
