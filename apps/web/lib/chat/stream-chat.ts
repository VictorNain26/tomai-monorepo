import { getBaseUrl } from "@repo/api";

export type ChatStreamHandlers = {
  onContent: (full: string) => void;
  onStatus: (s: string) => void;
  onError: (msg: string) => void;
  onDone: (meta?: { sessionId?: string }) => void;
};

export class ChatStreamError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "ChatStreamError";
    this.code = code;
  }
}

type ContentChunk = { type: "content"; content: string };
type StatusChunk = { type: "status"; status: string };
type DoneChunk = { type: "done"; metadata?: { sessionId?: string } };
type ErrorChunk = { type: "error"; error?: { message?: string } };
type DeckCreatedChunk = { type: "deck_created" };

type ChatStreamChunk =
  | ContentChunk
  | StatusChunk
  | DoneChunk
  | ErrorChunk
  | DeckCreatedChunk;

function parseChunk(raw: unknown): ChatStreamChunk | null {
  if (
    typeof raw !== "object" ||
    raw === null ||
    !("type" in raw) ||
    typeof (raw as Record<string, unknown>).type !== "string"
  ) {
    return null;
  }
  return raw as ChatStreamChunk;
}

const INACTIVITY_TIMEOUT_MS = 90_000;

export async function streamChat(
  body: {
    content: string;
    sessionId?: string;
    schoolLevel: string;
    firstName?: string;
  },
  handlers: ChatStreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  const internalAbort = new AbortController();

  const combined = AbortSignal.any
    ? AbortSignal.any([signal, internalAbort.signal])
    : internalAbort.signal;

  // Propagate external abort into internal controller
  signal.addEventListener("abort", () => internalAbort.abort(signal.reason), {
    once: true,
  });

  const res = await fetch(`${getBaseUrl()}/api/chat/stream`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: body.content,
      data: {
        sessionId: body.sessionId,
        schoolLevel: body.schoolLevel,
        firstName: body.firstName,
        fileIds: [],
      },
    }),
    signal: combined,
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => null) as {
      error?: { code?: string; message?: string };
      usage?: unknown;
    } | null;
    const code = err?.error?.code;
    const message =
      code === "QUOTA_EXCEEDED"
        ? "Quota de questions atteint."
        : code === "CONCURRENT_STREAM"
          ? "Une réponse est déjà en cours."
          : (err?.error?.message ?? "Le chat est indisponible.");
    throw new ChatStreamError(message, code);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const resetTimeout = () => {
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      internalAbort.abort();
      handlers.onError("Le serveur ne répond plus. Réessaie.");
    }, INACTIVITY_TIMEOUT_MS);
  };

  const cleanup = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  resetTimeout();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      resetTimeout();
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      // Keep the last (possibly incomplete) segment in the buffer
      buffer = events.pop() ?? "";

      for (const event of events) {
        const dataLine = event
          .split("\n")
          .find((line) => line.startsWith("data: "));
        if (!dataLine) continue;

        const payload = dataLine.slice("data: ".length);
        if (payload === "[DONE]") {
          handlers.onDone();
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }

        const chunk = parseChunk(parsed);
        if (!chunk) continue;

        switch (chunk.type) {
          case "content":
            handlers.onContent(chunk.content);
            break;
          case "status":
            handlers.onStatus(chunk.status);
            break;
          case "done":
            handlers.onDone(chunk.metadata);
            return;
          case "error":
            handlers.onError(chunk.error?.message ?? "Erreur du serveur.");
            return;
          case "deck_created":
            // ignored in this batch
            break;
        }
      }
    }
  } finally {
    cleanup();
    reader.releaseLock();
  }
}
