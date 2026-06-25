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

import { memo, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, Image, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Volume2, VolumeX, Loader2 } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import {
  MathText,
  containsMath,
  MermaidDiagram,
  containsMermaid,
  TomAvatar,
} from '@/components/common';
import { MarkdownContent } from './MarkdownContent';
import { FileAttachmentCard } from './FileAttachmentCard';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useTextToSpeech, useThemeColors } from '@/hooks';
import type { ChatMessage as ChatMessageType } from '@/hooks';
import { bgColors } from '@/lib/styles';

/** Strip markdown syntax for clean TTS playback */
function stripMarkdownForTTS(text: string): string {
  let result = text;
  // Remove mermaid diagrams
  result = result.replace(/```mermaid[\s\S]*?```/g, '');
  // Remove code blocks
  result = result.replace(/```[\s\S]*?```/g, '');
  // Remove inline code
  result = result.replace(/`[^`]+`/g, '');
  // Remove URLs
  result = result.replace(/https?:\/\/[^\s)]+/g, '');
  // Remove markdown links, keep label
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Remove images
  result = result.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
  // Remove headings markers
  result = result.replace(/^#{1,6}\s+/gm, '');
  // Remove bold/italic markers
  result = result.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');
  result = result.replace(/_{1,3}([^_]+)_{1,3}/g, '$1');
  // Remove strikethrough
  result = result.replace(/~~([^~]+)~~/g, '$1');
  // Remove blockquotes
  result = result.replace(/^>\s+/gm, '');
  // Remove horizontal rules
  result = result.replace(/^[-*_]{3,}\s*$/gm, '');
  // Remove list markers
  result = result.replace(/^[\s]*[-*+]\s+/gm, '');
  result = result.replace(/^[\s]*\d+\.\s+/gm, '');
  // Collapse multiple newlines
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
}

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  streamStatus?: string | null;
}

export const ChatMessage = memo(function ChatMessage({ message, isStreaming = false, streamStatus }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isThinking = !isUser && isStreaming && message.content.length === 0;
  const colors = useThemeColors();
  const tts = useTextToSpeech();
  const { confirm } = useConfirm();

  // Can speak if assistant message with content and not streaming
  const canSpeak = !isUser && message.content.length > 0 && !isStreaming;

  const handleSpeakToggle = () => {
    if (!canSpeak) return;
    tts.toggle(stripMarkdownForTTS(message.content));
  };

  const handleLongPress = useCallback(async () => {
    if (message.content.length === 0) return;
    await confirm({
      title: 'Message',
      actions: [
        {
          label: 'Copier',
          variant: 'default',
          onPress: () => { void Clipboard.setStringAsync(message.content); },
        },
      ],
    });
  }, [message.content, confirm]);

  return (
    <View
      className={cn(
        'mb-4 flex-row items-start gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      {isUser ? (
        <View
          className="h-8 w-8 items-center justify-center rounded-full bg-primary"
          accessibilityElementsHidden={true}
          importantForAccessibility="no-hide-descendants"
        >
          <Text className="text-sm text-primary-foreground">👤</Text>
        </View>
      ) : (
        <TomAvatar size="sm" />
      )}

      {/* Message Bubble + Actions */}
      <View className="max-w-[80%]">
        <Pressable
          testID={!isUser && !isThinking ? 'chat-assistant-message' : undefined}
          onLongPress={handleLongPress}
          accessibilityRole="text"
          accessibilityHint="Appui long pour copier le message"
          className={cn(
            'rounded-2xl px-4 py-3',
            isUser ? 'rounded-tr-sm bg-primary' : 'rounded-tl-sm bg-muted'
          )}
        >
          {isThinking ? (
            <ThinkingIndicator status={streamStatus} />
          ) : (
            <MessageContent
              content={message.content}
              isUser={isUser}
              isStreaming={isStreaming}
            />
          )}
        </Pressable>

        {/* TTS Button - only for assistant messages */}
        {canSpeak && (
          <View className="mt-1 flex-row">
            <TouchableOpacity
              onPress={handleSpeakToggle}
              disabled={tts.isLoading}
              className="flex-row items-center gap-1 rounded-full px-2 py-1"
              style={tts.isSpeaking ? { backgroundColor: bgColors.primary[15] } : undefined}
              accessibilityLabel={tts.isSpeaking ? 'Arreter la lecture' : 'Ecouter la reponse'}
              accessibilityHint="Active la lecture vocale du message"
              accessibilityRole="button"
            >
              {tts.isLoading ? (
                <Loader2 color={colors.mutedForeground} size={14} />
              ) : tts.isSpeaking ? (
                <VolumeX color={colors.foreground} size={14} />
              ) : (
                <Volume2 color={colors.mutedForeground} size={14} />
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
});

// ============================================================================
// THINKING INDICATOR
// ============================================================================

function StaggeredDot({ delay, color }: { delay: number; color: string }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 400 }),
            withTiming(0.3, { duration: 400 }),
          ),
          -1,
        ),
      ),
    );
  }, [delay, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: color,
  }));

  return <Animated.View style={style} />;
}

function ThinkingIndicator({ status }: { status?: string | null }) {
  const colors = useThemeColors();
  const label = status ?? 'Tom réfléchit';
  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-2">
        <Text className="text-muted-foreground">{label}</Text>
        <View className="flex-row gap-1">
          <StaggeredDot delay={0} color={colors.primary} />
          <StaggeredDot delay={150} color={colors.primary} />
          <StaggeredDot delay={300} color={colors.primary} />
        </View>
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
  const colors = useThemeColors();
  const hasMath = !isUser && containsMath(content);
  const hasMermaid = !isUser && containsMermaid(content);

  // User messages or simple text — render with markdown
  if (isUser || (!hasMath && !hasMermaid)) {
    return (
      <View>
        <MarkdownContent isUser={isUser}>{content}</MarkdownContent>
        {isStreaming && (
          <Text style={{ color: colors.primary }}>▋</Text>
        )}
      </View>
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
            <MarkdownContent key={`text-${index}`}>
              {segment.content}
            </MarkdownContent>
          );
        })}
        {isStreaming && (
          <Text style={{ color: colors.primary }}>▋</Text>
        )}
      </View>
    );
  }

  // Assistant messages with only math
  return (
    <View>
      <MathText fontSize={16} textColor={isUser ? colors.primaryForeground : undefined}>
        {content}
      </MathText>
      {isStreaming && (
        <Text style={{ color: colors.primary }}>▋</Text>
      )}
    </View>
  );
}
