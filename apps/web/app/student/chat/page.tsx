"use client";

import { useState } from "react";
import { Button, Skeleton, cn } from "@repo/ui";
import { Menu, X } from "lucide-react";
import { useChat } from "@/lib/hooks/use-chat";
import { useConversations } from "@/lib/hooks/use-conversations";
import { ConversationSidebar } from "@/components/student/chat/conversation-sidebar";
import { ChatMessageList } from "@/components/student/chat/chat-message-list";
import { ChatInput } from "@/components/student/chat/chat-input";
import { ChatStatus } from "@/components/student/chat/chat-status";

export default function StudentChatPage() {
  // null = user has not picked a conversation yet; first in list is used as default.
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    conversations, isLoading: listLoading, error: listError,
    isCreating, isDeleting, createConversation, deleteConversation,
  } = useConversations();

  // Derive the effective session: explicit choice > first available > null.
  // Avoids calling setState inside an effect for the "land on first conversation" case.
  const effectiveSessionId = activeSessionId ?? conversations[0]?.id ?? null;

  const { messages, isLoading, isStreaming, streamStatus, error, sendMessage } =
    useChat({ sessionId: effectiveSessionId });

  async function handleNew() {
    const id = await createConversation();
    setActiveSessionId(id);
    setSidebarOpen(false);
  }

  function handleSelect(id: string) {
    setActiveSessionId(id);
    setSidebarOpen(false);
  }

  async function handleDelete(id: string) {
    await deleteConversation(id);
    if (id === activeSessionId) setActiveSessionId(null);
  }

  return (
    <div className="flex h-full">
      {/* Sidebar — colonne sur md+, drawer overlay sur mobile */}
      <aside
        className={cn(
          "z-40 w-72 shrink-0 border-r bg-background md:static md:block",
          sidebarOpen ? "fixed inset-y-0 left-0 block" : "hidden md:block",
        )}
      >
        <ConversationSidebar
          conversations={conversations}
          activeSessionId={effectiveSessionId}
          isLoading={listLoading}
          error={listError}
          isCreating={isCreating}
          isDeleting={isDeleting}
          onSelect={handleSelect}
          onNew={handleNew}
          onDelete={handleDelete}
        />
      </aside>

      {/* Backdrop mobile */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Fermer la liste"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/80 md:hidden"
        />
      )}

      {/* Panneau conversation active */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={sidebarOpen ? "Fermer la liste" : "Ouvrir la liste des conversations"}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
          <h1 className="text-lg font-semibold">Tom</h1>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto">
            {!effectiveSessionId ? (
              <div className="flex h-full items-center justify-center px-4 py-8 text-center text-muted-foreground">
                <p>Démarre ta première conversation avec Tom.</p>
              </div>
            ) : isLoading ? (
              <div className="flex flex-col gap-3 px-4 py-4" aria-busy="true" aria-label="Chargement de la conversation">
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-10 w-1/2 self-end" />
                <Skeleton className="h-10 w-2/3" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center px-4 py-8 text-center text-muted-foreground">
                <p>Pose ta première question à Tom</p>
              </div>
            ) : (
              <ChatMessageList messages={messages} />
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="mx-4 mb-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <ChatStatus status={streamStatus} />
          <ChatInput onSend={sendMessage} disabled={isStreaming || !effectiveSessionId} />
        </main>
      </div>
    </div>
  );
}
