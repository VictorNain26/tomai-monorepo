/**
 * ChatMessage Component
 *
 * Affiche un message user ou assistant avec avatar et bulle stylisée.
 * Supporte le rendu LaTeX/KaTeX pour les formules mathématiques.
 * Supporte le rendu Mermaid pour les diagrammes.
 * Inclut bouton TTS pour lecture vocale des réponses assistant.
 */

import { View, TouchableOpacity } from 'react-native';
import { Volume2, VolumeX, Loader2 } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import {
  MathText,
  containsMath,
  MermaidDiagram,
  containsMermaid,
} from '@/components/common';
import { FileAttachmentCard } from './FileAttachmentCard';
import { cn } from '@/lib/utils';
import { useTextToSpeech } from '@/hooks';
import type { ChatMessage as ChatMessageType } from '@/hooks';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isThinking = !isUser && isStreaming && message.content.length === 0;
  const tts = useTextToSpeech();

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
      <View
        className={cn(
          'h-8 w-8 items-center justify-center rounded-full',
          isUser ? 'bg-primary' : 'bg-purple-600'
        )}
      >
        <Text className="text-sm text-white">{isUser ? '👤' : '🧠'}</Text>
      </View>

      {/* Message Bubble + Actions */}
      <View className="max-w-[80%]">
        <View
          className={cn(
            'rounded-2xl px-4 py-3',
            isUser
              ? 'rounded-tr-sm bg-primary'
              : 'rounded-tl-sm bg-muted'
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
              className={cn(
                'flex-row items-center gap-1 rounded-full px-2 py-1',
                tts.isSpeaking ? 'bg-primary/20' : 'bg-transparent'
              )}
            >
              {tts.isLoading ? (
                <Loader2
                  color="hsl(215.4, 16.3%, 46.9%)"
                  size={14}
                  className="animate-spin"
                />
              ) : tts.isSpeaking ? (
                <VolumeX color="hsl(222.2, 47.4%, 11.2%)" size={14} />
              ) : (
                <Volume2 color="hsl(215.4, 16.3%, 46.9%)" size={14} />
              )}
              <Text
                className={cn(
                  'text-xs',
                  tts.isSpeaking ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {tts.isLoading
                  ? 'Chargement...'
                  : tts.isSpeaking
                    ? 'Arrêter'
                    : 'Écouter'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* File Attachment - if message has attached file */}
        {message.attachedFile?.fileId && (
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

/**
 * MessageContent - renders message with math and/or mermaid diagrams
 */
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

  // For user messages or simple text, use simple Text
  if (isUser || (!hasMath && !hasMermaid)) {
    return (
      <Text
        className={cn(
          'text-base leading-relaxed',
          isUser ? 'text-primary-foreground' : 'text-foreground'
        )}
      >
        {content}
        {isStreaming && <Text className="text-primary">▋</Text>}
      </Text>
    );
  }

  // For assistant messages with Mermaid diagrams
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
        {isStreaming && <Text className="text-primary">▋</Text>}
      </View>
    );
  }

  // For assistant messages with only math (no mermaid)
  return (
    <View>
      <MathText fontSize={16} textColor={isUser ? '#fafafa' : undefined}>
        {content}
      </MathText>
      {isStreaming && <Text className="text-primary">▋</Text>}
    </View>
  );
}
