/**
 * Chat Screen - Student
 *
 * Interface de chat avec Tom (tuteur IA) utilisant SSE streaming.
 */

import { useState, useRef, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { RotateCcw } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { ChatMessage, ChatInput } from '@/components/chat';
import {
  useChat,
  usePresignedUpload,
  type ChatMessage as ChatMessageType,
} from '@/hooks';

// Subjects available for students
const SUBJECTS = [
  { id: 'mathematiques', label: 'Maths', emoji: '🔢' },
  { id: 'francais', label: 'Français', emoji: '📚' },
  { id: 'histoire-geo', label: 'Histoire-Géo', emoji: '🌍' },
  { id: 'sciences', label: 'Sciences', emoji: '🔬' },
  { id: 'anglais', label: 'Anglais', emoji: '🇬🇧' },
] as const;

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subject?: string; sessionId?: string }>();
  const flatListRef = useRef<FlatList>(null);

  // Subject selection (default to maths)
  const [selectedSubject, setSelectedSubject] = useState(
    params.subject ?? 'mathematiques'
  );

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
    subject: selectedSubject,
  });

  // File upload hook
  const { uploadFile, isProcessing: isUploading } = usePresignedUpload();

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
              // Update URL params
              router.setParams({
                subject: selectedSubject,
                sessionId: newSessionId,
              });
            }
          },
        },
      ]
    );
  }, [resetSession, selectedSubject, router]);

  // Handle subject change
  const handleSubjectChange = useCallback(
    (subject: string) => {
      if (subject !== selectedSubject) {
        setSelectedSubject(subject);
        // Navigate with new subject (will create new session)
        router.setParams({ subject, sessionId: undefined });
      }
    },
    [selectedSubject, router]
  );

  // Auto-scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  // Render message item
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

  const subjectLabel =
    SUBJECTS.find((s) => s.id === selectedSubject)?.label ?? selectedSubject;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <View className="flex-1">
          <Text variant="h3">Chat avec Tom</Text>
          <Text variant="muted" className="text-sm">
            {subjectLabel}
          </Text>
        </View>
        {currentSessionId && (
          <TouchableOpacity
            onPress={handleReset}
            className="h-10 w-10 items-center justify-center rounded-full bg-muted"
          >
            <RotateCcw color="hsl(215.4, 16.3%, 46.9%)" size={18} />
          </TouchableOpacity>
        )}
      </View>

      {/* Subject Selector */}
      <View className="border-b border-border px-4 py-2">
        <FlatList
          horizontal
          data={SUBJECTS}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleSubjectChange(item.id)}
              className={`mr-2 flex-row items-center rounded-full px-3 py-1.5 ${
                selectedSubject === item.id ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <Text className="mr-1">{item.emoji}</Text>
              <Text
                className={`text-sm font-medium ${
                  selectedSubject === item.id
                    ? 'text-primary-foreground'
                    : 'text-foreground'
                }`}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Error Message */}
      {error && (
        <View className="mx-4 mt-2 rounded-lg bg-destructive/10 p-3">
          <Text className="text-center text-destructive">{error}</Text>
        </View>
      )}

      {/* Messages */}
      {messages.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Text className="text-4xl">🧠</Text>
          </View>
          <Text variant="h3" className="text-center">
            Salut ! Je suis Tom
          </Text>
          <Text variant="muted" className="mt-2 text-center">
            Pose-moi une question sur tes cours de {subjectLabel.toLowerCase()},
            je suis là pour t'aider à comprendre et réviser !
          </Text>
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
        isLoading={isLoading || isUploading}
        placeholder={`Pose ta question de ${subjectLabel.toLowerCase()}...`}
      />
    </SafeAreaView>
  );
}
