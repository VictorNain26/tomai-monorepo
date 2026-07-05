/**
 * useChat Hook (web) — piloté par la conversation active (`sessionId`).
 *
 * Thin wrapper around `@ai-sdk/react`'s `useChat`: TanStack Query history
 * seeds the initial messages, `sendMessage` attaches the request context
 * (session, school level, first name) and the server is authoritative on
 * history — only the last `UIMessage` is ever sent
 * (`prepareSendMessagesRequest`).
 *
 * The public surface (`ChatMessage[]` with flat `content`) is preserved for
 * the screen — the AI SDK `TomChatMessage[]` (`.parts`) lives entirely
 * inside this hook. La création / rotation de conversation vit dans
 * useConversations (non destructif).
 *
 * @see ../chat/ui-message.ts
 */

import { useEffect, useMemo, useRef } from "react";
import { useChat as useAiChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBaseUrl, getTreaty, unwrap, type ResponseData } from "@repo/api";
import type { TomChatMessage } from "@repo/api";
import { useUser } from "@/lib/auth-client";
import { chatQueryKeys } from "@/lib/chat/chat-keys";
import {
  toTomChatMessage,
  extractText,
  parseTransportErrorMessage,
  deriveStreamStatus,
} from "@/lib/chat/ui-message";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

// Better Auth additionalFields (firstName, schoolLevel) are returned at runtime
// but not in the base client type — intersect them explicitly.
type BaseUser = NonNullable<ReturnType<typeof useUser>>;
type ExtendedUser = BaseUser & {
  firstName?: string | null;
  schoolLevel?: string | null;
};

type ChatApi = ReturnType<typeof getTreaty>["api"]["chat"];
type SessionById = ReturnType<ChatApi["session"]>;
type HistoryMessage = ResponseData<SessionById["history"]["get"]>["messages"][number];

async function fetchHistory(sessionId: string): Promise<HistoryMessage[]> {
  const data = unwrap(
    await getTreaty().api.chat.session({ id: sessionId }).history.get(),
  );
  return data.messages;
}

export function useChat({ sessionId }: { sessionId: string | null }) {
  const user = useUser() as ExtendedUser | null;
  const queryClient = useQueryClient();

  const clearedSessionRef = useRef<string | null>(null);
  const syncedHistoryRef = useRef<string | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<TomChatMessage>({
        api: `${getBaseUrl()}/api/chat/stream`,
        credentials: "include",
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { message: messages.at(-1), ...body },
        }),
      }),
    [],
  );

  const aiChat = useAiChat<TomChatMessage>({
    transport,
    onFinish: () => {
      if (!sessionId) return;
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.conversations() });
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.history(sessionId) });
    },
  });

  const historyQuery = useQuery({
    queryKey: chatQueryKeys.history(sessionId ?? "__none__"),
    queryFn: () => fetchHistory(sessionId!),
    enabled: !!sessionId,
    staleTime: Infinity,
  });

  // Reset per-conversation chat state and abort any in-flight stream when
  // the active session switches (guarded so re-runs triggered by `aiChat`
  // identity churn during streaming are no-ops).
  useEffect(() => {
    if (clearedSessionRef.current === sessionId) return;
    clearedSessionRef.current = sessionId;
    void aiChat.stop();
    aiChat.setMessages([]);
  }, [sessionId, aiChat]);

  // Populate from server history once it arrives, once per session.
  useEffect(() => {
    if (!historyQuery.data || !sessionId) return;
    if (syncedHistoryRef.current === sessionId) return;
    syncedHistoryRef.current = sessionId;

    const seeded = historyQuery.data
      .filter(
        (m): m is HistoryMessage & { role: "user" | "assistant" } =>
          m.role === "user" || m.role === "assistant",
      )
      .map((m) => toTomChatMessage({ id: m.id, role: m.role, content: m.content }));
    if (seeded.length > 0) aiChat.setMessages(seeded);
  }, [historyQuery.data, sessionId, aiChat]);

  // Abort on unmount — the ref is kept current via its own effect (never
  // mutated during render) so the unmount effect can close over `[]` deps.
  const aiChatRef = useRef(aiChat);
  useEffect(() => {
    aiChatRef.current = aiChat;
  });
  useEffect(() => () => void aiChatRef.current.stop(), []);

  function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || aiChat.status !== "ready" || !user || !sessionId) return;

    void aiChat.sendMessage(
      { role: "user", parts: [{ type: "text", text: trimmed }] },
      {
        body: {
          sessionId,
          schoolLevel: user.schoolLevel ?? undefined,
          firstName: user.firstName ?? undefined,
        },
      },
    );
  }

  const messages: ChatMessage[] = aiChat.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: extractText(m.parts),
    }));

  const isStreaming = aiChat.status === "streaming" || aiChat.status === "submitted";
  const transportError = aiChat.error ? parseTransportErrorMessage(aiChat.error) : null;

  return {
    messages,
    isLoading: !!sessionId && historyQuery.isLoading,
    isStreaming,
    streamStatus: isStreaming ? deriveStreamStatus(aiChat.messages.at(-1)) : "",
    error:
      transportError ??
      (historyQuery.error instanceof Error ? historyQuery.error.message : null),
    sendMessage,
  };
}
