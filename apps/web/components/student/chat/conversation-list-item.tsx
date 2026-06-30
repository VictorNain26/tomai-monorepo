// apps/web/components/student/chat/conversation-list-item.tsx
"use client";

import {
  Badge, Button,
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
  cn,
} from "@repo/ui";
import { Trash2 } from "lucide-react";
import { formatRelativeDate } from "@/lib/chat/format-relative-date";
import type { Conversation } from "@/lib/hooks/use-conversations";

const SUBJECT_LABELS: Record<string, string> = {
  mathematiques: "Maths",
  francais: "Français",
  langues: "Langues",
  sciences: "Sciences",
  "histoire-geo": "Histoire-Géo",
};

export function subjectLabel(subject: string): string {
  return SUBJECT_LABELS[subject] ?? "Général";
}

export function ConversationListItem({
  conversation, isActive, onSelect, onDelete, isDeleting,
}: {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const title = conversation.title ?? "Nouvelle conversation";
  const preview = conversation.lastMessagePreview
    ? `${conversation.lastMessageRole === "assistant" ? "Tom : " : ""}${conversation.lastMessagePreview}`
    : "Pas encore de message";

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-1 rounded-md border px-3 py-2 transition-colors",
        isActive ? "border-primary bg-accent" : "border-transparent hover:bg-accent/60",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        aria-label={`Ouvrir la conversation ${title}`}
        aria-current={isActive ? "true" : undefined}
        className="flex flex-col gap-1 rounded-sm pr-7 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{title}</span>
          <Badge variant="secondary" className="shrink-0">{subjectLabel(conversation.subject)}</Badge>
        </div>
        <span className="truncate text-xs text-muted-foreground">{preview}</span>
        <span className="text-xs text-muted-foreground">{formatRelativeDate(conversation.lastActivityAt)}</span>
      </button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={isDeleting}
            aria-label={`Supprimer la conversation ${title}`}
            className="absolute right-1 top-1 size-7 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 className="size-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette conversation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. Les messages de « {title} » seront effacés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(conversation.id)}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
