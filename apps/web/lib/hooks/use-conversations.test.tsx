import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const conversationsGet = vi.fn();
const sessionNewPost = vi.fn();
const sessionDelete = vi.fn();
vi.mock("@repo/api", () => ({
  getTreaty: () => ({
    api: {
      chat: {
        conversations: { get: conversationsGet },
        session: Object.assign(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          (_id: { id: string }) => ({ delete: sessionDelete }),
          { new: { post: sessionNewPost } },
        ),
      },
    },
  }),
  unwrap: (r: { data: unknown }) => r.data,
}));
vi.mock("@/lib/auth-client", () => ({ useUser: () => ({ id: "u1" }) }));

import { useConversations } from "./use-conversations";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  conversationsGet.mockReset().mockResolvedValue({
    data: { conversations: [{ id: "s1", title: null, subject: "mathematiques", status: "active", messageCount: 2, lastMessagePreview: "Salut", lastMessageRole: "assistant", lastActivityAt: "2026-06-30T10:00:00Z", startedAt: "2026-06-30T09:00:00Z" }] },
  });
  sessionNewPost.mockReset().mockResolvedValue({ data: { sessionId: "s2" } });
  sessionDelete.mockReset().mockResolvedValue({ data: { success: true } });
});

describe("useConversations", () => {
  it("loads the conversation list", async () => {
    const { result } = renderHook(() => useConversations(), { wrapper });
    await waitFor(() => expect(result.current.conversations).toHaveLength(1));
    expect(result.current.conversations[0].subject).toBe("mathematiques");
  });

  it("createConversation calls the new-session endpoint and returns the id", async () => {
    const { result } = renderHook(() => useConversations(), { wrapper });
    let newId = "";
    await act(async () => { newId = await result.current.createConversation(); });
    expect(sessionNewPost).toHaveBeenCalledOnce();
    expect(newId).toBe("s2");
  });

  it("deleteConversation calls the delete endpoint", async () => {
    const { result } = renderHook(() => useConversations(), { wrapper });
    await act(async () => { await result.current.deleteConversation("s1"); });
    expect(sessionDelete).toHaveBeenCalledOnce();
  });
});
