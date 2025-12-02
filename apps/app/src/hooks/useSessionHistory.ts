/**
 * Hook useSessionHistory - Gestion de l'historique des sessions
 * MVP: Liste des sessions avec actions de base
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { chatQueries, chatMutations, queryKeys } from '@/lib/query-factories';
import { logger } from '@/lib/logger';
import { getMessage, ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/constants/messages';

export interface SessionHistoryItem {
  id: string;
  subject: string;
  startedAt: string;
  endedAt?: string;
  messagesCount: number;
}

interface UseSessionHistoryReturn {
  sessions: SessionHistoryItem[];
  isLoading: boolean;
  error: string | null;
  resumeSession: (sessionId: string, subject: string) => void;
  deleteSession: (sessionId: string) => Promise<void>;
  isDeleting: boolean;
}

export function useSessionHistory(): UseSessionHistoryReturn {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch all sessions (limit 50 for history page)
  const sessionsQuery = useQuery({
    ...chatQueries.sessions(50),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    ...chatMutations.deleteSession(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.all });
      const successMessage = getMessage(SUCCESS_MESSAGES.chat.sessionDeleted, 'lycee');
      toast.success(successMessage);
    },
    onError: (error: Error) => {
      logger.error('Error deleting session', error, {
        component: 'useSessionHistory',
        operation: 'deleteSession',
      });
      const errorMessage = getMessage(ERROR_MESSAGES.chat.sendMessageFailed, 'lycee');
      toast.error(errorMessage);
    },
  });

  const resumeSession = (sessionId: string, subject: string) => {
    void navigate(`/student/chat?sessionId=${encodeURIComponent(sessionId)}&subject=${encodeURIComponent(subject)}`);
  };

  const deleteSession = async (sessionId: string) => {
    await deleteMutation.mutateAsync(sessionId);
  };

  return {
    sessions: sessionsQuery.data ?? [],
    isLoading: sessionsQuery.isLoading,
    error: sessionsQuery.error?.message ?? null,
    resumeSession,
    deleteSession,
    isDeleting: deleteMutation.isPending,
  };
}
