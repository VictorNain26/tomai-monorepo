/**
 * useChat Hook (web)
 *
 * Orchestrates session creation, history load, and SSE streaming for the
 * student chat. Session is created lazily on first user load; history is
 * fetched once and merged into local state. Streaming state is managed
 * locally so the UI can update incrementally without React Query involvement.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTreaty, unwrap } from "@repo/api";
import { useUser } from "@/lib/auth-client";
import { streamChat, ChatStreamError } from "@/lib/chat/stream-chat";

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
type HistoryMessage = NonNullable<
  Awaited<
    ReturnType<ReturnType<ChatApi["session"]>["history"]["get"]>
  >["data"]
>["messages"][number];

const queryKeys = {
  session: (userId: string) => ["chat", "session", userId] as const,
  history: (sessionId: string) => ["chat", "history", sessionId] as const,
};

async function fetchOrCreateSession(): Promise<string> {
  const data = unwrap(await getTreaty().api.chat.session.post());
  return data.sessionId;
}

async function fetchHistory(sessionId: string): Promise<HistoryMessage[]> {
  const data = unwrap(
    await getTreaty().api.chat.session({ id: sessionId }).history.get()
  );
  return data.messages;
}

export function useChat() {
  const user = useUser() as ExtendedUser | null;
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Track which session's history has been synced into local state
  const [syncedSessionId, setSyncedSessionId] = useState<string | null>(null);

  // Mutable refs: no re-render needed on change
  const sessionIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 1. getOrCreate session
  const sessionQuery = useQuery({
    queryKey: queryKeys.session(user?.id ?? ""),
    queryFn: fetchOrCreateSession,
    enabled: !!user?.id,
    staleTime: Infinity,
  });

  const currentSessionId = sessionQuery.data ?? null;

  useEffect(() => {
    if (currentSessionId) {
      sessionIdRef.current = currentSessionId;
    }
  }, [currentSessionId]);

  // 2. Load history once we have a session ID
  const historyQuery = useQuery({
    queryKey: queryKeys.history(currentSessionId ?? "__none__"),
    queryFn: () => fetchHistory(currentSessionId!),
    enabled: !!currentSessionId,
    staleTime: Infinity,
  });

  // Sync server history into local messages state.
  // React 19 pattern: update state during render (not in useEffect) so the
  // first render after data arrives already shows the history.
  if (
    historyQuery.data &&
    currentSessionId &&
    syncedSessionId !== currentSessionId
  ) {
    setSyncedSessionId(currentSessionId);
    setMessages(
      historyQuery.data.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
      }))
    );
  }

  // Abort any in-flight stream on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming || !user) return;

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
        // Remove the assistant placeholder if nothing was streamed yet
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
          sessionId: sessionIdRef.current ?? undefined,
          schoolLevel: user.schoolLevel ?? "",
          firstName: user.firstName ?? undefined,
        },
        {
          onContent: (full) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId ? { ...m, content: full } : m
              )
            );
          },
          onStatus: (s) => setStreamStatus(s),
          onError: handleStreamError,
          onDone: () => {
            setIsStreaming(false);
            setStreamStatus("");
          },
        },
        ac.signal
      ).catch((err: unknown) => {
        const msg =
          err instanceof ChatStreamError
            ? err.message
            : "Le chat est indisponible. Réessaie.";
        handleStreamError(msg);
      });
    },
    [isStreaming, user]
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    const sid = sessionIdRef.current;

    void (async () => {
      if (sid) {
        try {
          const data = unwrap(
            await getTreaty().api.chat.session({ id: sid }).reset.post()
          );
          sessionIdRef.current = data.sessionId;
          if (user?.id) {
            queryClient.setQueryData(
              queryKeys.session(user.id),
              data.sessionId
            );
          }
        } catch (err) {
          console.error("[useChat] reset failed", err);
        }
      }
    })();

    setMessages([]);
    setIsStreaming(false);
    setStreamStatus("");
    setError(null);
    setSyncedSessionId(null);
  }, [queryClient, user]);

  return {
    messages,
    isLoading: sessionQuery.isLoading || historyQuery.isLoading,
    isStreaming,
    streamStatus,
    error:
      error ??
      (historyQuery.error instanceof Error
        ? historyQuery.error.message
        : null) ??
      (sessionQuery.error instanceof Error
        ? sessionQuery.error.message
        : null),
    sendMessage,
    reset,
  };
}
