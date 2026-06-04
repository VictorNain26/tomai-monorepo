/**
 * useChildTokenUsage Hook
 *
 * Fetches token usage for a specific child (used in parent dashboard).
 * Mirrors useTokenUsage from web app but for parent viewing child stats.
 */

import { useQuery } from '@tanstack/react-query';
import { getTreaty, unwrap, type ResponseData } from '@repo/api';

// ============================================================================
// TYPES — derived from the server contract (single source of truth)
// ============================================================================

type SubscriptionApi = ReturnType<typeof getTreaty>['api']['subscriptions'];
type UsageResponse = ResponseData<SubscriptionApi['usage']['get']>;

// Convenience aliases for consumers
export type ChildWindowUsage = UsageResponse['window'];
export type ChildDailyUsage = UsageResponse['daily'];
export type ChildUsageResponse = UsageResponse;

// ============================================================================
// QUERY KEY
// ============================================================================

const queryKey = (childId: string) => ['subscription', 'usage', 'child', childId] as const;

// ============================================================================
// API FUNCTION
// ============================================================================

async function fetchChildUsage(childId: string): Promise<ChildUsageResponse> {
  return unwrap(
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
    plan: query.data?.plan ?? 'free',
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}

export default useChildTokenUsage;
