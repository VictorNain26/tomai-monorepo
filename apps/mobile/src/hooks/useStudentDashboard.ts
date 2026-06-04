/**
 * useStudentDashboard Hook
 *
 * Fetches subjects, token usage, and recent sessions for student dashboard.
 * Subject metadata (name, description, emoji, color) is enriched client-side
 * since backend RAG only returns { key, ragAvailable }.
 */

import { useQuery } from '@tanstack/react-query';
import { getTreaty, unwrap, type ResponseData } from '@repo/api';
import { useUser } from '@/lib/auth';

// ============================================================================
// TYPES — derived from the server contract (single source of truth)
// ============================================================================

type SubscriptionApi = ReturnType<typeof getTreaty>['api']['subscriptions'];
export type TokenUsage = ResponseData<SubscriptionApi['usage']['get']>;

// ============================================================================
// QUERY KEYS
// ============================================================================

const queryKeys = {
  usage: (userId: string) => ['subscription', 'usage', userId] as const,
};

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function fetchTokenUsage(userId: string): Promise<TokenUsage> {
  return unwrap(
    await getTreaty().api.subscriptions.usage.get({ query: { userId } })
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useStudentDashboard() {
  const user = useUser();
  const userId = user?.id ?? '';
  const schoolLevel = user?.schoolLevel ?? 'sixieme';

  const usageQuery = useQuery({
    queryKey: queryKeys.usage(userId),
    queryFn: () => fetchTokenUsage(userId),
    enabled: !!userId,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  return {
    usage: usageQuery.data ?? null,
    isLoadingUsage: usageQuery.isLoading,
    usageError: usageQuery.error?.message ?? null,

    userName: user?.name?.split(' ')[0] ?? 'Élève',
    schoolLevel,
  };
}
