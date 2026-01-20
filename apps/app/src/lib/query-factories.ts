/**
 * TanStack Query Options - Tom 2026
 *
 * ARCHITECTURE BASÉE SUR LA DOCUMENTATION OFFICIELLE TanStack Query v5
 * https://tanstack.com/query/latest/docs/framework/react/guides/query-options
 *
 * PATTERN queryOptions (2025-2026) :
 * - Type-safe avec inference automatique
 * - Réutilisable entre useQuery et prefetchQuery
 * - Co-location des keys et fonctions
 * - `as const` obligatoire pour les queryKey
 */

import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { apiClient } from './api-client';
import { educationService } from './educationService';
import type {
  IChild,
  IDashboardStats,
  ICreateChildData,
  IDecksResponse,
  IDeckWithCardsResponse,
  IDeckResponse,
  ICardsResponse,
  ICardResponse,
  ICreateDeckRequest,
  ICreateCardRequest,
  ILearningDeck,
  CardContent,
  IGenerateDeckRequest,
  IGenerateDeckResponse,
  Lv2Option,
  EducationLevelType,
  RagLevel,
  ChaptersHierarchy,
} from '@/types';

// ===== QUERY KEYS (pour invalidation) =====

export const queryKeys = {
  parent: {
    all: ['parent'] as const,
    dashboard: () => [...queryKeys.parent.all, 'dashboard'] as const,
    children: () => [...queryKeys.parent.all, 'children'] as const,
    child: (childId: string) => [...queryKeys.parent.children(), childId] as const,
    childProgress: (childId: string, period?: string) =>
      [...queryKeys.parent.child(childId), 'progress', period] as const,
  },
  chat: {
    all: ['chat'] as const,
    latest: () => [...queryKeys.chat.all, 'latest'] as const,
  },
  files: {
    all: ['files'] as const,
  },
  learning: {
    all: ['learning'] as const,
    decks: () => [...queryKeys.learning.all, 'decks'] as const,
    deck: (deckId: string) => [...queryKeys.learning.decks(), deckId] as const,
    deckWithCards: (deckId: string) => [...queryKeys.learning.deck(deckId), 'cards'] as const,
  },
  education: {
    all: ['education'] as const,
    subjects: (level: EducationLevelType, selectedLv2?: Lv2Option | null) =>
      [...queryKeys.education.all, 'subjects', level, selectedLv2 ?? 'no-lv2'] as const,
    levels: () => [...queryKeys.education.all, 'levels'] as const,
    chapters: (niveau: EducationLevelType, matiere: string) =>
      [...queryKeys.education.all, 'chapters', niveau, matiere] as const,
  },
} as const;

// ===== PARENT QUERY OPTIONS =====

export const parentDashboardQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.parent.dashboard(),
    queryFn: (): Promise<IDashboardStats & { children?: IChild[] }> =>
      apiClient.get('/api/parent/dashboard'),
  });

export const parentChildrenQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.parent.children(),
    queryFn: (): Promise<IChild[]> => apiClient.get('/api/parent/children'),
  });

export const parentChildQueryOptions = (childId: string) =>
  queryOptions({
    queryKey: queryKeys.parent.child(childId),
    queryFn: (): Promise<IChild> => apiClient.get(`/api/parent/children/${childId}`),
    enabled: childId !== '',
  });

export const parentChildProgressQueryOptions = (childId: string, period?: 'week' | 'month' | 'year') =>
  queryOptions({
    queryKey: queryKeys.parent.childProgress(childId, period),
    queryFn: () =>
      apiClient.get(`/api/parent/children/${childId}/progress`, period ? { params: { period } } : {}),
    enabled: childId !== '',
  });

// ===== PARENT MUTATIONS =====

export const parentMutations = {
  createChild: () => ({
    mutationKey: ['parent', 'create-child'] as const,
    mutationFn: (childData: ICreateChildData) => apiClient.post('/api/parent/children', childData),
  }),
  updateChild: () => ({
    mutationKey: ['parent', 'update-child'] as const,
    mutationFn: ({ childId, data }: { childId: string; data: Partial<IChild> }) =>
      apiClient.patch(`/api/parent/children/${childId}`, data),
  }),
  deleteChild: () => ({
    mutationKey: ['parent', 'delete-child'] as const,
    mutationFn: (childId: string) => apiClient.delete(`/api/parent/children/${childId}`),
  }),
};

// ===== CHAT QUERY OPTIONS =====

interface LatestSession {
  id: string;
  subject: string;
  startedAt: string;
  endedAt?: string;
  messagesCount: number;
}

export const chatLatestSessionQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.chat.latest(),
    queryFn: async (): Promise<LatestSession | null> => {
      const response = await apiClient.get<{ session: LatestSession | null }>(
        '/api/chat/sessions/latest'
      );
      return response.session;
    },
  });

// ===== FILE MUTATIONS =====

export const fileMutations = {
  delete: () => ({
    mutationKey: ['files', 'delete'] as const,
    mutationFn: (fileId: string) => apiClient.delete(`/api/upload/file/${fileId}`),
  }),
};

// ===== LEARNING QUERY OPTIONS =====

export const learningDecksQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.learning.decks(),
    queryFn: (): Promise<IDecksResponse> => apiClient.get('/api/learning/decks'),
  });

export const learningDeckWithCardsQueryOptions = (deckId: string) =>
  queryOptions({
    queryKey: queryKeys.learning.deckWithCards(deckId),
    queryFn: (): Promise<IDeckWithCardsResponse> => apiClient.get(`/api/learning/decks/${deckId}`),
    enabled: deckId !== '',
  });

// ===== LEARNING MUTATIONS =====

export const learningMutations = {
  createDeck: () => ({
    mutationKey: ['learning', 'create-deck'] as const,
    mutationFn: (data: ICreateDeckRequest): Promise<IDeckResponse> =>
      apiClient.post('/api/learning/decks', data),
  }),
  updateDeck: () => ({
    mutationKey: ['learning', 'update-deck'] as const,
    mutationFn: ({
      deckId,
      data,
    }: {
      deckId: string;
      data: Partial<Pick<ILearningDeck, 'title' | 'description' | 'subject'>>;
    }): Promise<IDeckResponse> => apiClient.patch(`/api/learning/decks/${deckId}`, data),
  }),
  deleteDeck: () => ({
    mutationKey: ['learning', 'delete-deck'] as const,
    mutationFn: (deckId: string): Promise<{ success: boolean }> =>
      apiClient.delete(`/api/learning/decks/${deckId}`),
  }),
  addCards: () => ({
    mutationKey: ['learning', 'add-cards'] as const,
    mutationFn: ({
      deckId,
      cards,
    }: {
      deckId: string;
      cards: ICreateCardRequest[];
    }): Promise<ICardsResponse> => apiClient.post(`/api/learning/decks/${deckId}/cards`, { cards }),
  }),
  updateCard: () => ({
    mutationKey: ['learning', 'update-card'] as const,
    mutationFn: ({
      cardId,
      data,
    }: {
      cardId: string;
      data: { content?: CardContent; position?: number; fsrsData?: Record<string, unknown> };
    }): Promise<ICardResponse> => apiClient.patch(`/api/learning/cards/${cardId}`, data),
  }),
  deleteCard: () => ({
    mutationKey: ['learning', 'delete-card'] as const,
    mutationFn: (cardId: string): Promise<{ success: boolean }> =>
      apiClient.delete(`/api/learning/cards/${cardId}`),
  }),
  generateDeck: () => ({
    mutationKey: ['learning', 'generate-deck'] as const,
    mutationFn: (data: IGenerateDeckRequest): Promise<IGenerateDeckResponse> =>
      apiClient.post('/api/learning/generate', data),
  }),
};

// ===== EDUCATION TYPES =====

export interface IEducationSubject {
  key: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  ragKeywords: string[];
  ragAvailable: boolean;
}

export interface IEducationSubjectsResponse {
  success: boolean;
  subjects: IEducationSubject[];
  level: string;
  selectedLv2: Lv2Option | null;
  message?: string;
}

export interface IEducationLevelsResponse {
  success: boolean;
  levels: RagLevel[];
  total: number;
  ragAvailableCount: number;
}

// ===== EDUCATION QUERY OPTIONS =====

export const educationLevelsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.education.levels(),
    queryFn: (): Promise<IEducationLevelsResponse> => apiClient.get('/api/education/levels'),
    staleTime: 5 * 60 * 1000,
  });

export const educationSubjectsQueryOptions = (level: EducationLevelType, selectedLv2?: Lv2Option | null) =>
  queryOptions({
    queryKey: queryKeys.education.subjects(level, selectedLv2),
    queryFn: async (): Promise<IEducationSubjectsResponse> => {
      const config = await educationService.getLevelConfiguration(level, selectedLv2);
      return {
        success: true,
        level: config.level,
        selectedLv2: config.selectedLv2 ?? null,
        subjects: config.subjects.map((s) => ({ ...s, ragAvailable: true })),
      };
    },
  });

export const educationChaptersQueryOptions = (niveau: EducationLevelType, matiere: string) =>
  queryOptions({
    queryKey: queryKeys.education.chapters(niveau, matiere),
    queryFn: (): Promise<ChaptersHierarchy> =>
      apiClient.get('/api/learning/chapters', { params: { niveau, matiere } }),
    enabled: matiere !== '' && niveau !== undefined,
    staleTime: 5 * 60 * 1000,
  });

// ===== LEGACY EXPORTS (rétrocompatibilité temporaire) =====
// TODO: Migrer tous les usages vers les nouvelles fonctions queryOptions

export const parentQueries = {
  dashboard: parentDashboardQueryOptions,
  children: parentChildrenQueryOptions,
  child: parentChildQueryOptions,
  childProgress: parentChildProgressQueryOptions,
};

export const chatQueries = {
  latestSession: chatLatestSessionQueryOptions,
};

export const learningQueries = {
  decks: learningDecksQueryOptions,
  deckWithCards: learningDeckWithCardsQueryOptions,
};

export const educationQueries = {
  levels: educationLevelsQueryOptions,
  subjectsForLevel: educationSubjectsQueryOptions,
  chaptersForSubject: educationChaptersQueryOptions,
};

// ===== INVALIDATION HELPERS =====

export const invalidationHelpers = {
  invalidateParentData: (queryClient: QueryClient) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.parent.dashboard() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.parent.children() });
    void queryClient.invalidateQueries({ queryKey: ['education', 'subjects'] });
  },

  invalidateChildData: (queryClient: QueryClient, childId: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.parent.child(childId) });
    void queryClient.invalidateQueries({ queryKey: ['childProgress', childId] });
  },

  invalidateStudentData: (queryClient: QueryClient) => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.chat.latest(),
      refetchType: 'none',
    });
  },

  invalidateFileData: (queryClient: QueryClient) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.files.all });
  },

  invalidateLearningData: (queryClient: QueryClient, deckId?: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.learning.decks() });
    if (deckId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.learning.deckWithCards(deckId) });
    }
  },

  invalidateAfterActivity: (queryClient: QueryClient) => {
    invalidationHelpers.invalidateStudentData(queryClient);
  },
};
