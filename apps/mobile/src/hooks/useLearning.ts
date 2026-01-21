/**
 * useLearning Hook
 *
 * Handles learning decks: list, get, delete.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@repo/api';

// ============================================================================
// TYPES (aligned with backend apps/server/src/db/schema.ts)
// ============================================================================

/** Backend deckSourceEnum */
export type DeckSource = 'prompt' | 'conversation' | 'document' | 'rag_program';

/** Backend LearningDeck from schema.ts (JSON serialized) */
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
  createdAt: string; // ISO string (timestamp with timezone)
  updatedAt: string; // ISO string (timestamp with timezone)
}

/** Backend cardTypeEnum */
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

/** Backend LearningCard from schema.ts (JSON serialized) */
export interface LearningCard {
  id: string;
  deckId: string;
  cardType: CardType;
  content: Record<string, unknown>;
  position: number;
  fsrsData: Record<string, unknown> | null; // FSRS algorithm data
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

interface DecksResponse {
  decks: LearningDeck[];
  count: number;
}

interface DeckDetailResponse {
  deck: LearningDeck;
  cards: LearningCard[];
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
  const response = await apiClient.get<DecksResponse>('/api/learning/decks');
  return response.decks;
}

async function fetchDeck(
  id: string
): Promise<{ deck: LearningDeck; cards: LearningCard[] }> {
  return apiClient.get<DeckDetailResponse>(`/api/learning/decks/${id}`);
}

async function deleteDeck(id: string): Promise<void> {
  await apiClient.delete(`/api/learning/decks/${id}`);
}

/** Create deck request - aligned with POST /api/learning/decks body */
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
  const response = await apiClient.post<{ deck: LearningDeck }>(
    '/api/learning/decks',
    data
  );
  return response.deck;
}

/** Subject from /api/learning/subjects */
export interface LearningSubject {
  id: string;
  label: string;
}

interface SubjectsResponse {
  niveau: string;
  subjects: LearningSubject[];
}

async function fetchSubjects(niveau: string): Promise<LearningSubject[]> {
  const response = await apiClient.get<SubjectsResponse>(
    '/api/learning/subjects',
    { params: { niveau } }
  );
  return response.subjects;
}

/** Topic from /api/learning/topics */
export interface LearningDomaine {
  domaine: string;
  themes: string[];
}

interface TopicsResponse {
  matiere: string;
  niveau: string;
  domaines: LearningDomaine[];
  totalTopics: number;
}

async function fetchTopics(
  matiere: string,
  niveau: string
): Promise<LearningDomaine[]> {
  const response = await apiClient.get<TopicsResponse>('/api/learning/topics', {
    params: { matiere, niveau },
  });
  return response.domaines;
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
    staleTime: 10 * 60 * 1000, // 10 minutes (rarely changes)
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

/** Generate deck request - aligned with POST /api/learning/generate */
export interface GenerateDeckRequest {
  subject: string;
  domaine: string;
  topic?: string;
}

/** Generate deck response */
export interface GenerateDeckResponse {
  deck: LearningDeck;
  cards: LearningCard[];
  metadata: {
    ragStrategy: string;
    tokensUsed: number;
  };
}

async function generateDeck(data: GenerateDeckRequest): Promise<GenerateDeckResponse> {
  return apiClient.post<GenerateDeckResponse>('/api/learning/generate', data);
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
