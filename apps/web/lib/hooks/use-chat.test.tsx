import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const historyGet = vi.fn();
vi.mock("@repo/api", () => ({
  getTreaty: () => ({
    api: { chat: { session: () => ({ history: { get: historyGet } }) } },
  }),
  unwrap: (r: { data: unknown }) => r.data,
  getBaseUrl: () => "http://localhost:3000",
}));
vi.mock("@/lib/auth-client", () => ({ useUser: () => ({ id: "u1", schoolLevel: "sixieme", firstName: "Léa" }) }));

// Minimal fake of `@ai-sdk/react`'s `useChat` — backed by real React state so
// `setMessages` calls from the hook under test trigger a re-render, like the
// real implementation.
type FakeMessage = { id: string; role: string; parts: { type: string; text: string }[] };
vi.mock("@ai-sdk/react", async () => {
  const React = await import("react");
  return {
    useChat: () => {
      const [messages, setMessages] = React.useState<FakeMessage[]>([]);
      return {
        messages,
        setMessages,
        sendMessage: vi.fn(),
        stop: vi.fn(),
        status: "ready",
        error: undefined,
      };
    },
  };
});
vi.mock("ai", () => ({
  DefaultChatTransport: class {},
  isTextUIPart: (p: { type: string }) => p.type === "text",
  isToolUIPart: () => false,
  getToolName: () => "",
}));

import { useChat } from "./use-chat";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  historyGet.mockReset().mockResolvedValue({
    data: { messages: [{ id: "m1", role: "user", content: "bonjour", timestamp: "x" }], hasOrphanMessage: false },
  });
});

describe("useChat", () => {
  it("loads history for the active sessionId", async () => {
    const { result } = renderHook(() => useChat({ sessionId: "s1" }), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0]).toMatchObject({ role: "user", content: "bonjour" });
    expect(historyGet).toHaveBeenCalled();
  });

  it("does not load history when sessionId is null", async () => {
    const { result } = renderHook(() => useChat({ sessionId: null }), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.messages).toHaveLength(0);
    expect(historyGet).not.toHaveBeenCalled();
  });

  it("purges the previous conversation and loads the new one on switch", async () => {
    historyGet
      .mockReset()
      .mockResolvedValueOnce({ data: { messages: [{ id: "mA", role: "assistant", content: "réponse A", timestamp: "x" }], hasOrphanMessage: false } })
      .mockResolvedValueOnce({ data: { messages: [{ id: "mB", role: "user", content: "question B", timestamp: "x" }], hasOrphanMessage: false } });

    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId: string | null }) => useChat({ sessionId }),
      { wrapper, initialProps: { sessionId: "sA" } },
    );
    await waitFor(() => expect(result.current.messages).toEqual([{ id: "mA", role: "assistant", content: "réponse A" }]));

    rerender({ sessionId: "sB" });
    await waitFor(() => expect(result.current.messages).toEqual([{ id: "mB", role: "user", content: "question B" }]));
    expect(result.current.messages.some((m) => m.id === "mA")).toBe(false);
  });
});
