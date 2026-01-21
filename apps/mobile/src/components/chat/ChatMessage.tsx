/**
 * ChatMessage Component
 *
 * Affiche un message user ou assistant avec avatar et bulle stylisée.
 */

import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageType } from '@/hooks';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isThinking = !isUser && isStreaming && message.content.length === 0;

  return (
    <View
      className={cn(
        'mb-4 flex-row items-start gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <View
        className={cn(
          'h-8 w-8 items-center justify-center rounded-full',
          isUser ? 'bg-primary' : 'bg-purple-600'
        )}
      >
        <Text className="text-sm text-white">{isUser ? '👤' : '🧠'}</Text>
      </View>

      {/* Message Bubble */}
      <View
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3',
          isUser
            ? 'rounded-tr-sm bg-primary'
            : 'rounded-tl-sm bg-muted'
        )}
      >
        {isThinking ? (
          <ThinkingIndicator />
        ) : (
          <Text
            className={cn(
              'text-base leading-relaxed',
              isUser ? 'text-primary-foreground' : 'text-foreground'
            )}
          >
            {message.content}
            {isStreaming && !isThinking && (
              <Text className="text-primary">▋</Text>
            )}
          </Text>
        )}
      </View>
    </View>
  );
}

function ThinkingIndicator() {
  return (
    <View className="flex-row items-center gap-1">
      <Text className="text-muted-foreground">Tom réfléchit</Text>
      <View className="flex-row gap-1">
        <View className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
        <View className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary delay-75" />
        <View className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary delay-150" />
      </View>
    </View>
  );
}
