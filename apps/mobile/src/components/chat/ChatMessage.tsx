/**
 * ChatMessage Component - TomAI 2026
 *
 * Displays a user or assistant message with styled bubble.
 * Supports:
 * - LaTeX/KaTeX for math formulas
 * - Mermaid for diagrams
 * - TTS for voice playback
 * - File attachments
 */

import { View, TouchableOpacity, Image } from 'react-native';
import { Volume2, VolumeX, Loader2 } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import {
  MathText,
  containsMath,
  MermaidDiagram,
  containsMermaid,
  TomAvatar,
} from '@/components/common';
import { FileAttachmentCard } from './FileAttachmentCard';
import { cn } from '@/lib/utils';
import { useTextToSpeech, useIconColors } from '@/hooks';
import type { ChatMessage as ChatMessageType } from '@/hooks';
import { bgColors, colors } from '@/lib/styles';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isThinking = !isUser && isStreaming && message.content.length === 0;
  const tts = useTextToSpeech();
  const iconColors = useIconColors();

  // Can speak if assistant message with content and not streaming
  const canSpeak = !isUser && message.content.length > 0 && !isStreaming;

  const handleSpeakToggle = () => {
    if (!canSpeak) return;
    tts.toggle(message.content);
  };

  return (
    <View
      className={cn(
        'mb-4 flex-row items-start gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      {isUser ? (
        <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
          <Text className="text-sm text-primary-foreground">👤</Text>
        </View>
      ) : (
        <TomAvatar size="sm" />
      )}

      {/* Message Bubble + Actions */}
      <View className="max-w-[80%]">
        <View
          className={cn(
            'rounded-2xl px-4 py-3',
            isUser ? 'rounded-tr-sm bg-primary' : 'rounded-tl-sm bg-muted'
          )}
        >
          {isThinking ? (
            <ThinkingIndicator />
          ) : (
            <MessageContent
              content={message.content}
              isUser={isUser}
              isStreaming={isStreaming}
            />
          )}
        </View>

        {/* TTS Button - only for assistant messages */}
        {canSpeak && (
          <View className="mt-1 flex-row">
            <TouchableOpacity
              onPress={handleSpeakToggle}
              disabled={tts.isLoading}
              className="flex-row items-center gap-1 rounded-full px-2 py-1"
              style={tts.isSpeaking ? { backgroundColor: bgColors.primary[15] } : undefined}
            >
              {tts.isLoading ? (
                <Loader2 color={iconColors.muted} size={14} />
              ) : tts.isSpeaking ? (
                <VolumeX color={iconColors.foreground} size={14} />
              ) : (
                <Volume2 color={iconColors.muted} size={14} />
              )}
              <Text
                variant="tiny"
                className={tts.isSpeaking ? 'text-foreground' : 'text-muted-foreground'}
              >
                {tts.isLoading
                  ? 'Chargement...'
                  : tts.isSpeaking
                    ? 'Arrêter'
                    : 'Écouter'}
              </Text>
            </TouchableOpacity>
            {tts.error && (
              <Text variant="tiny" className="ml-1 self-center text-destructive" numberOfLines={1}>
                {tts.error}
              </Text>
            )}
          </View>
        )}

        {/* Image Preview */}
        {message.attachedFile?.preview && message.attachedFile.mimeType?.startsWith('image/') && (
          <View className="mt-2">
            <Image
              source={{ uri: message.attachedFile.preview }}
              className="rounded-xl"
              style={{ width: 200, height: 200 }}
              resizeMode="cover"
              accessibilityLabel={`Image: ${message.attachedFile.fileName}`}
            />
          </View>
        )}

        {/* File Attachment (non-image or without preview) */}
        {message.attachedFile?.fileId && !(message.attachedFile.preview && message.attachedFile.mimeType?.startsWith('image/')) && (
          <FileAttachmentCard
            fileId={message.attachedFile.fileId}
            fileName={message.attachedFile.fileName}
            mimeType={message.attachedFile.mimeType}
            fileSizeBytes={message.attachedFile.fileSizeBytes}
          />
        )}
      </View>
    </View>
  );
}

// ============================================================================
// THINKING INDICATOR
// ============================================================================

function ThinkingIndicator() {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-muted-foreground">Tom réfléchit</Text>
      <View className="flex-row gap-1">
        <View
          className="h-1.5 w-1.5 animate-pulse rounded-full"
          style={{ backgroundColor: colors.primary.DEFAULT }}
        />
        <View
          className="h-1.5 w-1.5 animate-pulse rounded-full"
          style={{ backgroundColor: colors.primary.DEFAULT }}
        />
        <View
          className="h-1.5 w-1.5 animate-pulse rounded-full"
          style={{ backgroundColor: colors.primary.DEFAULT }}
        />
      </View>
    </View>
  );
}

// ============================================================================
// MESSAGE CONTENT
// ============================================================================

interface MessageContentProps {
  content: string;
  isUser: boolean;
  isStreaming?: boolean;
}

interface ContentSegment {
  type: 'text' | 'mermaid';
  content: string;
}

function parseMermaidContent(text: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const parts = text.split(/(```mermaid[\s\S]*?```)/g);

  for (const part of parts) {
    if (!part.trim()) continue;

    const mermaidMatch = part.match(/^```mermaid\s*([\s\S]*?)\s*```$/);
    if (mermaidMatch?.[1]) {
      segments.push({ type: 'mermaid', content: mermaidMatch[1].trim() });
    } else {
      segments.push({ type: 'text', content: part.trim() });
    }
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', content: text });
  }

  return segments;
}

function MessageContent({ content, isUser, isStreaming }: MessageContentProps) {
  const hasMath = !isUser && containsMath(content);
  const hasMermaid = !isUser && containsMermaid(content);

  // User messages or simple text
  if (isUser || (!hasMath && !hasMermaid)) {
    return (
      <Text
        className={cn(
          'text-base leading-relaxed',
          isUser ? 'text-primary-foreground' : 'text-foreground'
        )}
      >
        {content}
        {isStreaming && (
          <Text style={{ color: colors.primary.DEFAULT }}>▋</Text>
        )}
      </Text>
    );
  }

  // Assistant messages with Mermaid diagrams
  if (hasMermaid) {
    const segments = parseMermaidContent(content);
    return (
      <View>
        {segments.map((segment, index) => {
          if (segment.type === 'mermaid') {
            return (
              <MermaidDiagram key={`mermaid-${index}`} chart={segment.content} />
            );
          }
          // Text segment - may contain math
          if (containsMath(segment.content)) {
            return (
              <MathText key={`math-${index}`} fontSize={16}>
                {segment.content}
              </MathText>
            );
          }
          return (
            <Text
              key={`text-${index}`}
              className="text-base leading-relaxed text-foreground"
            >
              {segment.content}
            </Text>
          );
        })}
        {isStreaming && (
          <Text style={{ color: colors.primary.DEFAULT }}>▋</Text>
        )}
      </View>
    );
  }

  // Assistant messages with only math
  return (
    <View>
      <MathText fontSize={16} textColor={isUser ? colors.primary.foreground : undefined}>
        {content}
      </MathText>
      {isStreaming && (
        <Text style={{ color: colors.primary.DEFAULT }}>▋</Text>
      )}
    </View>
  );
}
