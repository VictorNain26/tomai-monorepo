/**
 * @repo/api - Query Factories TanStack Query 5
 *
 * Factories platform-agnostic pour Web et Mobile.
 * Pattern recommandé par la documentation officielle.
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/query-keys
 */

import { apiClient } from '../client';
import { queryKeys } from './keys';
import type { QueryClient } from '@tanstack/react-query';
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
  ILearningDeck,
  CardContent,
  IGenerateDeckRequest,
  IGenerateDeckResponse,
  IEducationSubjectsResponse,
  ITopicsResponse,
  EducationLevelType,
  Lv2Option,
  IChatSession,
} from './types';

// Re-export types and keys
export * from './types';
export { queryKeys } from './keys';

// ============================================================================
// PARENT QUERIES
// ============================================================================

export const parentQueries = {
  dashboard: () => ({
    queryKey: queryKeys.parent.dashboard(),
    queryFn: (): Promise<IDashboardStats & { children?: IChild[] }> =>
      apiClient.get('/api/parent/dashboard'),
  }),

  children: () => ({
    queryKey: queryKeys.parent.children(),
    queryFn: (): Promise<IChild[]> => apiClient.get('/api/parent/children'),
  }),

  child: (childId: string) => ({
    queryKey: queryKeys.parent.child(childId),
    queryFn: (): Promise<IChild> =>
      apiClient.get(`/api/parent/children/${childId}`),
  }),

  childProgress: (childId: string, period?: 'week' | 'month' | 'year') => ({
    queryKey: queryKeys.parent.childProgress(childId, period),
    queryFn: () =>
      apiClient.get(
        `/api/parent/children/${childId}/progress`,
        period ? { params: { period } } : {}
      ),
  }),
};

export const parentMutations = {
  createChild: () => ({
    mutationKey: ['parent', 'create-child'] as const,
    mutationFn: (childData: ICreateChildData) =>
      apiClient.post('/api/parent/children', childData),
  }),

  updateChild: () => ({
    mutationKey: ['parent', 'update-child'] as const,
    mutationFn: ({
      childId,
      data,
    }: {
      childId: string;
      data: Partial<IChild>;
    }) => apiClient.patch(`/api/parent/children/${childId}`, data),
  }),

  deleteChild: () => ({
    mutationKey: ['parent', 'delete-child'] as const,
    mutationFn: (childId: string) =>
      apiClient.delete(`/api/parent/children/${childId}`),
  }),
};

// ============================================================================
// CHAT QUERIES
// ============================================================================

export const chatQueries = {
  sessions: (limit = 20) => ({
    queryKey: queryKeys.chat.sessions(limit),
    queryFn: async (): Promise<IChatSession[]> => {
      const response = await apiClient.get<{ sessions: IChatSession[] }>(
        '/api/chat/sessions',
        { params: { limit } }
      );
      return response.sessions ?? [];
    },
  }),

  latestSession: () => ({
    queryKey: queryKeys.chat.latest(),
    queryFn: async (): Promise<IChatSession | null> => {
      const response = await apiClient.get<{ session: IChatSession | null }>(
        '/api/chat/sessions/latest'
      );
      return response.session;
    },
  }),

  session: (sessionId: string) => ({
    queryKey: queryKeys.chat.session(sessionId),
    queryFn: () => apiClient.get(`/api/chat/session/${sessionId}`),
  }),
};

export const chatMutations = {
  createSession: () => ({
    mutationKey: ['chat', 'create-session'] as const,
    mutationFn: (data: { subject: string }) =>
      apiClient.post('/api/chat/session', data),
  }),

  deleteSession: () => ({
    mutationKey: ['chat', 'delete-session'] as const,
    mutationFn: (sessionId: string) =>
      apiClient.delete(`/api/chat/session/${sessionId}`),
  }),
};

// ============================================================================
// FILE MUTATIONS
// ============================================================================

export const fileMutations = {
  upload: () => ({
    mutationKey: ['files', 'upload'] as const,
    mutationFn: (formData: FormData) =>
      apiClient.upload('/api/upload/file', formData),
  }),

  delete: () => ({
    mutationKey: ['files', 'delete'] as const,
    mutationFn: (fileId: string) => apiClient.delete(`/api/files/${fileId}`),
  }),
};

// ============================================================================
// LEARNING QUERIES (Flashcards, QCM, etc.)
// ============================================================================

export const learningQueries = {
  decks: () => ({
    queryKey: queryKeys.learning.decks(),
    queryFn: (): Promise<IDecksResponse> => apiClient.get('/api/learning/decks'),
  }),

  deckWithCards: (deckId: string) => ({
    queryKey: queryKeys.learning.deckWithCards(deckId),
    queryFn: (): Promise<IDeckWithCardsResponse> =>
      apiClient.get(`/api/learning/decks/${deckId}`),
  }),
};

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
    }): Promise<IDeckResponse> =>
      apiClient.patch(`/api/learning/decks/${deckId}`, data),
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
      cards: Array<{
        cardType: string;
        content: CardContent;
        position?: number;
      }>;
    }): Promise<ICardsResponse> =>
      apiClient.post(`/api/learning/decks/${deckId}/cards`, { cards }),
  }),

  updateCard: () => ({
    mutationKey: ['learning', 'update-card'] as const,
    mutationFn: ({
      cardId,
      data,
    }: {
      cardId: string;
      data: {
        content?: CardContent;
        position?: number;
        fsrsData?: Record<string, unknown>;
      };
    }): Promise<ICardResponse> =>
      apiClient.patch(`/api/learning/cards/${cardId}`, data),
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

// ============================================================================
// EDUCATION QUERIES (Subjects, Topics from Qdrant)
// ============================================================================

export const educationQueries = {
  subjectsForLevel: (
    level: EducationLevelType,
    selectedLv2?: Lv2Option | null
  ) => ({
    queryKey: queryKeys.education.subjects(level, selectedLv2),
    queryFn: async (): Promise<IEducationSubjectsResponse> => {
      const params: Record<string, string> | undefined = selectedLv2
        ? { selectedLv2 }
        : undefined;
      return apiClient.get(`/api/subjects/${level}`, { params });
    },
  }),

  topicsForSubject: (niveau: EducationLevelType, matiere: string) => ({
    queryKey: queryKeys.education.topics(niveau, matiere),
    queryFn: async (): Promise<ITopicsResponse> => {
      return apiClient.get('/api/learning/topics', {
        params: { niveau, matiere },
      });
    },
    enabled: !!matiere && !!niveau,
  }),
};

// ============================================================================
// INVALIDATION HELPERS
// ============================================================================

type SessionData = {
  id: string;
  subject: string;
  startedAt: string;
  messagesCount: number;
};

export const invalidationHelpers = {
  /**
   * Invalidate all parent data (dashboard + children + education subjects).
   * Used after child creation, update, or deletion.
   */
  invalidateParentData: (queryClient: QueryClient) => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.parent.dashboard(),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.parent.children(),
    });
    void queryClient.invalidateQueries({
      queryKey: ['education', 'subjects'],
    });
  },

  /**
   * Invalidate a specific child's data.
   */
  invalidateChildData: (queryClient: QueryClient, childId: string) => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.parent.child(childId),
    });
    void queryClient.invalidateQueries({
      queryKey: ['childProgress', childId],
    });
  },

  /**
   * Invalidate student data (sessions).
   * Uses refetchType: 'none' to prevent race conditions with optimistic updates.
   */
  invalidateStudentData: (queryClient: QueryClient) => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.chat.all,
      predicate: (query) => {
        const key = query.queryKey;
        return (
          key.length >= 2 &&
          key[0] === 'chat' &&
          (key[1] === 'sessions' || key[1] === 'session')
        );
      },
      refetchType: 'none',
    });
  },

  /**
   * Optimistic session update for instant UX.
   * Updates all session caches (limit: 5, 10) and latest session.
   */
  optimisticSessionUpdate: (queryClient: QueryClient, newSession: SessionData) => {
    const updateSessionCache =
      (maxSessions: number) =>
      (oldSessions: SessionData[] = []) => {
        const existingIndex = oldSessions.findIndex(
          (s) => s.id === newSession.id
        );

        if (existingIndex >= 0) {
          const withoutExisting = oldSessions.filter(
            (s) => s.id !== newSession.id
          );
          return [newSession, ...withoutExisting.slice(0, maxSessions - 1)];
        }

        return [newSession, ...oldSessions.slice(0, maxSessions - 1)];
      };

    queryClient.setQueryData(queryKeys.chat.sessions(5), updateSessionCache(5));
    queryClient.setQueryData(
      queryKeys.chat.sessions(10),
      updateSessionCache(10)
    );
    queryClient.setQueryData(queryKeys.chat.latest(), newSession);
  },

  /**
   * Invalidate files data after upload.
   */
  invalidateFileData: (queryClient: QueryClient) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.files.all });
  },

  /**
   * Invalidate learning data (decks and cards).
   */
  invalidateLearningData: (queryClient: QueryClient, deckId?: string) => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.learning.decks(),
    });
    if (deckId) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.learning.deckWithCards(deckId),
      });
    }
  },

  /**
   * Invalidate all data affected after real activity (message sent).
   */
  invalidateAfterActivity: (queryClient: QueryClient) => {
    invalidationHelpers.invalidateStudentData(queryClient);
  },
};
