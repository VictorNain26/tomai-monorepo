/**
 * useLearning Hook
 *
 * Handles learning decks: list, get, delete.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTreaty, unwrap } from '@repo/api';

// ============================================================================
// TYPES (aligned with backend apps/server/src/db/schema.ts)
// ============================================================================

export type DeckSource = 'prompt' | 'conversation' | 'document' | 'rag_program';

export interface LearningDeck {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  subject: string;
  source: DeckSource;
  sourceId: string | null;
  sourcePrompt: string | null;
  schoolLevel: string | null;
  cardCount: number;
  createdAt: string;
  updatedAt: string;
}

export type CardType =
  | 'concept'
  | 'flashcard'
  | 'qcm'
  | 'vrai_faux'
  | 'matching'
  | 'fill_blank'
  | 'word_order'
  | 'calculation'
  | 'timeline'
  | 'matching_era'
  | 'cause_effect'
  | 'classification'
  | 'process_order'
  | 'grammar_transform';

export interface LearningCard {
  id: string;
  deckId: string;
  cardType: CardType;
  content: Record<string, unknown>;
  position: number;
  fsrsData: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

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
  const response = unwrap(await getTreaty().api.learning.decks.get());
  return (response as { decks: LearningDeck[] }).decks;
}

async function fetchDeck(
  id: string
): Promise<{ deck: LearningDeck; cards: LearningCard[] }> {
  return unwrap(
    await getTreaty().api.learning.decks({ id }).get()
  ) as { deck: LearningDeck; cards: LearningCard[] };
}

async function deleteDeck(id: string): Promise<void> {
  unwrap(await getTreaty().api.learning.decks({ id }).delete());
}

export interface CreateDeckRequest {
  title: string;
  description?: string;
  subject: string;
  source: DeckSource;
  sourceId?: string;
  sourcePrompt?: string;
  schoolLevel?: string;
}

async function createDeck(data: CreateDeckRequest): Promise<LearningDeck> {
  const response = unwrap(
    await getTreaty().api.learning.decks.post(data)
  );
  return (response as { deck: LearningDeck }).deck;
}

export interface LearningSubject {
  id: string;
  label: string;
}

async function fetchSubjects(niveau: string): Promise<LearningSubject[]> {
  const response = unwrap(
    await getTreaty().api.learning.subjects.get({ query: { niveau: niveau as 'cp' } })
  );
  return (response as { subjects: LearningSubject[] }).subjects;
}

export interface LearningDomaine {
  domaine: string;
  themes: string[];
}

async function fetchTopics(
  matiere: string,
  niveau: string
): Promise<LearningDomaine[]> {
  const response = unwrap(
    await getTreaty().api.learning.topics.get({
      query: { matiere, niveau: niveau as 'cp' },
    })
  );
  return (response as { domaines: LearningDomaine[] }).domaines;
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

export function useDeleteDeck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDeck,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks });
    },
  });
}

export function useCreateDeck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDeck,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks });
    },
  });
}

export function useLearningSubjects(niveau: string) {
  return useQuery({
    queryKey: ['learning', 'subjects', niveau] as const,
    queryFn: () => fetchSubjects(niveau),
    enabled: !!niveau,
    staleTime: 10 * 60 * 1000,
  });
}

export function useLearningTopics(matiere: string, niveau: string) {
  return useQuery({
    queryKey: ['learning', 'topics', matiere, niveau] as const,
    queryFn: () => fetchTopics(matiere, niveau),
    enabled: !!matiere && !!niveau,
    staleTime: 10 * 60 * 1000,
  });
}

// ============================================================================
// GENERATE DECK (AI)
// ============================================================================

export interface GenerateDeckRequest {
  subject: string;
  domaine: string;
  topic?: string;
}

export interface GenerateDeckResponse {
  deck: LearningDeck;
  cards: LearningCard[];
  metadata: {
    ragStrategy: string;
    tokensUsed: number;
  };
}

async function generateDeck(data: GenerateDeckRequest): Promise<GenerateDeckResponse> {
  return unwrap(
    await getTreaty().api.learning.generate.post(data)
  ) as GenerateDeckResponse;
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
