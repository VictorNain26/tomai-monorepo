/**
 * ChatMessage - Molecule message complet
 *
 * Combine MessageAvatar + MessageBubble + MessageRenderer + Audio button
 */

import { type ReactElement } from 'react';
import { cn } from '@/lib/utils';
import { MessageAvatar } from '../atoms/MessageAvatar';
import { MessageBubble } from '../atoms/MessageBubble';
import MessageRenderer from '@/components/MessageRenderer';
import { MessageAudioButton } from '@/components/MessageAudioButton';
import type { IMessage } from '@/types';

export interface ChatMessageProps {
  message: IMessage;
  isAudioEnabled?: boolean;
  className?: string;
}

export function ChatMessage({
  message,
  isAudioEnabled = false,
  className
}: ChatMessageProps): ReactElement {
  // Type guard: only user and assistant messages should reach this component
  const role = message.role === 'user' ? 'user' : 'assistant';
  const isUser = role === 'user';
  const isTyping = message.status === 'typing';
  const isStreaming = message.status === 'streaming';

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
            content={message.content}
            messageId={message.id}
            isUser={isUser}
            isTyping={isTyping}
            isStreaming={isStreaming}
            autoSpeak={isAudioEnabled}
          />
        </MessageBubble>

        {/* Audio button pour messages assistant (uniquement si complet) */}
        {!isUser && !isTyping && !isStreaming && isAudioEnabled && (
          <div className="flex justify-end mt-2">
            <MessageAudioButton
              content={message.content}
              messageId={message.id}
            />
          </div>
        )}
      </div>
    </div>
  );
}
