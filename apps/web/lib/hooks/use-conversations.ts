/**
 * useConversations (web) — gestion de la liste de conversations.
 * Miroir du hook mobile (apps/mobile/src/hooks/useConversations.ts) : même
 * contrat serveur via @repo/api, même forme TanStack Query.
 */
import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTreaty, unwrap, type ResponseData } from "@repo/api";
import { useUser } from "@/lib/auth-client";
import { chatQueryKeys } from "@/lib/chat/chat-keys";

type ChatApi = ReturnType<typeof getTreaty>["api"]["chat"];

/** Élément de liste — dérivé de `GET /api/chat/conversations`. */
export type Conversation = ResponseData<ChatApi["conversations"]["get"]>["conversations"][number];

async function fetchConversations(): Promise<Conversation[]> {
  const { conversations } = unwrap(await getTreaty().api.chat.conversations.get());
  return conversations;
}

async function createNewSession(): Promise<string> {
  const { sessionId } = unwrap(await getTreaty().api.chat.session.new.post());
  return sessionId;
}

async function deleteChatSession(sessionId: string): Promise<void> {
  unwrap(await getTreaty().api.chat.session({ id: sessionId }).delete());
}

export function useConversations() {
  const queryClient = useQueryClient();
  const user = useUser();

  const conversationsQuery = useQuery({
    queryKey: chatQueryKeys.conversations(),
    queryFn: fetchConversations,
    enabled: !!user,
    staleTime: 5_000,
    refetchOnMount: "always",
  });

  const createMutation = useMutation({
    mutationFn: createNewSession,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.conversations() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteChatSession,
    // Optimistic removal so the list (and the page's derived active session)
    // updates synchronously — avoids a transient fetch on the just-deleted id.
    onMutate: async (sessionId) => {
      await queryClient.cancelQueries({ queryKey: chatQueryKeys.conversations() });
      const previous = queryClient.getQueryData<Conversation[]>(chatQueryKeys.conversations());
      queryClient.setQueryData<Conversation[]>(chatQueryKeys.conversations(), (old) =>
        (old ?? []).filter((c) => c.id !== sessionId),
      );
      return { previous };
    },
    onError: (_err, _sessionId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(chatQueryKeys.conversations(), context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.conversations() });
    },
  });

  const createConversation = useCallback(() => createMutation.mutateAsync(), [createMutation]);
  const deleteConversation = useCallback(
    (sessionId: string) => deleteMutation.mutateAsync(sessionId),
    [deleteMutation],
  );

  return {
    conversations: conversationsQuery.data ?? [],
    isLoading: conversationsQuery.isLoading,
    error: conversationsQuery.error instanceof Error ? conversationsQuery.error.message : null,
    refetch: conversationsQuery.refetch,
    isRefetching: conversationsQuery.isRefetching,
    createConversation,
    deleteConversation,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
