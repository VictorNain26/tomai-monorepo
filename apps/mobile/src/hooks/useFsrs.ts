/**
 * useFsrs Hook
 *
 * FSRS (Free Spaced Repetition Scheduler) hooks for review sessions.
 * Connects to server endpoints: /api/learning/review, /due, /stats
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTreaty, unwrap } from '@repo/api';

// ============================================================================
// TYPES (aligned with server fsrs.routes.ts)
// ============================================================================

export type FSRSState = 'New' | 'Learning' | 'Review' | 'Relearning';

export type FSRSRating = 1 | 2 | 3 | 4;

export interface DueCard {
  id: string;
  deckId: string;
  cardType: string;
  content: Record<string, unknown>;
  position: number;
  overdue: boolean;
}

interface DueCardsResponse {
  cards: DueCard[];
  count: number;
  overdueCount: number;
  sessionConfig: {
    recommendedCards: number;
    sessionMinutes: number;
    level: string;
  };
}

export interface ReviewResult {
  cardId: string;
  rating: number;
  previousState: FSRSState;
  newState: FSRSState;
  nextDue: string;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
}

export interface DeckStats {
  deckId: string;
  totalCards: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  relearningCards: number;
  dueToday: number;
  overdueCards: number;
  averageDifficulty: number;
  averageStability: number;
}

// ============================================================================
// QUERY KEYS
// ============================================================================

export const fsrsQueryKeys = {
  dueCards: (deckId: string) => ['fsrs', 'due', deckId] as const,
  stats: (deckId: string) => ['fsrs', 'stats', deckId] as const,
};

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function fetchDueCards(deckId: string): Promise<DueCardsResponse> {
  return unwrap(
    await getTreaty().api.learning.decks({ id: deckId }).due.get()
  ) as DueCardsResponse;
}

async function reviewCard(data: {
  cardId: string;
  rating: FSRSRating;
}): Promise<ReviewResult> {
  const response = unwrap(
    await getTreaty().api.learning.review.post(data)
  );
  return (response as unknown as { result: ReviewResult }).result;
}

async function fetchDeckStats(deckId: string): Promise<DeckStats> {
  const response = unwrap(
    await getTreaty().api.learning.decks({ id: deckId }).stats.get()
  );
  return (response as { stats: DeckStats }).stats;
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
