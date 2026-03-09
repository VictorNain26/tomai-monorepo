/**
 * Conversations List Screen - TomAI 2026
 *
 * Lists all chat conversations with title, last message preview, date.
 * Tap to open, swipe to delete, FAB to create new.
 */

import { useCallback } from 'react';
import { View, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useRouter } from 'expo-router';
import { Plus, MessageCircle, Trash2 } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { useConversations, useIconColors, useThemeColors, type Conversation } from '@/hooks';
import { shadows } from '@/lib/styles';

function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "A l'instant";
  if (diffMins < 60) return `Il y a ${diffMins}min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function getSubjectEmoji(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes('math')) return '\u{1F4D0}';
  if (s.includes('fran')) return '\u{1F4D6}';
  if (s.includes('anglais')) return '\u{1F1EC}\u{1F1E7}';
  if (s.includes('histoire') || s.includes('geo')) return '\u{1F30D}';
  if (s.includes('physique') || s.includes('chimie')) return '\u{2697}\u{FE0F}';
  if (s.includes('svt') || s.includes('bio')) return '\u{1F9EC}';
  return '\u{1F4DA}';
}

function ConversationItem({
  conversation,
  onPress,
  onDelete,
  iconColors,
}: {
  conversation: Conversation;
  onPress: () => void;
  onDelete: () => void;
  iconColors: ReturnType<typeof useIconColors>;
}) {
  const title = conversation.title ?? 'Nouvelle conversation';
  const emoji = getSubjectEmoji(conversation.subject);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="mx-4 mb-2 rounded-xl border border-border bg-card p-4"
      style={shadows.sm}
    >
      <View className="flex-row items-start justify-between">
        <View className="mr-3 flex-1">
          <View className="mb-1 flex-row items-center gap-2">
            <Text className="text-base">{emoji}</Text>
            <Text className="flex-1 text-base font-semibold text-foreground" numberOfLines={1}>
              {title}
            </Text>
          </View>

          {conversation.lastMessagePreview ? (
            <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={2}>
              {conversation.lastMessageRole === 'assistant' ? 'Tom : ' : ''}
              {conversation.lastMessagePreview}
            </Text>
          ) : (
            <Text className="mt-1 text-sm italic text-muted-foreground">
              Conversation vide
            </Text>
          )}

          <View className="mt-2 flex-row items-center gap-3">
            <Text className="text-xs text-muted-foreground">
              {formatRelativeDate(conversation.lastActivityAt)}
            </Text>
            {conversation.messageCount > 0 && (
              <Text className="text-xs text-muted-foreground">
                {conversation.messageCount} message{conversation.messageCount > 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          hitSlop={12}
          className="mt-1 rounded-lg p-2"
        >
          <Trash2 size={16} color={iconColors.muted} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function ConversationsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const iconColors = useIconColors();
  const {
    conversations,
    isLoading,
    error,
    createConversation,
    deleteConversation,
    isCreating,
  } = useConversations();

  const handleOpenConversation = useCallback(
    (sessionId: string) => {
      router.push({ pathname: '/(student)/(chat)', params: { sessionId } });
    },
    [router],
  );

  const handleNewConversation = useCallback(async () => {
    const sessionId = await createConversation();
    router.push({ pathname: '/(student)/(chat)', params: { sessionId } });
  }, [createConversation, router]);

  const handleDelete = useCallback(
    (conversation: Conversation) => {
      const title = conversation.title ?? 'cette conversation';
      Alert.alert(
        'Supprimer',
        `Supprimer "${title}" ? Cette action est irreversible.`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: () => deleteConversation(conversation.id),
          },
        ],
      );
    },
    [deleteConversation],
  );

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <ConversationItem
        conversation={item}
        onPress={() => handleOpenConversation(item.id)}
        onDelete={() => handleDelete(item)}
        iconColors={iconColors}
      />
    ),
    [handleOpenConversation, handleDelete, iconColors],
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="border-b border-border px-4 pb-3 pt-2">
        <Text className="text-2xl font-bold text-foreground">Conversations</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-muted-foreground">{error}</Text>
        </View>
      ) : conversations.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <MessageCircle size={48} color={iconColors.muted} />
          <Text className="mt-4 text-center text-lg font-medium text-foreground">
            Aucune conversation
          </Text>
          <Text className="mt-2 text-center text-muted-foreground">
            Commence une nouvelle conversation avec Tom !
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerClassName="pt-3 pb-24"
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB - New conversation */}
      <TouchableOpacity
        onPress={handleNewConversation}
        disabled={isCreating}
        activeOpacity={0.8}
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-primary"
        style={shadows.lg}
      >
        {isCreating ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Plus size={24} color="#fff" />
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}
