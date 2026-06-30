// apps/web/components/student/chat/conversation-sidebar.tsx
"use client";

import { Button, Skeleton } from "@repo/ui";
import { Plus } from "lucide-react";
import { ConversationListItem } from "./conversation-list-item";
import type { Conversation } from "@/lib/hooks/use-conversations";

export function ConversationSidebar({
  conversations, activeSessionId, isLoading, error, isCreating, isDeleting,
  onSelect, onNew, onDelete,
}: {
  conversations: Conversation[];
  activeSessionId: string | null;
  isLoading: boolean;
  error: string | null;
  isCreating: boolean;
  isDeleting: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <Button onClick={onNew} disabled={isCreating} className="w-full justify-start gap-2">
        <Plus className="size-4" />
        Nouvelle conversation
      </Button>

      <nav aria-label="Conversations" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-1" aria-busy="true" aria-label="Chargement des conversations">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : error ? (
          <div role="alert" className="m-1 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Impossible de charger les conversations.
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Aucune conversation. Démarre la première avec Tom.
          </p>
        ) : (
          conversations.map((c) => (
            <ConversationListItem
              key={c.id}
              conversation={c}
              isActive={c.id === activeSessionId}
              onSelect={onSelect}
              onDelete={onDelete}
              isDeleting={isDeleting}
            />
          ))
        )}
      </nav>
    </div>
  );
}
