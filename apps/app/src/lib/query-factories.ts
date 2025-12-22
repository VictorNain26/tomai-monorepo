/**
 * TanStack Query Factories - Tom 2025
 *
 * ARCHITECTURE BASÉE SUR LA DOCUMENTATION OFFICIELLE TanStack Query v5
 * https://tanstack.com/query/latest/docs/framework/react/guides/query-keys
 *
 * BONNES PRATIQUES APPLIQUÉES :
 *
 * 1. Query Keys Factory Pattern :
 *    - Structure hiérarchique : ['parent'] -> ['parent', 'dashboard'] -> ['parent', 'children', childId]
 *    - Clés uniques et sérialisables avec `as const` pour typage strict
 *    - Organisation logique par domaine (parent, student, chat, pronote, files)
 *
 * 2. Zero-Config avec TanStack Query defaults :
 *    - Pas de staleTime/gcTime/retry customs inutiles
 *    - Cache et synchronisation automatiques optimisés
 *    - Déduplication des requêtes par défaut
 *
 * 3. Query Functions simples :
 *    - Une responsabilité par fonction
 *    - Utilisation du client API centralisé
 *    - Gestion d'erreur unifiée dans apiClient
 *
 * 4. TypeScript strict :
 *    - Types explicites pour toutes les réponses
 *    - Query keys typées avec `as const`
 *    - Inference automatique des types
 */

import { apiClient } from './api-client';
import { educationService } from './educationService';
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
  ICreateCardRequest,
  ILearningDeck,
  CardContent,
  IGenerateDeckRequest,
  IGenerateDeckResponse,
  Lv2Option,
  EducationLevelType,
  RagLevel,
} from '@/types';

// ===== QUERY KEYS FACTORIES (TanStack Best Practices) =====

export const queryKeys = {
  // Parent queries
  parent: {
    all: ['parent'] as const,
    dashboard: () => [...queryKeys.parent.all, 'dashboard'] as const,
    children: () => [...queryKeys.parent.all, 'children'] as const,
    child: (childId: string) => [...queryKeys.parent.children(), childId] as const,
    childProgress: (childId: string, period?: string) => [...queryKeys.parent.child(childId), 'progress', period] as const,
  },

  // Chat queries - Sessions only (messages handled by useChat TanStack AI hook)
  chat: {
    all: ['chat'] as const,
    sessions: (limit?: number) => [...queryKeys.chat.all, 'sessions', { limit }] as const,
    session: (sessionId: string) => [...queryKeys.chat.all, 'session', sessionId] as const,
  },

  // Files queries (used for invalidation)
  files: {
    all: ['files'] as const,
  },

  // Learning tools queries (flashcards, qcm, vrai/faux)
  learning: {
    all: ['learning'] as const,
    decks: () => [...queryKeys.learning.all, 'decks'] as const,
    deck: (deckId: string) => [...queryKeys.learning.decks(), deckId] as const,
    deckWithCards: (deckId: string) => [...queryKeys.learning.deck(deckId), 'cards'] as const,
  },

  // Education queries (subjects, levels from Qdrant)
  education: {
    all: ['education'] as const,
    subjects: (level: EducationLevelType, selectedLv2?: Lv2Option | null) =>
      [...queryKeys.education.all, 'subjects', level, selectedLv2 ?? 'no-lv2'] as const,
    levels: () => [...queryKeys.education.all, 'levels'] as const,
    // Topics from RAG (themes/chapters per subject)
    topics: (niveau: EducationLevelType, matiere: string) =>
      [...queryKeys.education.all, 'topics', niveau, matiere] as const,
  },
} as const;

// ===== PARENT QUERIES =====

export const parentQueries = {
  dashboard: () => ({
    queryKey: queryKeys.parent.dashboard(),
    queryFn: (): Promise<IDashboardStats & { children?: IChild[] }> => apiClient.get('/api/parent/dashboard'),
  }),

  children: () => ({
    queryKey: queryKeys.parent.children(),
    queryFn: (): Promise<IChild[]> => apiClient.get('/api/parent/children'),
  }),

  child: (childId: string) => ({
    queryKey: queryKeys.parent.child(childId),
    queryFn: (): Promise<IChild> => apiClient.get(`/api/parent/children/${childId}`),
  }),

  childProgress: (childId: string, period?: 'week' | 'month' | 'year') => ({
    queryKey: queryKeys.parent.childProgress(childId, period),
    queryFn: () => apiClient.get(`/api/parent/children/${childId}/progress`, period ? {
      params: { period }
    } : {}),
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
    mutationFn: ({ childId, data }: { childId: string; data: Partial<IChild> }) =>
      apiClient.patch(`/api/parent/children/${childId}`, data),
  }),

  deleteChild: () => ({
    mutationKey: ['parent', 'delete-child'] as const,
    mutationFn: (childId: string) =>
      apiClient.delete(`/api/parent/children/${childId}`),
  }),
};

// ===== CHAT QUERIES =====

export const chatQueries = {
  // Liste des sessions utilisateur
  sessions: (limit = 20) => ({
    queryKey: queryKeys.chat.sessions(limit),
    queryFn: async (): Promise<Array<{
      id: string;
      subject: string;
      startedAt: string;
      endedAt?: string;
      messagesCount: number;
    }>> => {
      const response = await apiClient.get<{ sessions: Array<{
        id: string;
        subject: string;
        startedAt: string;
        endedAt?: string;
        messagesCount: number;
      }> }>('/api/chat/sessions', { params: { limit } });
      return response.sessions ?? [];
    },
  }),

  // Dernière session (optimisé pour dashboard)
  latestSession: () => ({
    queryKey: [...queryKeys.chat.all, 'latest'] as const,
    queryFn: async (): Promise<{
      id: string;
      subject: string;
      startedAt: string;
      endedAt?: string;
      messagesCount: number;
    } | null> => {
      const response = await apiClient.get<{ session: {
        id: string;
        subject: string;
        startedAt: string;
        endedAt?: string;
        messagesCount: number;
      } | null }>('/api/chat/sessions/latest');
      return response.session;
    },
  }),

  // Détails d'une session spécifique
  session: (sessionId: string) => ({
    queryKey: queryKeys.chat.session(sessionId),
    queryFn: () => apiClient.get(`/api/chat/session/${sessionId}`),
  }),
  // Note: messages handled by useChat TanStack AI hook directly
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

// ===== FILE MUTATIONS =====

export const fileMutations = {
  upload: () => ({
    mutationKey: ['files', 'upload'] as const,
    mutationFn: (formData: FormData) => apiClient.upload('/api/upload/file', formData),
  }),

  delete: () => ({
    mutationKey: ['files', 'delete'] as const,
    mutationFn: (fileId: string) => apiClient.delete(`/api/files/${fileId}`),
  }),
};

// ===== LEARNING QUERIES (Flashcards, QCM, Vrai/Faux) =====

export const learningQueries = {
  // List all user's decks
  decks: () => ({
    queryKey: queryKeys.learning.decks(),
    queryFn: (): Promise<IDecksResponse> => apiClient.get('/api/learning/decks'),
  }),

  // Get a single deck with all its cards
  deckWithCards: (deckId: string) => ({
    queryKey: queryKeys.learning.deckWithCards(deckId),
    queryFn: (): Promise<IDeckWithCardsResponse> => apiClient.get(`/api/learning/decks/${deckId}`),
  }),
};

export const learningMutations = {
  // Create a new deck
  createDeck: () => ({
    mutationKey: ['learning', 'create-deck'] as const,
    mutationFn: (data: ICreateDeckRequest): Promise<IDeckResponse> =>
      apiClient.post('/api/learning/decks', data),
  }),

  // Update deck metadata
  updateDeck: () => ({
    mutationKey: ['learning', 'update-deck'] as const,
    mutationFn: ({ deckId, data }: { deckId: string; data: Partial<Pick<ILearningDeck, 'title' | 'description' | 'subject'>> }): Promise<IDeckResponse> =>
      apiClient.patch(`/api/learning/decks/${deckId}`, data),
  }),

  // Delete a deck (cascades to cards)
  deleteDeck: () => ({
    mutationKey: ['learning', 'delete-deck'] as const,
    mutationFn: (deckId: string): Promise<{ success: boolean }> =>
      apiClient.delete(`/api/learning/decks/${deckId}`),
  }),

  // Add cards to a deck
  addCards: () => ({
    mutationKey: ['learning', 'add-cards'] as const,
    mutationFn: ({ deckId, cards }: { deckId: string; cards: ICreateCardRequest[] }): Promise<ICardsResponse> =>
      apiClient.post(`/api/learning/decks/${deckId}/cards`, { cards }),
  }),

  // Update a card
  updateCard: () => ({
    mutationKey: ['learning', 'update-card'] as const,
    mutationFn: ({ cardId, data }: { cardId: string; data: { content?: CardContent; position?: number; fsrsData?: Record<string, unknown> } }): Promise<ICardResponse> =>
      apiClient.patch(`/api/learning/cards/${cardId}`, data),
  }),

  // Delete a card
  deleteCard: () => ({
    mutationKey: ['learning', 'delete-card'] as const,
    mutationFn: (cardId: string): Promise<{ success: boolean }> =>
      apiClient.delete(`/api/learning/cards/${cardId}`),
  }),

  // Generate deck with AI (RAG + Gemini)
  generateDeck: () => ({
    mutationKey: ['learning', 'generate-deck'] as const,
    mutationFn: (data: IGenerateDeckRequest): Promise<IGenerateDeckResponse> =>
      apiClient.post('/api/learning/generate', data),
  }),
};

// ===== EDUCATION QUERIES (Qdrant subjects/levels) =====

/** Subject from Qdrant with metadata */
export interface IEducationSubject {
  key: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  ragKeywords: string[];
  ragAvailable: boolean;
}

/** Response from /api/subjects/:level endpoint */
export interface IEducationSubjectsResponse {
  success: boolean;
  subjects: IEducationSubject[];
  level: string;
  selectedLv2: Lv2Option | null;
  message?: string;
}

/** Domain with its topics from RAG */
export interface IDomainWithTopics {
  domaine: string;
  /** Catégorie large (Histoire, Géographie, Grammaire, etc.) */
  category: string;
  themes: string[];
}

/** Response from /api/learning/topics endpoint */
export interface ITopicsResponse {
  matiere: string;
  niveau: string;
  domaines: IDomainWithTopics[];
  totalTopics: number;
}

/** Response from /api/education/levels endpoint */
export interface IEducationLevelsResponse {
  success: boolean;
  levels: RagLevel[];
  total: number;
  ragAvailableCount: number;
}

export const educationQueries = {
  /**
   * Get all education levels with RAG availability from Qdrant
   * Utilisé pour les selectors de création/édition d'enfant
   */
  levels: () => ({
    queryKey: queryKeys.education.levels(),
    queryFn: async (): Promise<IEducationLevelsResponse> => {
      return apiClient.get('/api/education/levels');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - niveaux changent rarement
  }),

  /**
   * Get subjects available for a school level (filtered by LV2 if applicable)
   * Utilise educationService pour récupérer depuis le backend RAG ET enrichir avec métadonnées UI
   */
  subjectsForLevel: (level: EducationLevelType, selectedLv2?: Lv2Option | null) => ({
    queryKey: queryKeys.education.subjects(level, selectedLv2),
    queryFn: async (): Promise<IEducationSubjectsResponse> => {
      // Utilise educationService qui récupère les clés RAG et les enrichit avec UI metadata
      const config = await educationService.getLevelConfiguration(level, selectedLv2);

      return {
        success: true,
        level: config.level,
        selectedLv2: config.selectedLv2 ?? null,
        subjects: config.subjects.map((s) => ({
          ...s,
          ragAvailable: true,
        })),
      };
    },
  }),

  /** Get topics/themes from RAG for a subject at a given level */
  topicsForSubject: (niveau: EducationLevelType, matiere: string) => ({
    queryKey: queryKeys.education.topics(niveau, matiere),
    queryFn: async (): Promise<ITopicsResponse> => {
      return apiClient.get('/api/learning/topics', {
        params: { niveau, matiere }
      });
    },
    enabled: !!matiere && !!niveau,
  }),
};

// ===== INVALIDATION HELPERS =====
// Centralisation des invalidations pour éviter la duplication

export const invalidationHelpers = {
  /**
   * Invalide toutes les données parent (dashboard + enfants + education)
   * Utilisé après création, modification, suppression d'enfant
   * Inclut education/subjects car la LV2 peut changer
   */
  invalidateParentData: (queryClient: QueryClient) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.parent.dashboard() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.parent.children() });
    // Invalider aussi les subjects education car la LV2 peut avoir changé
    void queryClient.invalidateQueries({ queryKey: ['education', 'subjects'] });
  },

  /**
   * Invalide les données d'un enfant spécifique
   */
  invalidateChildData: (queryClient: QueryClient, childId: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.parent.child(childId) });
    void queryClient.invalidateQueries({ queryKey: ['childProgress', childId] });
  },

  /**
   * Invalide les données étudiant (sessions uniquement - MVP simplification)
   * 🔧 FIX v2: Prévient race condition entre optimistic update et background refetch
   *
   * PROBLÈME RÉSOLU : Comportement aléatoire où sessions ne se mettaient pas à jour
   * CAUSE : Background refetch overwritait l'optimistic update avant que le serveur ne persiste
   *
   * SOLUTION : refetchType: 'none' → marque "stale" sans refetch immédiat
   * Les queries se rafraîchiront naturellement au prochain mount/focus/interaction
   */
  invalidateStudentData: (queryClient: QueryClient) => {
    // Pattern TanStack Query v5: Invalidation sans refetch immédiat
    // Invalide toutes les queries qui commencent par ['chat', 'sessions']
    // Cela inclut chat.sessions(5), chat.sessions(10), etc.
    void queryClient.invalidateQueries({
      queryKey: queryKeys.chat.all,
      predicate: (query) => {
        // Matcher toutes les queries de sessions ET messages
        const key = query.queryKey;
        return (
          key.length >= 2 &&
          key[0] === 'chat' &&
          (key[1] === 'sessions' || key[1] === 'session')
        );
      },
      refetchType: 'none', // 🚨 CRITICAL: Ne pas refetch immédiatement pour éviter race condition
    });
  },

  /**
   * 🚀 Invalidation optimiste session créée pour UX instantanée
   * MVP simplification: Only updates sessions cache, no dashboard stats
   * 🔧 FIX: Met à jour TOUS les caches sessions (limit: 5 ET 10) + latest session pour dashboard
   */
  optimisticSessionUpdate: (queryClient: QueryClient, newSession: {
    id: string;
    subject: string;
    startedAt: string;
    messagesCount: number;
  }) => {
    // Fonction de mise à jour réutilisable pour différents limits
    const updateSessionCache = (maxSessions: number) =>
      (oldSessions: Array<{id: string; subject: string; startedAt: string; messagesCount: number}> = []) => {
        // Si session existe déjà, mettre à jour ET RÉORDONNER en tête
        const existingIndex = oldSessions.findIndex(s => s.id === newSession.id);
        if (existingIndex >= 0 && oldSessions[existingIndex]) {
          // Créer tableau sans la session existante
          const withoutExisting = oldSessions.filter(s => s.id !== newSession.id);

          // Ajouter session mise à jour EN PREMIÈRE POSITION
          // Utiliser nouveau startedAt pour refléter l'activité récente
          return [
            {
              id: newSession.id,
              subject: newSession.subject,
              startedAt: newSession.startedAt, // ✅ Nouveau timestamp pour réordonnancement
              messagesCount: newSession.messagesCount
            },
            ...withoutExisting.slice(0, maxSessions - 1) // Garder max-1 autres sessions
          ];
        }

        // Sinon ajouter nouvelle session en tête
        return [
          newSession,
          ...oldSessions.slice(0, maxSessions - 1) // Garder max-1 sessions
        ];
      };

    // 🔧 FIX: Mettre à jour TOUS les caches utilisés par l'app
    queryClient.setQueryData(
      queryKeys.chat.sessions(5), // Dashboard utilise limit: 5
      updateSessionCache(5)
    );

    queryClient.setQueryData(
      queryKeys.chat.sessions(10), // Autres composants utilisent limit: 10
      updateSessionCache(10)
    );

    // ⚡ OPTIMISATION: Mettre à jour cache latest session (optimisé dashboard)
    queryClient.setQueryData(
      [...queryKeys.chat.all, 'latest'] as const,
      newSession
    );
  },

  /**
   * Invalide les fichiers après upload
   */
  invalidateFileData: (queryClient: QueryClient) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.files.all });
  },

  /**
   * Invalide les données learning (decks et cards)
   * Utilisé après création, modification, suppression de deck/card
   */
  invalidateLearningData: (queryClient: QueryClient, deckId?: string) => {
    // Toujours invalider la liste des decks
    void queryClient.invalidateQueries({ queryKey: queryKeys.learning.decks() });
    // Si deckId fourni, invalider aussi ce deck spécifique
    if (deckId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.learning.deckWithCards(deckId) });
    }
  },

  /**
   * 🚀 Invalide toutes les données impactées après une activité réelle
   * (envoi message → met à jour sessions)
   */
  invalidateAfterActivity: (queryClient: QueryClient) => {
    invalidationHelpers.invalidateStudentData(queryClient);
  },
};

