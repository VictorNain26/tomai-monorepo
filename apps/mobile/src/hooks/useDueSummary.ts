/**
 * useDueSummary Hook
 *
 * Fetches total due cards count across all decks for the current user.
 * Used by dashboard ResumeCard, Learning tab badge, and Tom's contextual message.
 */

import { useQuery } from '@tanstack/react-query';
import { getTreaty, unwrap } from '@repo/api';

export function useDueSummary() {
  return useQuery({
    queryKey: ['learning', 'due-summary'] as const,
    queryFn: async () => {
      return unwrap(await getTreaty().api.learning['due-summary'].get());
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
