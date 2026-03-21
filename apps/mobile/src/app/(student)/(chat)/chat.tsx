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
import { View, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, FileText, BarChart3, RefreshCw, ChevronDown } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { ChatMessage, ChatInput, ChatHeader, DeckActionCard, FileLibraryPicker } from '@/components/chat';
import { TomAvatar, SubjectIcon } from '@/components/common';
import {
  useChat,
  usePresignedUpload,
  usePronote,
  useSessionFiles,
  useThemeColors,
  type ChatMessage as ChatMessageType,
} from '@/hooks';
import { useUser } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { deleteChatSession, chatQueryKeys } from '@/hooks/chat/api';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { bgColors } from '@/lib/styles';

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

// ============================================================================
// COMPONENT
// ============================================================================

export default function ChatScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { confirm, info } = useConfirm();
  const params = useLocalSearchParams<Record<string, string>>();
  const colors = useThemeColors();
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
    streamStatus,
    error,
    sendMessage,
    retry,
    addAttachment,
    removeAttachment,
    resetSession,
    stop,
  } = useChat({
    initialSessionId: params.sessionId,
  });

  // Session files (classeur)
  const { files: sessionAttachedFiles } = useSessionFiles(currentSessionId);
  const [showClasseur, setShowClasseur] = useState(false);

  // Smart scroll: track if user has scrolled away from bottom
  const flatListRef = useRef<FlatList>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const handleScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    // Inverted FlatList: y=0 is bottom, y>0 is scrolled up
    setIsNearBottom(e.nativeEvent.contentOffset.y < 100);
  }, []);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  // Auto-scroll to bottom when streaming starts
  useEffect(() => {
    if (isStreaming && isNearBottom) {
      scrollToBottom();
    }
  }, [isStreaming, isNearBottom, scrollToBottom]);

  // Pronote data for suggestions and chat context
  const user = useUser();
  const pronote = usePronote(user?.id ?? '');

  // Compute contextual suggestions from Pronote homework
  const suggestions = useMemo(() => {
    const items: { subject: string; label: string; prompt: string }[] = [];

    // Undone homework (max 2)
    const undone = pronote.homework
      .filter((h) => !h.done)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 2);

    for (const h of undone) {
      items.push({
        subject: h.subject,
        label: `Aide : ${h.subject}`,
        prompt: `Aide-moi avec mon devoir de ${h.subject} : ${h.description}`,
      });
    }

    // Fill up to 3 with generic suggestion
    if (items.length < 2) {
      items.push({
        subject: 'general',
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
        info('Erreur', `Impossible d'envoyer le fichier "${fileName}". Vérifie ta connexion et réessaie.`);
      }
    },
    [uploadFile, addAttachment, info]
  );

  // Handle reset conversation
  const handleReset = useCallback(async () => {
    const confirmed = await confirm({
      title: 'Nouvelle conversation',
      message: 'Commencer une nouvelle conversation ?',
    });
    if (confirmed) {
      const newSessionId = await resetSession();
      if (newSessionId) {
        queryClient.invalidateQueries({ queryKey: chatQueryKeys.conversations() });
        router.setParams({
          sessionId: newSessionId,
          context: undefined,
          prompt: undefined,
        });
      }
    }
  }, [resetSession, router, queryClient, confirm]);

  // Handle delete conversation
  const handleDelete = useCallback(async () => {
    if (!currentSessionId) return;

    const confirmed = await confirm({
      title: 'Supprimer la conversation',
      message: 'Cette action est irréversible. Tous les messages et fichiers seront supprimés.',
      confirmLabel: 'Supprimer',
      variant: 'destructive',
    });
    if (confirmed) {
      try {
        await deleteChatSession(currentSessionId);
        queryClient.invalidateQueries({ queryKey: chatQueryKeys.conversations() });
        router.back();
      } catch {
        info('Erreur', 'Impossible de supprimer la conversation');
      }
    }
  }, [currentSessionId, router, queryClient, confirm, info]);

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
          <ChatMessage
            message={item}
            isStreaming={isLastAssistant && isStreaming}
            streamStatus={isLastAssistant ? streamStatus : undefined}
          />
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
    [isStreaming, streamStatus, createdDecks]
  );

  // Context badge info
  const contextBadge = useMemo(() => {
    switch (contextInfo.type) {
      case 'homework':
        return { icon: FileText, label: 'Devoir', color: colors.warning };
      case 'grade':
        return { icon: BarChart3, label: 'Révision note', color: colors.primary };
      case 'test':
        return { icon: BarChart3, label: 'Préparation contrôle', color: colors.destructive };
      default:
        return null;
    }
  }, [contextInfo.type, colors.warning, colors.primary, colors.destructive]);

  return (
    <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-900" edges={['top']}>
      <ChatHeader
        contextBadge={contextBadge}
        currentSessionId={currentSessionId}
        sessionFileCount={sessionAttachedFiles.length}
        onBack={() => router.back()}
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
          <Text className="flex-1 text-red-600 dark:text-red-400">{error}</Text>
          <TouchableOpacity
            onPress={retry}
            className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
            style={{ backgroundColor: bgColors.destructive[20] }}
            accessibilityLabel="Réessayer"
            accessibilityRole="button"
          >
            <RefreshCw color={colors.destructive} size={14} />
            <Text className="text-sm font-semibold text-red-600 dark:text-red-400">Réessayer</Text>
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
                {suggestions.map((s) => (
                  <TouchableOpacity
                    key={s.prompt}
                    onPress={() => sendMessage(s.prompt)}
                    className="flex-row items-center gap-3 rounded-xl bg-white dark:bg-stone-800 p-3"
                    activeOpacity={0.7}
                    accessibilityLabel={s.label}
                    accessibilityHint="Envoie cette question a Tom"
                    accessibilityRole="button"
                  >
                    <SubjectIcon subject={s.subject} size={20} />
                    <Text className="flex-1">{s.label}</Text>
                    <ChevronRight color={colors.muted} size={16} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View className="flex-1">
            <FlatList
              ref={flatListRef}
              data={invertedMessages}
              inverted
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={{ padding: 16 }}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              onScroll={handleScroll}
              scrollEventThrottle={100}
            />

            {/* Scroll to bottom FAB */}
            {!isNearBottom && (
              <TouchableOpacity
                onPress={scrollToBottom}
                className="absolute bottom-3 right-3 h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-stone-800 shadow-sm"
                style={{ elevation: 3 }}
                accessibilityLabel="Retour en bas"
              >
                <ChevronDown color={colors.foreground} size={20} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Input */}
        <ChatInput
          onSendMessage={sendMessage}
          onFileSelected={handleFileSelected}
          onOpenClasseur={() => setShowClasseur(true)}
          onStop={stop}
          pendingAttachments={pendingAttachments}
          onRemoveAttachment={removeAttachment}
          isLoading={isLoading}
          isStreaming={isStreaming}
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
