/**
 * Chat Screen - TomAI 2026
 *
 * AI tutor chat - single multi-subject conversation per student.
 * The agent detects the subject dynamically and adapts.
 *
 * Keyboard architecture (react-native-keyboard-controller):
 * - KeyboardProvider in root layout sets SOFT_INPUT_ADJUST_NOTHING
 * - KeyboardAvoidingView (from library) adds paddingBottom = keyboard height
 * - keyboardVerticalOffset = tab bar height (keyboard is relative to screen bottom)
 * - FlatList inverted: newest messages always visible at bottom
 *
 * Context params:
 * - context: "homework:id" | "grade:id" | "test:id" | undefined
 * - prompt: Pre-filled question from dashboard
 */

import { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, FileText, BarChart3, RefreshCw } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { ChatMessage, ChatInput, ChatHeader, DeckActionCard, FileLibraryPicker } from '@/components/chat';
import { TomAvatar } from '@/components/common';
import {
  useChat,
  usePresignedUpload,
  useIconColors,
  useStudentPronote,
  useSessionFiles,
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

  // Session files (classeur)
  const { files: sessionAttachedFiles } = useSessionFiles(currentSessionId);
  const [showClasseur, setShowClasseur] = useState(false);

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
              const newSessionId = await resetSession();
              if (newSessionId) {
                router.setParams({
                  sessionId: newSessionId,
                  context: undefined,
                  prompt: undefined,
                });
              }
            } catch {
              Alert.alert('Erreur', 'Impossible de supprimer la conversation');
            }
          },
        },
      ]
    );
  }, [currentSessionId, resetSession, router]);

  // Inverted FlatList: reverse messages so newest appear at bottom
  const invertedMessages = useMemo(() => [...messages].reverse(), [messages]);

  // Render message (inverted: index 0 = newest message)
  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessageType; index: number }) => {
      const isLastAssistant =
        item.role === 'assistant' && index === 0;
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
    [isStreaming, createdDecks]
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
      <ChatHeader
        contextBadge={contextBadge}
        currentSessionId={currentSessionId}
        sessionFileCount={sessionAttachedFiles.length}
        onOpenClasseur={() => setShowClasseur(true)}
        onReset={handleReset}
        onDelete={handleDelete}
      />

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

      {/* KeyboardAvoidingView wraps messages + input */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
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
            data={invertedMessages}
            inverted
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
          />
        )}

        {/* Input */}
        <ChatInput
          onSendMessage={sendMessage}
          onFileSelected={handleFileSelected}
          onOpenClasseur={() => setShowClasseur(true)}
          pendingAttachments={pendingAttachments}
          onRemoveAttachment={removeAttachment}
          isLoading={isLoading}
          isUploading={isUploading}
          placeholder="Pose ta question..."
        />
      </KeyboardAvoidingView>

      {/* Classeur Picker */}
      <FileLibraryPicker
        visible={showClasseur}
        onClose={() => setShowClasseur(false)}
        sessionId={currentSessionId}
      />
    </SafeAreaView>
  );
}
