/**
 * useConversations Hook - Conversation list management
 *
 * Fetches and manages the list of chat conversations.
 * Used by the conversations list screen.
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/lib/auth';

import type { Conversation } from './chat/types';
import {
  chatQueryKeys,
  fetchConversations,
  createNewSession,
  deleteChatSession,
} from './chat/api';

export type { Conversation } from './chat/types';

export function useConversations() {
  const queryClient = useQueryClient();
  const user = useUser();

  const conversationsQuery = useQuery({
    queryKey: chatQueryKeys.conversations(),
    queryFn: fetchConversations,
    enabled: !!user,
    staleTime: 5_000,
    refetchOnMount: 'always',
  });

  const createMutation = useMutation({
    mutationFn: createNewSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.conversations() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteChatSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.conversations() });
    },
  });

  const createConversation = useCallback(async (): Promise<string> => {
    return createMutation.mutateAsync();
  }, [createMutation]);

  const deleteConversation = useCallback(
    async (sessionId: string) => {
      await deleteMutation.mutateAsync(sessionId);
    },
    [deleteMutation],
  );

  return {
    conversations: conversationsQuery.data ?? [] as Conversation[],
    isLoading: conversationsQuery.isLoading,
    error: conversationsQuery.error?.message ?? null,
    refetch: conversationsQuery.refetch,
    isRefetching: conversationsQuery.isRefetching,
    createConversation,
    deleteConversation,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
