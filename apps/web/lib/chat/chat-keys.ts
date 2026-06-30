/**
 * Clés TanStack Query partagées par use-chat et use-conversations, pour que
 * l'invalidation cross-hook touche les mêmes entrées de cache. Alignées sur la
 * convention mobile (apps/mobile/src/hooks/chat/api.ts).
 */
export const chatQueryKeys = {
  conversations: () => ["chat", "conversations"] as const,
  history: (sessionId: string) => ["chat", "history", sessionId] as const,
};
