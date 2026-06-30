// apps/web/components/student/chat/conversation-list-item.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConversationListItem } from "./conversation-list-item";
import type { Conversation } from "@/lib/hooks/use-conversations";

const base: Conversation = {
  id: "s1", title: null, subject: "mathematiques", status: "active",
  messageCount: 3, lastMessagePreview: "On revoit les fractions",
  lastMessageRole: "assistant", lastActivityAt: new Date().toISOString(),
  startedAt: new Date().toISOString(),
};

describe("ConversationListItem", () => {
  it("shows a fallback title and the subject label", () => {
    render(<ConversationListItem conversation={base} isActive={false} onSelect={vi.fn()} onDelete={vi.fn()} isDeleting={false} />);
    expect(screen.getByText("Nouvelle conversation")).toBeInTheDocument();
    expect(screen.getByText("Maths")).toBeInTheDocument();
  });

  it("prefixes the preview with 'Tom : ' when the last message is from the assistant", () => {
    render(<ConversationListItem conversation={base} isActive={false} onSelect={vi.fn()} onDelete={vi.fn()} isDeleting={false} />);
    expect(screen.getByText(/Tom : On revoit les fractions/)).toBeInTheDocument();
  });

  it("calls onSelect when the row is activated", () => {
    const onSelect = vi.fn();
    render(<ConversationListItem conversation={base} isActive={false} onSelect={onSelect} onDelete={vi.fn()} isDeleting={false} />);
    fireEvent.click(screen.getByRole("button", { name: /ouvrir la conversation/i }));
    expect(onSelect).toHaveBeenCalledWith("s1");
  });

  it("confirms before deleting", () => {
    const onDelete = vi.fn();
    render(<ConversationListItem conversation={base} isActive={false} onSelect={vi.fn()} onDelete={onDelete} isDeleting={false} />);
    fireEvent.click(screen.getByRole("button", { name: /supprimer la conversation/i }));
    fireEvent.click(screen.getByRole("button", { name: /^supprimer$/i }));
    expect(onDelete).toHaveBeenCalledWith("s1");
  });
});
