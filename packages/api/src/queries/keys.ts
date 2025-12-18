/**
 * @repo/api - Query Keys Factory
 *
 * Structure hiérarchique des clés TanStack Query.
 * Pattern recommandé par la documentation officielle.
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/query-keys
 */

import type { EducationLevelType, Lv2Option } from './types';

export const queryKeys = {
  // =========================================================================
  // PARENT QUERIES
  // =========================================================================
  parent: {
    all: ['parent'] as const,
    dashboard: () => [...queryKeys.parent.all, 'dashboard'] as const,
    children: () => [...queryKeys.parent.all, 'children'] as const,
    child: (childId: string) =>
      [...queryKeys.parent.children(), childId] as const,
    childProgress: (childId: string, period?: string) =>
      [...queryKeys.parent.child(childId), 'progress', period] as const,
  },

  // =========================================================================
  // CHAT QUERIES
  // =========================================================================
  chat: {
    all: ['chat'] as const,
    sessions: (limit?: number) =>
      [...queryKeys.chat.all, 'sessions', { limit }] as const,
    session: (sessionId: string) =>
      [...queryKeys.chat.all, 'session', sessionId] as const,
    latest: () => [...queryKeys.chat.all, 'latest'] as const,
  },

  // =========================================================================
  // FILES QUERIES
  // =========================================================================
  files: {
    all: ['files'] as const,
  },

  // =========================================================================
  // LEARNING QUERIES (Flashcards, QCM, etc.)
  // =========================================================================
  learning: {
    all: ['learning'] as const,
    decks: () => [...queryKeys.learning.all, 'decks'] as const,
    deck: (deckId: string) => [...queryKeys.learning.decks(), deckId] as const,
    deckWithCards: (deckId: string) =>
      [...queryKeys.learning.deck(deckId), 'cards'] as const,
  },

  // =========================================================================
  // EDUCATION QUERIES (Subjects, Levels from Qdrant)
  // =========================================================================
  education: {
    all: ['education'] as const,
    subjects: (level: EducationLevelType, selectedLv2?: Lv2Option | null) =>
      [
        ...queryKeys.education.all,
        'subjects',
        level,
        selectedLv2 ?? 'no-lv2',
      ] as const,
    levels: () => [...queryKeys.education.all, 'levels'] as const,
    topics: (niveau: EducationLevelType, matiere: string) =>
      [...queryKeys.education.all, 'topics', niveau, matiere] as const,
  },

  // =========================================================================
  // SUBSCRIPTION QUERIES
  // =========================================================================
  subscription: {
    all: ['subscription'] as const,
    status: () => [...queryKeys.subscription.all, 'status'] as const,
    usage: () => [...queryKeys.subscription.all, 'usage'] as const,
  },
} as const;
