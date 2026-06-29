"use client";

import { Skeleton, Button } from "@repo/ui";
import { useChat } from "@/lib/hooks/use-chat";
import { ChatMessageList } from "@/components/student/chat/chat-message-list";
import { ChatInput } from "@/components/student/chat/chat-input";
import { ChatStatus } from "@/components/student/chat/chat-status";

export default function StudentChatPage() {
  const { messages, isLoading, isStreaming, streamStatus, error, sendMessage, reset } = useChat();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Tom</h1>
        <Button variant="outline" size="sm" onClick={reset}>
          Nouvelle conversation
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
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

      <div className="shrink-0">
        {error && (
          <div
            role="alert"
            className="mx-4 mb-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <ChatStatus status={streamStatus} />
        <ChatInput onSend={sendMessage} disabled={isStreaming} />
      </div>
    </div>
  );
}
