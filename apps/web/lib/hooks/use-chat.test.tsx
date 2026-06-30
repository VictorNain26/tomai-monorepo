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
}));
vi.mock("@/lib/auth-client", () => ({ useUser: () => ({ id: "u1", schoolLevel: "sixieme", firstName: "Léa" }) }));
vi.mock("@/lib/chat/stream-chat", () => ({
  streamChat: vi.fn(),
  ChatStreamError: class extends Error {},
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
});
