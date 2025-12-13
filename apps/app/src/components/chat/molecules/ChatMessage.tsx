/**
 * ChatMessage - Molecule message complet
 *
 * TanStack AI Protocol 2025 - UIMessage avec parts[]
 * Combine MessageAvatar + MessageBubble + MessageRenderer + Audio button
 */

import { type ReactElement } from 'react';
import type { UIMessage } from '@tanstack/ai-react';
import { cn } from '@/lib/utils';
import { MessageAvatar } from '../atoms/MessageAvatar';
import { MessageBubble } from '../atoms/MessageBubble';
import MessageRenderer from '@/components/MessageRenderer';
import { MessageAudioButton } from '@/components/MessageAudioButton';

export interface ChatMessageProps {
  message: UIMessage;
  /** True si ce message est le dernier ET que le chat est en streaming */
  isStreaming?: boolean;
  isAudioEnabled?: boolean;
  className?: string;
}

/**
 * Extrait le contenu texte des parts TanStack AI
 */
function getTextContent(message: UIMessage): string {
  const textPart = message.parts.find(p => p.type === 'text');
  return textPart?.type === 'text' ? textPart.content : '';
}

export function ChatMessage({
  message,
  isStreaming = false,
  isAudioEnabled = false,
  className
}: ChatMessageProps): ReactElement {
  const role = message.role === 'user' ? 'user' : 'assistant';
  const isUser = role === 'user';
  const content = getTextContent(message);

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
            messageId={message.id}
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
              messageId={message.id}
            />
          </div>
        )}
      </div>
    </div>
  );
}
