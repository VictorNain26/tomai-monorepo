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
import type { QueryClient } from '@tanstack/react-query';
import type {
  IChild,
  IDashboardStats,
  ICreateChildData,
  IMessage,
  ISubjectsResponse,
  ISubjectsForStudent
} from '@/types';
import type {
  EstablishmentData
} from '@/services/establishment.service';

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

  // Student queries
  student: {
    all: ['student'] as const,
    dashboard: () => [...queryKeys.student.all, 'dashboard'] as const,
    profile: () => [...queryKeys.student.all, 'profile'] as const,
    subjects: () => [...queryKeys.student.all, 'subjects'] as const,
    activeSubjects: () => [...queryKeys.student.all, 'subjects', 'active'] as const,
    progress: (subject?: string, period?: string) => [...queryKeys.student.all, 'progress', { subject, period }] as const,
  },

  // Chat queries
  chat: {
    all: ['chat'] as const,
    sessions: (limit?: number) => [...queryKeys.chat.all, 'sessions', { limit }] as const,
    session: (sessionId: string) => [...queryKeys.chat.all, 'session', sessionId] as const,
    messages: (sessionId: string) => [...queryKeys.chat.session(sessionId), 'messages'] as const,
  },

  // Pronote queries
  pronote: {
    all: ['pronote'] as const,
    connections: () => [...queryKeys.pronote.all, 'connections'] as const,
    establishments: (query: string) => [...queryKeys.pronote.all, 'establishments', { query }] as const,
  },

  // Files queries
  files: {
    all: ['files'] as const,
    userFiles: (userId: string) => [...queryKeys.files.all, 'user', userId] as const,
    chatAttachments: (sessionId: string) => [...queryKeys.files.all, 'chat', sessionId] as const,
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

// ===== STUDENT QUERIES =====

export const studentQueries = {
  subjects: () => ({
    queryKey: queryKeys.student.subjects(),
    queryFn: (): Promise<ISubjectsResponse> => apiClient.get('/api/students/subjects/current'),
  }),

  activeSubjects: () => ({
    queryKey: queryKeys.student.activeSubjects(),
    queryFn: (): Promise<ISubjectsForStudent> => apiClient.get('/api/students/subjects/active'),
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

  // Historique des messages d'une session
  messages: (sessionId: string) => ({
    queryKey: queryKeys.chat.messages(sessionId),
    queryFn: async (): Promise<IMessage[]> => {
      const response = await apiClient.get<{ history?: IMessage[]; messages?: IMessage[]; } | IMessage[]>(`/api/chat/session/${sessionId}/history`);
      const messages = Array.isArray(response) ? response : (response.history ?? response.messages ?? []);
      return Array.isArray(messages) ? messages : [];
    },
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

// ===== PRONOTE QUERIES =====

export const pronoteQueries = {
  connections: () => ({
    queryKey: queryKeys.pronote.connections(),
    queryFn: (): Promise<Array<{ id: string; establishmentName: string; }>> => apiClient.get('/api/pronote/connections'),
  }),

  establishments: (query: string) => ({
    queryKey: queryKeys.pronote.establishments(query),
    queryFn: (): Promise<EstablishmentData[]> =>
      apiClient.get('/api/pronote/establishments/search', { params: { q: query } }),
  }),
};

export const pronoteMutations = {
  authenticateQrCode: () => ({
    mutationKey: ['pronote', 'authenticate-qrcode'] as const,
    mutationFn: (establishmentUrl: string) =>
      apiClient.post('/api/pronote/authenticate-qrcode', { establishmentUrl }),
  }),

  validatePin: () => ({
    mutationKey: ['pronote', 'validate-pin'] as const,
    mutationFn: ({ pin, sessionId }: { pin: string; sessionId: string }) =>
      apiClient.post('/api/pronote/validate-pin', { pin, sessionId }),
  }),

  disconnect: () => ({
    mutationKey: ['pronote', 'disconnect'] as const,
    mutationFn: (connectionId: string) =>
      apiClient.delete(`/api/pronote/connections/${connectionId}`),
  }),
};

// ===== FILE QUERIES =====

export const fileQueries = {
  userFiles: (userId: string) => ({
    queryKey: queryKeys.files.userFiles(userId),
    queryFn: () => apiClient.get(`/api/files/user/${userId}`),
  }),

  chatAttachments: (sessionId: string) => ({
    queryKey: queryKeys.files.chatAttachments(sessionId),
    queryFn: () => apiClient.get(`/api/files/chat/${sessionId}`),
  }),
};

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

// ===== INVALIDATION HELPERS =====
// Centralisation des invalidations pour éviter la duplication

export const invalidationHelpers = {
  /**
   * Invalide toutes les données parent (dashboard + enfants)
   * Utilisé après création, modification, suppression d'enfant
   */
  invalidateParentData: (queryClient: QueryClient) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.parent.dashboard() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.parent.children() });
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
   * Invalide les connexions Pronote
   */
  invalidatePronoteData: (queryClient: QueryClient, childId?: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.pronote.connections() });
    if (childId) {
      void queryClient.invalidateQueries({ queryKey: ['pronoteConnections', childId] });
    }
  },

  /**
   * 🎯 Invalide les données de gamification (streak, badges)
   * Utilisé après une activité réelle (envoi message) pour mise à jour automatique
   */
  invalidateGamificationData: (queryClient: QueryClient) => {
    void queryClient.invalidateQueries({
      queryKey: ['student-gamification'],
      refetchType: 'active' // Refetch immédiatement si la query est active (composant monté)
    });
    void queryClient.invalidateQueries({
      queryKey: ['badges-catalog'],
      refetchType: 'active'
    });
  },

  /**
   * 🚀 Invalide toutes les données impactées après une activité réelle
   * (envoi message → met à jour streak + sessions)
   * Combine invalidation sessions + gamification pour UX cohérente
   */
  invalidateAfterActivity: (queryClient: QueryClient) => {
    invalidationHelpers.invalidateStudentData(queryClient);
    invalidationHelpers.invalidateGamificationData(queryClient);
  },
};

