/**
 * useChat Hook (web) — piloté par la conversation active (`sessionId`).
 *
 * La conversation active est fournie par le container (page chat) ; ce hook
 * charge l'historique de cette conversation et gère le streaming SSE en state
 * local pour un rendu incrémental. La création / rotation de conversation
 * vit dans useConversations (non destructif).
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTreaty, unwrap, type ResponseData } from "@repo/api";
import { useUser } from "@/lib/auth-client";
import { streamChat, ChatStreamError } from "@/lib/chat/stream-chat";
import { chatQueryKeys } from "@/lib/chat/chat-keys";

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

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [syncedSessionId, setSyncedSessionId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const historyQuery = useQuery({
    queryKey: chatQueryKeys.history(sessionId ?? "__none__"),
    queryFn: () => fetchHistory(sessionId!),
    enabled: !!sessionId,
    staleTime: Infinity,
  });

  // Detect conversation switch during render and reset per-conversation state
  // (React 19 pattern: batched state updates during render, avoids calling
  // setState inside an effect — set-state-in-effect lint rule).
  const [prevSessionId, setPrevSessionId] = useState<string | null>(null);
  if (prevSessionId !== sessionId) {
    setPrevSessionId(sessionId);
    setMessages([]);
    setSyncedSessionId(null);
    setError(null);
    setIsStreaming(false);
    setStreamStatus("");
  }

  // Effect: side effect only — abort any in-flight SSE stream when the
  // conversation switches (no setState here to satisfy set-state-in-effect).
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, [sessionId]);

  // Populate from server history once it arrives (React 19: state update during
  // render so the first render after data lands already shows the history).
  if (historyQuery.data && sessionId && syncedSessionId !== sessionId) {
    setSyncedSessionId(sessionId);
    setMessages(
      historyQuery.data.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    );
  }

  // Abort on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming || !user || !sessionId) return;

      const userMessageId = crypto.randomUUID();
      const assistantMessageId = crypto.randomUUID();

      setMessages((prev) => [
        ...prev,
        { id: userMessageId, role: "user", content: trimmed },
        { id: assistantMessageId, role: "assistant", content: "" },
      ]);
      setIsStreaming(true);
      setError(null);

      const ac = new AbortController();
      abortRef.current = ac;

      function handleStreamError(msg: string) {
        setError(msg);
        setMessages((prev) => {
          const placeholder = prev.find((m) => m.id === assistantMessageId);
          return placeholder?.content === ""
            ? prev.filter((m) => m.id !== assistantMessageId)
            : prev;
        });
        setIsStreaming(false);
      }

      void streamChat(
        {
          content: trimmed,
          sessionId,
          schoolLevel: user.schoolLevel ?? "",
          firstName: user.firstName ?? undefined,
        },
        {
          onContent: (full) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId ? { ...m, content: full } : m,
              ),
            );
          },
          onStatus: (s) => setStreamStatus(s),
          onError: handleStreamError,
          onDone: () => {
            setIsStreaming(false);
            setStreamStatus("");
            // Refresh the list so the new preview/subject/order shows up.
            void queryClient.invalidateQueries({
              queryKey: chatQueryKeys.conversations(),
            });
          },
        },
        ac.signal,
      ).catch((err: unknown) => {
        const msg =
          err instanceof ChatStreamError
            ? err.message
            : "Le chat est indisponible. Réessaie.";
        handleStreamError(msg);
      });
    },
    [isStreaming, user, sessionId, queryClient],
  );

  return {
    messages,
    isLoading: !!sessionId && historyQuery.isLoading,
    isStreaming,
    streamStatus,
    error:
      error ??
      (historyQuery.error instanceof Error ? historyQuery.error.message : null),
    sendMessage,
  };
}
