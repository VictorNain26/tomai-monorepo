/**
 * Chat Screen - TomAI 2026
 *
 * AI tutor chat - single multi-subject conversation per student.
 * The agent detects the subject dynamically and adapts.
 *
 * Context params:
 * - context: "homework:id" | "grade:id" | "test:id" | undefined
 * - prompt: Pre-filled question from dashboard
 */

import { useRef, useCallback, useEffect, useMemo } from 'react';
import { View, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, MoreVertical, ChevronRight, FileText, BarChart3, RefreshCw } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { ChatMessage, ChatInput, DeckActionCard } from '@/components/chat';
import { TomAvatar } from '@/components/common';
import {
  useChat,
  usePresignedUpload,
  useIconColors,
  useStudentPronote,
  type ChatMessage as ChatMessageType,
} from '@/hooks';
import { deleteChatSession } from '@/hooks/chat/api';
import { bgColors, colors } from '@/lib/styles';

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

function getSubjectEmoji(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes('math')) return '📐';
  if (s.includes('français') || s.includes('francais')) return '📖';
  if (s.includes('anglais')) return '🇬🇧';
  if (s.includes('histoire') || s.includes('géo')) return '🌍';
  if (s.includes('physique') || s.includes('chimie')) return '⚗️';
  if (s.includes('svt') || s.includes('biologie')) return '🧬';
  return '📚';
}

function parseContext(contextParam?: string): ContextInfo {
  if (!contextParam) return { type: 'general' };

  const [type, id] = contextParam.split(':');
  if (type === 'homework' || type === 'grade' || type === 'test') {
    return { type, id };
  }
  return { type: 'general' };
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

  // Chat hook (chat unique multi-matière)
  const {
    messages,
    pendingAttachments,
    createdDecks,
    currentSessionId,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    retry,
    addAttachment,
    removeAttachment,
    resetSession,
  } = useChat({
    initialSessionId: params.sessionId,
  });

  // Pronote data for suggestions
  const pronote = useStudentPronote();

  // Compute contextual suggestions from Pronote homework
  const suggestions = useMemo(() => {
    const items: { emoji: string; label: string; prompt: string }[] = [];

    // Undone homework (max 2)
    const undone = pronote.homework
      .filter((h) => !h.done)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 2);

    for (const h of undone) {
      items.push({
        emoji: getSubjectEmoji(h.subject),
        label: `Aide : ${h.subject}`,
        prompt: `Aide-moi avec mon devoir de ${h.subject} : ${h.description}`,
      });
    }

    // Fill up to 3 with generic suggestion
    if (items.length < 2) {
      items.push({
        emoji: '📖',
        label: 'Explique mon dernier cours',
        prompt: 'Explique-moi mon dernier cours de maniere simple',
      });
    }

    return items;
  }, [pronote.homework]);

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
      } else {
        Alert.alert('Erreur', `Impossible d'envoyer le fichier "${fileName}". Verifie ta connexion et reessaie.`);
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
                sessionId: newSessionId,
                context: undefined,
                prompt: undefined,
              });
            }
          },
        },
      ]
    );
  }, [resetSession, router]);

  // Handle delete conversation
  const handleDelete = useCallback(() => {
    if (!currentSessionId) return;

    Alert.alert(
      'Supprimer la conversation',
      'Cette action est irréversible. Tous les messages et fichiers seront supprimés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteChatSession(currentSessionId);
              router.back();
            } catch {
              Alert.alert('Erreur', 'Impossible de supprimer la conversation');
            }
          },
        },
      ]
    );
  }, [currentSessionId, router]);

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
      const showDecks = isLastAssistant && !isStreaming && createdDecks.length > 0;
      return (
        <View>
          <ChatMessage message={item} isStreaming={isLastAssistant && isStreaming} />
          {showDecks && (
            <View className="mt-2 gap-2 ml-10">
              {createdDecks.map((deck) => (
                <DeckActionCard
                  key={deck.deckId}
                  deckId={deck.deckId}
                  title={deck.title}
                  cardCount={deck.cardCount}
                  subject={deck.subject}
                />
              ))}
            </View>
          )}
        </View>
      );
    },
    [messages.length, isStreaming, createdDecks]
  );

  // Context badge info
  const contextBadge = useMemo(() => {
    switch (contextInfo.type) {
      case 'homework':
        return { icon: FileText, label: 'Devoir', color: colors.warning.DEFAULT };
      case 'grade':
        return { icon: BarChart3, label: 'Révision note', color: colors.primary.DEFAULT };
      case 'test':
        return { icon: BarChart3, label: 'Préparation contrôle', color: colors.destructive.DEFAULT };
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
          accessibilityLabel="Retour"
          accessibilityRole="button"
        >
          <ArrowLeft color={iconColors.foreground} size={20} />
        </TouchableOpacity>

        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <TomAvatar size="sm" />
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
            onPress={() => {
              Alert.alert('Options', undefined, [
                { text: 'Nouvelle conversation', onPress: handleReset },
                { text: 'Supprimer', onPress: handleDelete, style: 'destructive' },
                { text: 'Annuler', style: 'cancel' },
              ]);
            }}
            className="h-10 w-10 items-center justify-center rounded-full bg-muted"
            accessibilityLabel="Options de conversation"
            accessibilityRole="button"
          >
            <MoreVertical color={iconColors.muted} size={18} />
          </TouchableOpacity>
        )}
      </View>

      {/* Error Message with Retry */}
      {error && (
        <View
          className="mx-4 mt-2 flex-row items-center gap-3 rounded-lg p-3"
          style={{ backgroundColor: bgColors.destructive[10] }}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Text className="flex-1 text-destructive">{error}</Text>
          <TouchableOpacity
            onPress={retry}
            className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
            style={{ backgroundColor: bgColors.destructive[20] }}
            accessibilityLabel="Réessayer"
            accessibilityRole="button"
          >
            <RefreshCw color={colors.destructive.DEFAULT} size={14} />
            <Text className="text-sm font-semibold text-destructive">Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Messages or Welcome */}
      {messages.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <TomAvatar size="lg" className="mb-4" />
          <Text variant="h3" className="text-center">
            Salut ! Je suis Tom
          </Text>
          <Text variant="muted" className="mt-2 text-center">
            Pose-moi une question sur tes cours !
          </Text>

          {suggestions.length > 0 && (
            <View className="mt-6 w-full gap-2">
              {suggestions.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => sendMessage(s.prompt)}
                  className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-3"
                  activeOpacity={0.7}
                >
                  <Text className="text-lg">{s.emoji}</Text>
                  <Text className="flex-1">{s.label}</Text>
                  <ChevronRight color={iconColors.muted} size={16} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
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
        isLoading={isLoading}
        isUploading={isUploading}
        placeholder="Pose ta question..."
      />
    </SafeAreaView>
  );
}
