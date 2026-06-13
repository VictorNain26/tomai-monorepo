/**
 * useFsrs Hook
 *
 * FSRS (Free Spaced Repetition Scheduler) hooks for review sessions.
 * Connects to server endpoints: /api/learning/review, /due, /stats
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTreaty, unwrap, type ResponseData } from '@repo/api';

// ============================================================================
// TYPES — derived from the server contract (single source of truth)
// ============================================================================

type LearningApi = ReturnType<typeof getTreaty>['api']['learning'];
type DeckById = ReturnType<LearningApi['decks']>;

export type ReviewResult = ResponseData<LearningApi['review']['post']>['result'];
type DeckStats = ResponseData<DeckById['stats']['get']>['stats'];

type DueCardsResponse = ResponseData<DeckById['due']['get']>;

// ============================================================================
// QUERY KEY
// ============================================================================

export type FSRSRating = 1 | 2 | 3 | 4;

// ============================================================================
// QUERY KEYS
// ============================================================================

const fsrsQueryKeys = {
  dueCards: (deckId: string) => ['fsrs', 'due', deckId] as const,
  stats: (deckId: string) => ['fsrs', 'stats', deckId] as const,
};

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function fetchDueCards(deckId: string): Promise<DueCardsResponse> {
  return unwrap(
    await getTreaty().api.learning.decks({ id: deckId }).due.get()
  );
}

async function reviewCard(data: {
  cardId: string;
  rating: FSRSRating;
}): Promise<ReviewResult> {
  const { result } = unwrap(
    await getTreaty().api.learning.review.post(data)
  );
  return result;
}

async function fetchDeckStats(deckId: string): Promise<DeckStats> {
  const { stats } = unwrap(
    await getTreaty().api.learning.decks({ id: deckId }).stats.get()
  );
  return stats;
}

// ============================================================================
// HOOKS
// ============================================================================

export function useDueCards(deckId: string) {
  return useQuery({
    queryKey: fsrsQueryKeys.dueCards(deckId),
    queryFn: () => fetchDueCards(deckId),
    enabled: !!deckId,
    staleTime: 30 * 1000,
  });
}

export function useReviewCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reviewCard,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['fsrs', 'due'] });
      void queryClient.invalidateQueries({ queryKey: ['fsrs', 'stats'] });
      void queryClient.invalidateQueries({ queryKey: ['learning', 'due-summary'] });
    },
  });
}

export function useDeckStats(deckId: string) {
  return useQuery({
    queryKey: fsrsQueryKeys.stats(deckId),
    queryFn: () => fetchDeckStats(deckId),
    enabled: !!deckId,
    staleTime: 60 * 1000,
  });
}
