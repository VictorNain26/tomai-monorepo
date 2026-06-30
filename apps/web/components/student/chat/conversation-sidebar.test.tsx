// apps/web/components/student/chat/conversation-sidebar.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConversationSidebar } from "./conversation-sidebar";
import type { Conversation } from "@/lib/hooks/use-conversations";

const conv: Conversation = {
  id: "s1", title: "Fractions", subject: "mathematiques", status: "active",
  messageCount: 1, lastMessagePreview: "ok", lastMessageRole: "user",
  lastActivityAt: new Date().toISOString(), startedAt: new Date().toISOString(),
};
const noop = { onSelect: vi.fn(), onNew: vi.fn(), onDelete: vi.fn() };

describe("ConversationSidebar", () => {
  it("shows a skeleton while loading", () => {
    render(<ConversationSidebar conversations={[]} activeSessionId={null} isLoading error={null} isCreating={false} isDeleting={false} {...noop} />);
    expect(screen.getByLabelText(/chargement des conversations/i)).toBeInTheDocument();
  });
  it("shows an empty state when there are no conversations", () => {
    render(<ConversationSidebar conversations={[]} activeSessionId={null} isLoading={false} error={null} isCreating={false} isDeleting={false} {...noop} />);
    expect(screen.getByText(/aucune conversation/i)).toBeInTheDocument();
  });
  it("shows an error state", () => {
    render(<ConversationSidebar conversations={[]} activeSessionId={null} isLoading={false} error="boom" isCreating={false} isDeleting={false} {...noop} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/boom|conversations/i);
  });
  it("renders the list and triggers onNew", () => {
    const onNew = vi.fn();
    render(<ConversationSidebar conversations={[conv]} activeSessionId="s1" isLoading={false} error={null} isCreating={false} isDeleting={false} onSelect={vi.fn()} onNew={onNew} onDelete={vi.fn()} />);
    expect(screen.getByText("Fractions")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /nouvelle conversation/i }));
    expect(onNew).toHaveBeenCalledOnce();
  });
});
