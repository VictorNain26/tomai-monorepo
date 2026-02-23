/**
 * useDueSummary Hook
 *
 * Fetches total due cards count across all decks for the current user.
 * Used by dashboard ResumeCard, Learning tab badge, and Tom's contextual message.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@repo/api';

interface DueSummaryResponse {
  success: boolean;
  totalDue: number;
}

export function useDueSummary() {
  return useQuery({
    queryKey: ['learning', 'due-summary'] as const,
    queryFn: async () => {
      const response = await apiClient.get<DueSummaryResponse>(
        '/api/learning/due-summary'
      );
      return response;
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
