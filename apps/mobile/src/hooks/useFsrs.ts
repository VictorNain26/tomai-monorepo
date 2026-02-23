/**
 * useFsrs Hook
 *
 * FSRS (Free Spaced Repetition Scheduler) hooks for review sessions.
 * Connects to server endpoints: /api/learning/review, /due, /stats
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@repo/api';

// ============================================================================
// TYPES (aligned with server fsrs.routes.ts)
// ============================================================================

/** FSRS card states */
export type FSRSState = 'New' | 'Learning' | 'Review' | 'Relearning';

/** Rating: 1=Again, 2=Hard, 3=Good, 4=Easy */
export type FSRSRating = 1 | 2 | 3 | 4;

/** Due card from GET /api/learning/decks/:id/due */
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

/** Review result from POST /api/learning/review */
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

interface ReviewResponse {
  success: boolean;
  result: ReviewResult;
}

/** Deck stats from GET /api/learning/decks/:id/stats */
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

interface StatsResponse {
  stats: DeckStats;
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
  return apiClient.get<DueCardsResponse>(`/api/learning/decks/${deckId}/due`);
}

async function reviewCard(data: {
  cardId: string;
  rating: FSRSRating;
}): Promise<ReviewResult> {
  const response = await apiClient.post<ReviewResponse>(
    '/api/learning/review',
    data
  );
  return response.result;
}

async function fetchDeckStats(deckId: string): Promise<DeckStats> {
  const response = await apiClient.get<StatsResponse>(
    `/api/learning/decks/${deckId}/stats`
  );
  return response.stats;
}


// ============================================================================
// HOOKS
// ============================================================================

/** Fetch due cards for a deck (sorted by urgency) */
export function useDueCards(deckId: string) {
  return useQuery({
    queryKey: fsrsQueryKeys.dueCards(deckId),
    queryFn: () => fetchDueCards(deckId),
    enabled: !!deckId,
    staleTime: 30 * 1000, // 30s - due cards change after reviews
  });
}

/** Submit a card review (FSRS rating) */
export function useReviewCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reviewCard,
    onSuccess: () => {
      // Invalidate all due card and stats queries after a review
      void queryClient.invalidateQueries({ queryKey: ['fsrs', 'due'] });
      void queryClient.invalidateQueries({ queryKey: ['fsrs', 'stats'] });
    },
  });
}

/** Fetch deck review statistics */
export function useDeckStats(deckId: string) {
  return useQuery({
    queryKey: fsrsQueryKeys.stats(deckId),
    queryFn: () => fetchDeckStats(deckId),
    enabled: !!deckId,
    staleTime: 60 * 1000,
  });
}

