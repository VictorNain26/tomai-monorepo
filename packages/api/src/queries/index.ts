/**
 * @repo/api - Query Factories TanStack Query 5
 *
 * Factories platform-agnostic pour Web et Mobile.
 * Uses queryOptions() pattern (TQ5 best practice).
 * Uses Eden Treaty for type-safe e2e API calls.
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/query-keys
 */

import { queryOptions } from '@tanstack/react-query';
import { getTreaty, unwrap } from '../client';
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
  dashboard: () =>
    queryOptions({
      queryKey: queryKeys.parent.dashboard(),
      queryFn: (): Promise<IDashboardStats & { children?: IChild[] }> =>
        unwrap(getTreaty().api.parent.dashboard.get()) as Promise<IDashboardStats & { children?: IChild[] }>,
    }),

  children: () =>
    queryOptions({
      queryKey: queryKeys.parent.children(),
      queryFn: (): Promise<IChild[]> =>
        unwrap(getTreaty().api.parent.children.get()) as Promise<IChild[]>,
    }),

  child: (childId: string) =>
    queryOptions({
      queryKey: queryKeys.parent.child(childId),
      queryFn: async (): Promise<IChild> => {
        const children = unwrap(await getTreaty().api.parent.children.get()) as IChild[];
        const child = children.find((c: IChild) => c.id === childId);
        if (!child) throw new Error('Child not found');
        return child;
      },
    }),

  childProgress: (childId: string, _period?: 'week' | 'month' | 'year') =>
    queryOptions({
      queryKey: queryKeys.parent.childProgress(childId, _period),
      queryFn: async () => {
        const children = unwrap(await getTreaty().api.parent.children.get()) as IChild[];
        return children.find((c: IChild) => c.id === childId);
      },
    }),
};

export const parentMutations = {
  createChild: () => ({
    mutationKey: ['parent', 'create-child'] as const,
    mutationFn: (childData: ICreateChildData) =>
      unwrap(getTreaty().api.parent.children.post(childData)),
  }),

  updateChild: () => ({
    mutationKey: ['parent', 'update-child'] as const,
    mutationFn: ({
      childId,
      data,
    }: {
      childId: string;
      data: Partial<IChild>;
    }) => unwrap(getTreaty().api.parent.children({ id: childId }).patch(data)),
  }),

  deleteChild: () => ({
    mutationKey: ['parent', 'delete-child'] as const,
    mutationFn: (childId: string) =>
      unwrap(getTreaty().api.parent.children({ id: childId }).delete()),
  }),
};

// ============================================================================
// CHAT QUERIES
// ============================================================================

export const chatQueries = {
  sessions: (_limit = 20) =>
    queryOptions({
      queryKey: queryKeys.chat.sessions(_limit),
      queryFn: async (): Promise<IChatSession[]> => {
        const response = unwrap(
          await getTreaty().api.chat.sessions.latest.get()
        ) as { session: IChatSession | null };
        return response.session ? [response.session] : [];
      },
    }),

  latestSession: () =>
    queryOptions({
      queryKey: queryKeys.chat.latest(),
      queryFn: async (): Promise<IChatSession | null> => {
        const response = unwrap(
          await getTreaty().api.chat.sessions.latest.get()
        ) as { session: IChatSession | null };
        return response.session;
      },
    }),

  session: (sessionId: string) =>
    queryOptions({
      queryKey: queryKeys.chat.session(sessionId),
      queryFn: () =>
        unwrap(getTreaty().api.chat.session({ id: sessionId }).history.get()),
    }),
};

export const chatMutations = {
  createSession: () => ({
    mutationKey: ['chat', 'create-session'] as const,
    mutationFn: () =>
      unwrap(getTreaty().api.chat.session.post()),
  }),

  deleteSession: () => ({
    mutationKey: ['chat', 'delete-session'] as const,
    mutationFn: (sessionId: string) =>
      unwrap(getTreaty().api.chat.session({ id: sessionId }).delete()),
  }),
};

// ============================================================================
// FILE MUTATIONS
// ============================================================================

export const fileMutations = {
  delete: () => ({
    mutationKey: ['files', 'delete'] as const,
    mutationFn: (fileId: string) =>
      unwrap(getTreaty().api.upload.file({ fileId }).delete()),
  }),
};

// ============================================================================
// LEARNING QUERIES (Flashcards, QCM, etc.)
// ============================================================================

export const learningQueries = {
  decks: () =>
    queryOptions({
      queryKey: queryKeys.learning.decks(),
      queryFn: (): Promise<IDecksResponse> =>
        unwrap(getTreaty().api.learning.decks.get()) as Promise<IDecksResponse>,
    }),

  deckWithCards: (deckId: string) =>
    queryOptions({
      queryKey: queryKeys.learning.deckWithCards(deckId),
      queryFn: (): Promise<IDeckWithCardsResponse> =>
        unwrap(getTreaty().api.learning.decks({ id: deckId }).get()) as Promise<IDeckWithCardsResponse>,
    }),
};

export const learningMutations = {
  createDeck: () => ({
    mutationKey: ['learning', 'create-deck'] as const,
    mutationFn: (data: ICreateDeckRequest): Promise<IDeckResponse> =>
      unwrap(getTreaty().api.learning.decks.post(data)) as Promise<IDeckResponse>,
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
      unwrap(getTreaty().api.learning.decks({ id: deckId }).patch(data)) as Promise<IDeckResponse>,
  }),

  deleteDeck: () => ({
    mutationKey: ['learning', 'delete-deck'] as const,
    mutationFn: (deckId: string): Promise<{ success: boolean }> =>
      unwrap(getTreaty().api.learning.decks({ id: deckId }).delete()) as Promise<{ success: boolean }>,
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
      unwrap(getTreaty().api.learning.decks({ id: deckId }).cards.post({ cards: cards as never })) as Promise<ICardsResponse>,
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
      unwrap(getTreaty().api.learning.cards({ id: cardId }).patch(data as never)) as Promise<ICardResponse>,
  }),

  deleteCard: () => ({
    mutationKey: ['learning', 'delete-card'] as const,
    mutationFn: (cardId: string): Promise<{ success: boolean }> =>
      unwrap(getTreaty().api.learning.cards({ id: cardId }).delete()) as Promise<{ success: boolean }>,
  }),

  generateDeck: () => ({
    mutationKey: ['learning', 'generate-deck'] as const,
    mutationFn: (data: IGenerateDeckRequest): Promise<IGenerateDeckResponse> =>
      unwrap(getTreaty().api.learning.generate.post(data)) as Promise<IGenerateDeckResponse>,
  }),
};

// ============================================================================
// EDUCATION QUERIES (Subjects, Topics from Qdrant)
// ============================================================================

export const educationQueries = {
  subjectsForLevel: (
    level: EducationLevelType,
    _selectedLv2?: Lv2Option | null
  ) =>
    queryOptions({
      queryKey: queryKeys.education.subjects(level, _selectedLv2),
      queryFn: async (): Promise<IEducationSubjectsResponse> => {
        return unwrap(
          await getTreaty().api.learning.subjects.get({
            query: { niveau: level as 'cp' },
          })
        ) as IEducationSubjectsResponse;
      },
    }),

  topicsForSubject: (niveau: EducationLevelType, matiere: string) => ({
    ...queryOptions({
      queryKey: queryKeys.education.topics(niveau, matiere),
      queryFn: async (): Promise<ITopicsResponse> => {
        return unwrap(
          await getTreaty().api.learning.topics.get({
            query: { niveau: niveau as 'cp', matiere },
          })
        ) as ITopicsResponse;
      },
    }),
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

  invalidateChildData: (queryClient: QueryClient, childId: string) => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.parent.child(childId),
    });
    void queryClient.invalidateQueries({
      queryKey: ['childProgress', childId],
    });
  },

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

  invalidateFileData: (queryClient: QueryClient) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.files.all });
  },

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

  invalidateAfterActivity: (queryClient: QueryClient) => {
    invalidationHelpers.invalidateStudentData(queryClient);
  },
};
