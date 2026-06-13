/**
 * useLearning Hook
 *
 * Handles learning decks: list, get, delete, create, AI generation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTreaty, unwrap, type ResponseData } from '@repo/api';

// ============================================================================
// TYPES — derived from the server contract (single source of truth)
// ============================================================================

type LearningApi = ReturnType<typeof getTreaty>['api']['learning'];
type DeckById = ReturnType<LearningApi['decks']>;

export type LearningDeck = ResponseData<LearningApi['decks']['get']>['decks'][number];
export type LearningCard = ResponseData<DeckById['get']>['cards'][number];
export type CardType = LearningCard['cardType'];
export type GenerateDeckRequest = NonNullable<Parameters<LearningApi['generate']['post']>[0]>;
export type GenerateDeckResponse = ResponseData<LearningApi['generate']['post']>;

export type LearningSubject = ResponseData<LearningApi['subjects']['get']>['subjects'][number];
type LearningDomaine = ResponseData<LearningApi['topics']['get']>['domaines'][number];

/** School level accepted by the discovery endpoints (from the contract). */
type LevelQuery = NonNullable<Parameters<LearningApi['subjects']['get']>[0]>['query'];
export type SchoolLevel = NonNullable<LevelQuery>['niveau'];

// ============================================================================
// QUERY KEYS
// ============================================================================

const queryKeys = {
  decks: ['learning', 'decks'] as const,
  deck: (id: string) => ['learning', 'deck', id] as const,
};

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function fetchDecks(): Promise<LearningDeck[]> {
  const { decks } = unwrap(await getTreaty().api.learning.decks.get());
  return decks;
}

async function fetchDeck(id: string): Promise<{ deck: LearningDeck; cards: LearningCard[] }> {
  const { deck, cards } = unwrap(await getTreaty().api.learning.decks({ id }).get());
  return { deck, cards };
}

async function deleteDeck(id: string): Promise<void> {
  unwrap(await getTreaty().api.learning.decks({ id }).delete());
}

async function fetchSubjects(niveau: SchoolLevel): Promise<LearningSubject[]> {
  const { subjects } = unwrap(
    await getTreaty().api.learning.subjects.get({ query: { niveau } })
  );
  return subjects;
}

async function fetchTopics(matiere: string, niveau: SchoolLevel): Promise<LearningDomaine[]> {
  const { domaines } = unwrap(
    await getTreaty().api.learning.topics.get({ query: { matiere, niveau } })
  );
  return domaines;
}

async function generateDeck(data: GenerateDeckRequest): Promise<GenerateDeckResponse> {
  return unwrap(await getTreaty().api.learning.generate.post(data));
}

// ============================================================================
// HOOKS
// ============================================================================

export function useDecks() {
  return useQuery({
    queryKey: queryKeys.decks,
    queryFn: fetchDecks,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDeck(id: string) {
  return useQuery({
    queryKey: queryKeys.deck(id),
    queryFn: () => fetchDeck(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

function useDeleteDeck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDeck,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks });
    },
  });
}

export function useLearningSubjects(niveau: SchoolLevel) {
  return useQuery({
    queryKey: ['learning', 'subjects', niveau] as const,
    queryFn: () => fetchSubjects(niveau),
    enabled: !!niveau,
    staleTime: 10 * 60 * 1000,
  });
}

export function useLearningTopics(matiere: string, niveau: SchoolLevel) {
  return useQuery({
    queryKey: ['learning', 'topics', matiere, niveau] as const,
    queryFn: () => fetchTopics(matiere, niveau),
    enabled: !!matiere && !!niveau,
    staleTime: 10 * 60 * 1000,
  });
}

export function useGenerateDeck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateDeck,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks });
    },
  });
}

// ============================================================================
// COMBINED HOOK
// ============================================================================

export function useLearning() {
  const decksQuery = useDecks();
  const deleteMutation = useDeleteDeck();

  return {
    decks: decksQuery.data ?? [],
    isLoading: decksQuery.isLoading,
    error: decksQuery.error?.message ?? null,
    refetch: decksQuery.refetch,

    deleteDeck: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
