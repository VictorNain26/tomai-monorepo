/**
 * ChatConversation - Organism conversation complète
 *
 * TanStack AI Protocol 2025 - UIMessage avec parts[]
 * Combine MessagesList + ChatError + EmptyState
 */

import { type ReactElement } from 'react';
import { MessageCircle } from 'lucide-react';
import type { UIMessage } from '@tanstack/ai-react';
import { cn } from '@/lib/utils';
import { MessagesList } from '../molecules/MessagesList';
import { ChatError } from '../molecules/ChatError';

export interface ChatConversationProps {
  messages: UIMessage[];
  /** True si le chat est en cours de streaming */
  isLoading?: boolean;
  error?: string | null;
  isAudioEnabled?: boolean;
  emptyStateMessage?: string;
  className?: string;
}

export function ChatConversation({
  messages,
  isLoading = false,
  error,
  isAudioEnabled = false,
  emptyStateMessage = 'Aucun message pour le moment. Commencez la conversation !',
  className
}: ChatConversationProps): ReactElement {
  // UIMessage n'a que 'user' et 'assistant' roles (pas de 'system')
  const displayMessages = messages;

  // Empty state
  if (displayMessages.length === 0 && !error) {
    return (
      <div className={cn('h-full flex items-center justify-center p-6', className)}>
        <div className="text-center text-muted-foreground max-w-md">
          <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">{emptyStateMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('h-full flex flex-col', className)}>
      {/* Error state en haut */}
      {error && (
        <div className="flex-shrink-0 p-4 pb-0">
          <ChatError error={error} />
        </div>
      )}

      {/* Messages list - prend tout l'espace et gère son propre scroll */}
      <MessagesList
        messages={displayMessages}
        isLoading={isLoading}
        isAudioEnabled={isAudioEnabled}
        className="flex-1 min-h-0"
      />
    </div>
  );
}
