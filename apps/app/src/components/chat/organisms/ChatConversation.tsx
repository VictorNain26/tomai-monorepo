/**
 * ChatConversation - Organism conversation complète
 *
 * Combine MessagesList + ChatError + EmptyState
 * NEW: Supporte affichage des séparateurs de conversation
 */

import { type ReactElement } from 'react';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MessagesList } from '../molecules/MessagesList';
import { ChatError } from '../molecules/ChatError';
import type { IMessage } from '@/types';

export interface ChatConversationProps {
  messages: IMessage[];
  error?: string | null;
  isAudioEnabled?: boolean;
  emptyStateMessage?: string;
  className?: string;
}

export function ChatConversation({
  messages,
  error,
  isAudioEnabled = false,
  emptyStateMessage = 'Aucun message pour le moment. Commencez la conversation !',
  className
}: ChatConversationProps): ReactElement {
  // Filter out system messages (not displayed to user)
  const displayMessages = messages.filter(msg => msg.role !== 'system');

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
        isAudioEnabled={isAudioEnabled}
        className="flex-1 min-h-0"
      />
    </div>
  );
}
