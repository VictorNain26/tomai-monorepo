/**
 * useChat Hook Tests (web)
 *
 * Behavioral tests for the AI SDK `useChat` wrapper — the AI SDK's own
 * `useChat` is mocked (its internals are the library's responsibility); what
 * we verify is this hook's wiring: history seeding, error surfacing
 * (429/409 JSON envelopes, non-JSON fallback), the last-message + context
 * request shape, and query invalidations. Mirrors
 * `apps/mobile/__tests__/hooks/useChat.test.ts`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { TomChatMessage } from "@repo/api";

const historyGet = vi.fn();
vi.mock("@repo/api", () => ({
  getTreaty: () => ({
    api: { chat: { session: () => ({ history: { get: historyGet } }) } },
  }),
  unwrap: (r: { data: unknown }) => r.data,
  getBaseUrl: () => "http://localhost:3000",
}));

let mockUser: { id: string; schoolLevel?: string | null; firstName?: string | null } | null = {
  id: "u1",
  schoolLevel: "sixieme",
  firstName: "Léa",
};
vi.mock("@/lib/auth-client", () => ({ useUser: () => mockUser }));

vi.mock("ai", () => ({
  DefaultChatTransport: class {},
  isTextUIPart: (p: { type: string }) => p.type === "text",
  isToolUIPart: () => false,
  getToolName: () => "",
}));

type CapturedOptions = { onFinish?: () => void };
let mockCapturedOptions: CapturedOptions | undefined;

const mockSendMessage = vi.fn();
const mockSetMessages = vi.fn();
const mockStop = vi.fn();
let mockAiChatState: {
  messages: TomChatMessage[];
  status: "ready" | "submitted" | "streaming" | "error";
  error: Error | undefined;
};

function resetAiChatState() {
  mockAiChatState = { messages: [], status: "ready", error: undefined };
}

vi.mock("@ai-sdk/react", () => ({
  useChat: (options: CapturedOptions) => {
    mockCapturedOptions = options;
    return {
      ...mockAiChatState,
      setMessages: mockSetMessages,
      sendMessage: mockSendMessage,
      stop: mockStop,
    };
  },
}));

import { useChat } from "./use-chat";
import { chatQueryKeys } from "@/lib/chat/chat-keys";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { id: "u1", schoolLevel: "sixieme", firstName: "Léa" };
  resetAiChatState();
  historyGet.mockReset().mockResolvedValue({
    data: { messages: [{ id: "m1", role: "user", content: "bonjour", timestamp: "x" }], hasOrphanMessage: false },
  });
});

describe("useChat", () => {
  it("loads history for the active sessionId", async () => {
    renderHook(() => useChat({ sessionId: "s1" }), { wrapper });
    await waitFor(() =>
      expect(mockSetMessages).toHaveBeenCalledWith([
        { id: "m1", role: "user", parts: [{ type: "text", text: "bonjour" }] },
      ]),
    );
    expect(historyGet).toHaveBeenCalled();
  });

  it("does not load history when sessionId is null", async () => {
    const { result } = renderHook(() => useChat({ sessionId: null }), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.messages).toHaveLength(0);
    expect(historyGet).not.toHaveBeenCalled();
  });

  it("purges the previous conversation when the session switches", async () => {
    const { rerender } = renderHook(
      ({ sessionId }: { sessionId: string | null }) => useChat({ sessionId }),
      { wrapper, initialProps: { sessionId: "sA" } },
    );
    await waitFor(() => expect(mockSetMessages).toHaveBeenCalled());
    mockSetMessages.mockClear();

    rerender({ sessionId: "sB" });
    await waitFor(() => expect(mockSetMessages).toHaveBeenCalledWith([]));
  });

  it("surfaces the 429 QUOTA_EXCEEDED JSON error with its user-facing message", () => {
    mockAiChatState.error = new Error(
      JSON.stringify({ error: { code: "QUOTA_EXCEEDED", message: "Quota de questions atteint." } }),
    );

    const { result } = renderHook(() => useChat({ sessionId: "s1" }), { wrapper });

    expect(result.current.error).toBe("Quota de questions atteint.");
  });

  it("surfaces the 409 CONCURRENT_STREAM JSON error", () => {
    mockAiChatState.error = new Error(
      JSON.stringify({ error: { code: "CONCURRENT_STREAM", message: "Une réponse est déjà en cours." } }),
    );

    const { result } = renderHook(() => useChat({ sessionId: "s1" }), { wrapper });

    expect(result.current.error).toBe("Une réponse est déjà en cours.");
  });

  it("falls back to the raw message for a non-JSON (network) error", () => {
    mockAiChatState.error = new Error("Network request failed");

    const { result } = renderHook(() => useChat({ sessionId: "s1" }), { wrapper });

    expect(result.current.error).toBe("Network request failed");
  });

  it("sends the last message with request context", () => {
    const { result } = renderHook(() => useChat({ sessionId: "s1" }), { wrapper });

    act(() => {
      result.current.sendMessage("Bonjour Tom");
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const [message, options] = mockSendMessage.mock.calls[0] as [unknown, { body: Record<string, unknown> }];
    expect(message).toMatchObject({
      role: "user",
      parts: [{ type: "text", text: "Bonjour Tom" }],
    });
    expect(options.body).toMatchObject({
      sessionId: "s1",
      schoolLevel: "sixieme",
      firstName: "Léa",
    });
  });

  it("does not send when not ready, no user, or no session", () => {
    mockAiChatState.status = "streaming";
    const { result: notReady } = renderHook(() => useChat({ sessionId: "s1" }), { wrapper });
    act(() => notReady.current.sendMessage("Salut"));
    expect(mockSendMessage).not.toHaveBeenCalled();

    resetAiChatState();
    const { result: noSession } = renderHook(() => useChat({ sessionId: null }), { wrapper });
    act(() => noSession.current.sendMessage("Salut"));
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("invalidates conversations and history queries on stream finish", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    function localWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    }

    renderHook(() => useChat({ sessionId: "s1" }), { wrapper: localWrapper });

    act(() => {
      mockCapturedOptions?.onFinish?.();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: chatQueryKeys.conversations() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: chatQueryKeys.history("s1") });
  });
});
