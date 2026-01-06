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

  // Chat queries (latestSession for dashboard)
  chat: {
    all: ['chat'] as const,
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
};

// ===== FILE MUTATIONS (Scaleway V2) =====

export const fileMutations = {
  // Upload handled by usePresignedUpload hook (presign → direct PUT → confirm)

  delete: () => ({
    mutationKey: ['files', 'delete'] as const,
    mutationFn: (fileId: string) => apiClient.delete(`/api/upload/file/${fileId}`),
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
   * Invalide les données étudiant (latestSession pour dashboard)
   */
  invalidateStudentData: (queryClient: QueryClient) => {
    void queryClient.invalidateQueries({
      queryKey: [...queryKeys.chat.all, 'latest'],
      refetchType: 'none',
    });
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

