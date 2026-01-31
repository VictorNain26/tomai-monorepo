/**
 * Chat Screen - TomAI 2026
 *
 * AI tutor chat with Pronote context integration.
 * The chat knows what homework/grade/test the student is working on.
 *
 * Context params:
 * - subject: The school subject
 * - context: "homework:id" | "grade:id" | "test:id" | undefined
 * - prompt: Pre-filled question from dashboard
 */

import { useRef, useCallback, useEffect, useMemo } from 'react';
import { View, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, RotateCcw, BookOpen, FileText, BarChart3 } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { ChatMessage, ChatInput } from '@/components/chat';
import { TomAvatar } from '@/components/common';
import {
  useChat,
  usePresignedUpload,
  useStudentPronote,
  useIconColors,
  type ChatMessage as ChatMessageType,
} from '@/hooks';
import { bgColors, shadows, colors } from '@/lib/styles';

// ============================================================================
// TYPES
// ============================================================================

interface ContextInfo {
  type: 'homework' | 'grade' | 'test' | 'general';
  id?: string;
  title?: string;
  subject?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function parseContext(contextParam?: string): ContextInfo {
  if (!contextParam) return { type: 'general' };

  const [type, id] = contextParam.split(':');
  if (type === 'homework' || type === 'grade' || type === 'test') {
    return { type, id };
  }
  return { type: 'general' };
}

function getSubjectEmoji(subject?: string): string {
  if (!subject) return '📚';
  const s = subject.toLowerCase();

  if (s.includes('math')) return '📐';
  if (s.includes('français') || s.includes('francais')) return '📖';
  if (s.includes('anglais')) return '🇬🇧';
  if (s.includes('espagnol')) return '🇪🇸';
  if (s.includes('allemand')) return '🇩🇪';
  if (s.includes('histoire') || s.includes('géo')) return '🌍';
  if (s.includes('physique') || s.includes('chimie')) return '⚗️';
  if (s.includes('svt') || s.includes('biologie')) return '🧬';
  if (s.includes('techno')) return '⚙️';
  if (s.includes('sport') || s.includes('eps')) return '🏃';
  if (s.includes('musique')) return '🎵';
  if (s.includes('arts')) return '🎨';
  if (s.includes('philo')) return '🤔';
  if (s.includes('ses') || s.includes('économie')) return '📊';
  if (s.includes('info') || s.includes('nsi')) return '💻';

  return '📚';
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const flatListRef = useRef<FlatList>(null);
  const iconColors = useIconColors();

  // Parse context from params
  const contextInfo = useMemo(() => parseContext(params.context), [params.context]);
  const subject = params.subject ?? 'général';

  // Pronote data for suggestions
  const pronote = useStudentPronote();

  // Chat hook
  const {
    messages,
    pendingAttachments,
    currentSessionId,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    addAttachment,
    removeAttachment,
    resetSession,
  } = useChat({
    initialSessionId: params.sessionId,
    subject,
  });

  // File upload hook
  const { uploadFile, isProcessing: isUploading } = usePresignedUpload();

  // Send initial prompt if provided
  const sentInitialPromptRef = useRef(false);
  useEffect(() => {
    if (params.prompt && !sentInitialPromptRef.current && messages.length === 0) {
      sentInitialPromptRef.current = true;
      sendMessage(params.prompt);
    }
  }, [params.prompt, messages.length, sendMessage]);

  // Handle file selection
  const handleFileSelected = useCallback(
    async (uri: string, fileName: string, mimeType: string) => {
      const attachment = await uploadFile(uri, fileName, mimeType);
      if (attachment) {
        addAttachment({
          fileId: attachment.fileId,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          preview: attachment.preview,
        });
      }
    },
    [uploadFile, addAttachment]
  );

  // Handle reset conversation
  const handleReset = useCallback(async () => {
    Alert.alert(
      'Nouvelle conversation',
      'Commencer une nouvelle conversation ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            const newSessionId = await resetSession();
            if (newSessionId) {
              router.setParams({
                subject,
                sessionId: newSessionId,
                context: undefined,
                prompt: undefined,
              });
            }
          },
        },
      ]
    );
  }, [resetSession, subject, router]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  // Render message
  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessageType; index: number }) => {
      const isLastAssistant =
        item.role === 'assistant' && index === messages.length - 1;
      return (
        <ChatMessage message={item} isStreaming={isLastAssistant && isStreaming} />
      );
    },
    [messages.length, isStreaming]
  );

  // Quick suggestions based on Pronote data
  const suggestions = useMemo(() => {
    if (!pronote.isConnected) return [];

    const items: { label: string; prompt: string }[] = [];

    // Add suggestions based on pending homework
    const pendingHomework = pronote.homework
      .filter((h) => !h.done)
      .slice(0, 2);

    pendingHomework.forEach((h) => {
      items.push({
        label: `Aide : ${h.subject}`,
        prompt: `Aide-moi avec mon devoir de ${h.subject} : ${h.description}`,
      });
    });

    // Add general suggestions if not enough
    if (items.length < 3) {
      items.push({
        label: 'Explique ce cours',
        prompt: `Peux-tu m'expliquer mon dernier cours de ${subject} ?`,
      });
    }

    return items.slice(0, 3);
  }, [pronote.isConnected, pronote.homework, subject]);

  // Context badge info
  const contextBadge = useMemo(() => {
    switch (contextInfo.type) {
      case 'homework':
        return { icon: FileText, label: 'Devoir', color: colors.warning.DEFAULT };
      case 'grade':
        return { icon: BarChart3, label: 'Révision note', color: colors.primary.DEFAULT };
      case 'test':
        return { icon: BookOpen, label: 'Préparation contrôle', color: colors.destructive.DEFAULT };
      default:
        return null;
    }
  }, [contextInfo.type]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-muted"
        >
          <ArrowLeft color={iconColors.foreground} size={20} />
        </TouchableOpacity>

        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-xl">{getSubjectEmoji(subject)}</Text>
            <Text variant="large">Tom</Text>
          </View>
          {contextBadge && (
            <View className="mt-0.5 flex-row items-center gap-1">
              <contextBadge.icon color={contextBadge.color} size={12} />
              <Text variant="tiny" style={{ color: contextBadge.color }}>
                {contextBadge.label}
              </Text>
            </View>
          )}
        </View>

        {currentSessionId && (
          <TouchableOpacity
            onPress={handleReset}
            className="h-10 w-10 items-center justify-center rounded-full bg-muted"
          >
            <RotateCcw color={iconColors.muted} size={18} />
          </TouchableOpacity>
        )}
      </View>

      {/* Error Message */}
      {error && (
        <View
          className="mx-4 mt-2 rounded-lg p-3"
          style={{ backgroundColor: bgColors.destructive[10] }}
        >
          <Text className="text-center text-destructive">{error}</Text>
        </View>
      )}

      {/* Messages or Welcome */}
      {messages.length === 0 ? (
        <WelcomeScreen
          contextInfo={contextInfo}
          suggestions={suggestions}
          onSuggestionPress={(prompt) => sendMessage(prompt)}
          isLoading={isLoading}
        />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
          onLayout={scrollToBottom}
        />
      )}

      {/* Input */}
      <ChatInput
        onSendMessage={sendMessage}
        onFileSelected={handleFileSelected}
        pendingAttachments={pendingAttachments}
        onRemoveAttachment={removeAttachment}
        isLoading={isLoading || isUploading}
        placeholder="Pose ta question..."
      />
    </SafeAreaView>
  );
}

// ============================================================================
// WELCOME SCREEN
// ============================================================================

interface WelcomeScreenProps {
  contextInfo: ContextInfo;
  suggestions: { label: string; prompt: string }[];
  onSuggestionPress: (prompt: string) => void;
  isLoading: boolean;
}

function WelcomeScreen({
  contextInfo,
  suggestions,
  onSuggestionPress,
  isLoading,
}: WelcomeScreenProps) {
  const iconColors = useIconColors();

  // Context-specific welcome message
  const getWelcomeMessage = () => {
    switch (contextInfo.type) {
      case 'homework':
        return "Je suis prêt à t'aider avec ce devoir. Qu'est-ce qui te pose problème ?";
      case 'grade':
        return "Revoyons ensemble ce chapitre pour améliorer ta compréhension.";
      case 'test':
        return "Préparons ce contrôle ensemble. Par quoi veux-tu commencer ?";
      default:
        return `Pose-moi une question sur tes cours, je suis là pour t'aider à comprendre et réviser !`;
    }
  };

  return (
    <View className="flex-1 px-4 py-6">
      {/* Tom Avatar & Welcome */}
      <View className="items-center mb-6">
        <TomAvatar size="lg" className="mb-4" />
        <Text variant="h3" className="text-center">
          Salut ! Je suis Tom
        </Text>
        <Text variant="muted" className="mt-2 text-center px-4">
          {getWelcomeMessage()}
        </Text>
      </View>

      {/* Suggestions */}
      {suggestions.length > 0 && !isLoading && (
        <View className="gap-2">
          <Text variant="small" className="text-muted-foreground px-1">
            Suggestions
          </Text>
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => onSuggestionPress(suggestion.prompt)}
              activeOpacity={0.7}
            >
              <Card style={shadows.xs}>
                <View className="flex-row items-center gap-3 p-4">
                  <View
                    className="h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: bgColors.primary[10] }}
                  >
                    <FileText color={iconColors.primary} size={16} />
                  </View>
                  <Text className="flex-1">{suggestion.label}</Text>
                  <Text className="text-primary">→</Text>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* General tips */}
      <View className="mt-auto pt-6">
        <Text variant="caption" className="text-center">
          Tu peux aussi envoyer une photo de ton exercice
        </Text>
      </View>
    </View>
  );
}
