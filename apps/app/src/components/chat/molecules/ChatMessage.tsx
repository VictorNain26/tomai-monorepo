/**
 * ChatMessage - Molecule message complet
 *
 * ChatMessage simple - Combine MessageAvatar + MessageBubble + MessageRenderer
 * Note: Fichiers attachés affichés dans panneau Documents séparé
 */

import { type ReactElement } from 'react';
import type { ChatMessage as ChatMessageType } from '@/hooks/useChat';
import { cn } from '@/lib/utils';
import { MessageAvatar } from '../atoms/MessageAvatar';
import { MessageBubble } from '../atoms/MessageBubble';
import MessageRenderer from '@/components/MessageRenderer';
import { MessageAudioButton } from '@/components/MessageAudioButton';

export interface ChatMessageProps {
  message: ChatMessageType;
  /** True si ce message est le dernier ET que le chat est en streaming */
  isStreaming?: boolean;
  isAudioEnabled?: boolean;
  className?: string;
}

export function ChatMessage({
  message,
  isStreaming = false,
  isAudioEnabled = false,
  className
}: ChatMessageProps): ReactElement {
  const { role, content, id } = message;
  const isUser = role === 'user';

  // Thinking = assistant message sans contenu pendant streaming
  const isThinking = !isUser && isStreaming && content.length === 0;
  // Streaming actif = assistant message avec contenu qui arrive
  const isActiveStreaming = !isUser && isStreaming && content.length > 0;

  return (
    <div
      className={cn(
        'flex mb-4',
        isUser ? 'justify-end' : 'justify-start',
        className
      )}
    >
      <div
        className={cn(
          'relative max-w-[95%] sm:max-w-[85%] md:max-w-[75%] lg:max-w-[70%]',
          isUser ? 'text-right' : 'text-left'
        )}
      >
        {/* Avatar positionné absolument */}
        <div
          className={cn(
            'absolute -top-2 z-10',
            isUser ? '-right-2' : '-left-2'
          )}
        >
          <MessageAvatar role={role} size="md" />
        </div>

        {/* Message bubble */}
        <MessageBubble role={role}>
          <MessageRenderer
            content={content}
            messageId={id}
            isUser={isUser}
            isThinking={isThinking}
            isStreaming={isActiveStreaming}
            autoSpeak={isAudioEnabled}
          />
        </MessageBubble>

        {/* Audio button pour messages assistant (uniquement si complet) */}
        {!isUser && !isThinking && !isActiveStreaming && isAudioEnabled && content.length > 0 && (
          <div className="flex justify-end mt-2">
            <MessageAudioButton
              content={content}
              messageId={id}
            />
          </div>
        )}
      </div>
    </div>
  );
}
