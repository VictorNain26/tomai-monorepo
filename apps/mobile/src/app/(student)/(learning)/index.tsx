/**
 * Learning Screen
 *
 * Displays user's learning decks with play/delete options.
 */

import { View, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/ui/screen';
import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { BookOpen, Plus } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Skeleton } from '@/components/ui/skeleton';
import { DeckCard } from '@/components/learning';
import { useLearning, useThemeColors } from '@/hooks';
import { bgColors } from '@/lib/styles';

export default function LearningScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [refreshing, setRefreshing] = useState(false);
  const { decks, isLoading, error, refetch, deleteDeck, isDeleting } =
    useLearning();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteDeck(id);
    },
    [deleteDeck]
  );

  return (
    <Screen>
      <ScrollView
        testID="deck-list"
        className="flex-1 px-4 py-6"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View className="mb-6 flex-row items-start justify-between">
          <View className="flex-1">
            <Text variant="h2" className="text-primary">
              Révisions
            </Text>
            <Text variant="muted" className="mt-1">
              {decks.length > 0
                ? `${decks.length} deck${decks.length > 1 ? 's' : ''} disponible${decks.length > 1 ? 's' : ''}`
                : 'Crée ton premier deck'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(student)/(learning)/create')}
            className="h-11 w-11 items-center justify-center rounded-full bg-primary"
            accessibilityLabel="Créer un deck"
            accessibilityRole="button"
          >
            <Plus color="white" size={20} />
          </TouchableOpacity>
        </View>

        {/* Error */}
        {error && (
          <View className="mb-4 rounded-xl p-4" style={{ backgroundColor: bgColors.destructive[10] }}>
            <Text className="text-center text-destructive">{error}</Text>
          </View>
        )}

        {/* Loading */}
        {isLoading && (
          <View className="gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </View>
        )}

        {/* Empty State */}
        {!isLoading && decks.length === 0 && (
          <View className="items-center py-12">
            <View className="mb-4 h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: bgColors.primary[10] }}>
              <BookOpen color={colors.foreground} size={40} />
            </View>
            <Text variant="h3" className="text-center">
              Pas encore de decks
            </Text>
            <Text variant="muted" className="mt-2 px-8 text-center">
              Crée des flashcards pour réviser tes cours. Choisis une matière et
              un thème pour commencer !
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(student)/(learning)/create')}
              className="mt-6 flex-row items-center gap-2 rounded-xl bg-primary px-6 py-3"
              accessibilityLabel="Créer un deck"
              accessibilityRole="button"
            >
              <Plus color="white" size={18} />
              <Text className="font-semibold text-primary-foreground">
                Créer un deck
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Decks List */}
        {!isLoading && decks.length > 0 && (
          <View className="gap-4">
            {decks.map((deck) => (
              <DeckCard
                key={deck.id}
                deck={deck}
                onDelete={handleDelete}
                isDeleting={isDeleting}
              />
            ))}
          </View>
        )}

        {/* Info */}
        {!isLoading && decks.length > 0 && (
          <View className="mt-6 rounded-xl bg-card p-4">
            <Text variant="muted" className="text-center text-sm">
              Appuie sur le bouton Jouer pour démarrer un deck, ou sur Supprimer pour l'effacer.
            </Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
