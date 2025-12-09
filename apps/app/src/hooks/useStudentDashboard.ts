import { logger } from '@/lib/logger.js';
import { useNavigate } from 'react-router';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatQueries } from '@/lib/query-factories';
import { useAllSubjects } from './useEducation';
import { apiClient } from '@/lib/api-client';
import { useUser } from '@/lib/auth';
import { getUIMode } from '@/utils/uiModeSystem';
import type { IStudySession, IAppUser, EducationSubject } from '@/types';
import { getMessage, ERROR_MESSAGES, SUCCESS_MESSAGES, getMessageWithParams } from '@/constants/messages';
/**
 * Hook useStudentDashboard - Gestion d'état simplifiée dashboard étudiant (MVP)
 * Simplifié: Sessions pour suggestions + Matières uniquement
 * Support LV2: Les matières sont filtrées selon la LV2 de l'élève (à partir de 5ème)
 */

interface StudentDashboardState {
  sessions: IStudySession[];
  subjects: EducationSubject[];
  loading: boolean;
  _error: string | null;
}

interface UseStudentDashboardReturn extends StudentDashboardState {
  // Actions - UX fluide sans bouton refresh
  startNewChat: (subject: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  // Compatibility properties
  mode: 'primary' | 'college' | 'lycee';
  isLoading: boolean;
  data: unknown;
  error: string | null;
  // RAG state
  isRAGEmpty: boolean;
}

export function useStudentDashboard(): UseStudentDashboardReturn {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useUser();

  // EXPERT: User REQUIS - l'app échoue si pas d'utilisateur ou schoolLevel manquant
  const tomaiUser = user as IAppUser | null;
  if (!tomaiUser?.schoolLevel) {
    throw new Error('User schoolLevel is required for dashboard - check authentication and user profile');
  }

  const userLevel = tomaiUser.schoolLevel;
  const userLv2 = tomaiUser.selectedLv2 ?? null; // LV2 de l'utilisateur pour filtrage
  const mode = getUIMode(userLevel);

  // Requêtes MVP simplifiées avec support LV2
  // La LV2 est passée pour filtrer les matières de langues vivantes
  const subjectsQuery = useAllSubjects(userLevel, userLv2);

  // OPTIMISATION: Récupérer uniquement la dernière session pour le dashboard
  // Au lieu de fetcher 5 sessions, on récupère seulement la plus récente (économie bandwidth)
  const latestSessionQuery = useQuery({
    ...chatQueries.latestSession()
  });

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationKey: ['chat', 'delete-session'] as const,
    mutationFn: (sessionId: string) => apiClient.delete(`/api/chat/session/${sessionId}`),
    onSuccess: () => {
      // Invalider les requêtes liées aux sessions
      void queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] });
      const successMessage = getMessage(SUCCESS_MESSAGES.chat.sessionDeleted, 'lycee');
      toast.success(successMessage);
    },
    onError: (error: Error) => {
      logger.error('Error deleting session', error, {
        component: 'useStudentDashboard',
        operation: 'deleteSession'
      });
      const errorMessage = getMessage(ERROR_MESSAGES.chat.sendMessageFailed, 'lycee');
      toast.error(errorMessage);
    }
  });

  /**
   * Démarrer un nouveau chat (sans créer la session - elle sera créée au premier message)
   */
  const startNewChat = useCallback(async (subject: string) => {
    try {
      void navigate(`/student/chat?subject=${encodeURIComponent(subject)}`);
      const successMessage = getMessageWithParams(SUCCESS_MESSAGES.chat.sessionStarted, 'lycee', { subject });
      toast.success(successMessage);
    } catch (error: unknown) {
      logger.error('Error starting chat', { error }, {
        component: 'useStudentDashboard',
        operation: 'startNewChat'
      });
      const errorMessage = getMessage(ERROR_MESSAGES.chat.sendMessageFailed, 'lycee');
      toast.error(errorMessage);
    }
  }, [navigate]);

  /**
   * Supprimer une session
   */
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await deleteSessionMutation.mutateAsync(sessionId);
    } catch {
      // Error is already handled by onError in mutation
      // Delete session failed - error logged in mutation onError handler
    }
  }, [deleteSessionMutation]);

  // Si les données ne sont pas encore chargées, garder l'état loading
  if (subjectsQuery.isLoading || latestSessionQuery.isLoading || deleteSessionMutation.isPending) {
    return {
      sessions: [],
      subjects: [],
      loading: true,
      _error: null,
      startNewChat,
      deleteSession,
      mode,
      isLoading: true,
      data: null,
      error: null,
      isRAGEmpty: false // Cannot determine yet during loading
    };
  }

  // SI ERREUR API: Gérer gracieusement sans crash
  const apiError = subjectsQuery.error?.message ?? latestSessionQuery.error?.message;
  if (apiError) {
    // Log error mais ne pas throw - permet affichage UI d'erreur gracieux
    logger.error('Dashboard API Error', { apiError }, {
      component: 'useStudentDashboard',
      operation: 'data-loading'
    });

    // Retourner état d'erreur au lieu de throw
    return {
      sessions: [],
      subjects: [],
      loading: false,
      _error: apiError,
      startNewChat,
      deleteSession,
      mode,
      isLoading: false,
      data: null,
      error: apiError,
      isRAGEmpty: false
    };
  }

  // RAG VIDE : Gérer gracieusement (premier déploiement ou maintenance)
  const isRAGEmpty = !subjectsQuery.data || subjectsQuery.data.length === 0;

  // Toutes les matières sont maintenant disponibles depuis RAG
  const allActiveSubjects = subjectsQuery.data ?? [];

  // OPTIMISATION: Convertir latestSession en array pour compatibilité avec composants existants
  // NOTE: Architecture wraps single session in array for backwards compatibility with existing component structure
  const sessions = latestSessionQuery.data ? [latestSessionQuery.data] : [];

  return {
    sessions,
    subjects: allActiveSubjects,
    loading: false,
    _error: null,
    startNewChat,
    deleteSession,
    mode,
    isLoading: false,
    data: null,
    error: null,
    isRAGEmpty
  };
}
