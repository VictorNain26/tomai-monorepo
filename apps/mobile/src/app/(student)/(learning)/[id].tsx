/**
 * Deck Review Screen - FSRS Spaced Repetition
 *
 * Fetches due cards from FSRS algorithm, shows rating buttons
 * (Again/Hard/Good/Easy), and tracks session results.
 */

import { useState, useCallback } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, Check } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { CardViewer } from '@/components/learning';
import { useDueCards, useReviewCard, useDeck, useIconColors, useThemeColors, type ThemeColors } from '@/hooks';
import type { FSRSRating, ReviewResult, CardType } from '@/hooks';
import { bgColors } from '@/lib/styles';
import { haptics } from '@/lib/haptics';

// ============================================================================
// RATING CONFIG
// ============================================================================

interface RatingConfig {
  value: FSRSRating;
  label: string;
  color: string;
  bg: string;
}

function getRatings(colors: ThemeColors): RatingConfig[] {
  return [
    { value: 1, label: 'À revoir', color: colors.destructive, bg: bgColors.destructive[10] },
    { value: 2, label: 'Difficile', color: colors.warning, bg: bgColors.warning[10] },
    { value: 3, label: 'Bien', color: colors.success, bg: bgColors.success[10] },
    { value: 4, label: 'Facile', color: colors.primary, bg: bgColors.primary[10] },
  ];
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function DeckReviewScreen() {
  const router = useRouter();
  const iconColors = useIconColors();
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<ReviewResult[]>([]);

  const { data: deckData } = useDeck(id ?? '');
  const { data: dueData, isLoading, error, refetch } = useDueCards(id ?? '');
  const reviewMutation = useReviewCard();

  const deck = deckData?.deck;
  const cards = dueData?.cards ?? [];
  const totalCards = cards.length;
  const currentCard = cards[currentIndex];
  const progress = totalCards > 0 ? (currentIndex / totalCards) * 100 : 0;

  const handleRate = useCallback(
    async (rating: FSRSRating) => {
      if (!currentCard || reviewMutation.isPending) return;

      void haptics.light();

      try {
        const result = await reviewMutation.mutateAsync({
          cardId: currentCard.id,
          rating,
        });
        setResults((prev) => [...prev, result]);
        setCurrentIndex((prev) => prev + 1);
      } catch {
        // Error shown via reviewMutation.error
      }
    },
    [currentCard, reviewMutation]
  );

  const handleClose = useCallback(() => router.back(), [router]);

  const handleContinue = useCallback(() => {
    setCurrentIndex(0);
    setResults([]);
    void refetch();
  }, [refetch]);

  const handleAskTom = useCallback(() => {
    const failedCount = results.filter((r) => r.rating === 1).length;
    router.push({
      pathname: '/(student)/(chat)',
      params: {
        prompt: `J'ai eu du mal avec ${failedCount} carte${failedCount > 1 ? 's' : ''} dans "${deck?.title}". Peux-tu m'aider ?`,
      },
    });
  }, [results, deck?.title, router]);

  // Loading
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
        <View className="flex-1 items-center justify-center p-6">
          <Skeleton className="mb-4 h-8 w-48 rounded" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </View>
      </SafeAreaView>
    );
  }

  // Error
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="mb-4 text-red-600 dark:text-red-400">
            {error.message ?? 'Erreur de chargement'}
          </Text>
          <Button onPress={handleClose}>
            <Text className="text-white dark:text-slate-900">Retour</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // No due cards
  if (totalCards === 0) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
        <View className="flex-1 items-center justify-center p-6">
          <View
            className="mb-4 h-20 w-20 items-center justify-center rounded-full"
            style={{ backgroundColor: bgColors.success[10] }}
          >
            <Check color={colors.success} size={40} />
          </View>
          <Text variant="h2" className="text-center">
            Tout est révisé !
          </Text>
          <Text variant="muted" className="mt-2 text-center">
            Aucune carte à réviser pour le moment.{'\n'}Reviens plus tard !
          </Text>
          <Button onPress={handleClose} className="mt-8">
            <Text className="font-semibold text-white dark:text-slate-900">
              Retour aux decks
            </Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Session complete
  if (currentIndex >= totalCards) {
    return (
      <SessionComplete
        results={results}
        totalCards={totalCards}
        onContinue={handleContinue}
        onClose={handleClose}
        onAskTom={results.some((r) => r.rating === 1) ? handleAskTom : undefined}
      />
    );
  }

  // Main review UI
  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <TouchableOpacity
          onPress={handleClose}
          className="h-10 w-10 items-center justify-center rounded-full"
        >
          <X color={iconColors.muted} size={24} />
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="font-semibold" numberOfLines={1}>
            {deck?.title ?? 'Révision'}
          </Text>
          <Text variant="muted" className="text-xs">
            {currentIndex + 1} / {totalCards}
          </Text>
        </View>
        <View className="w-10" />
      </View>

      {/* Progress */}
      <Progress value={progress} className="h-1 rounded-none" />

      {/* Card Content */}
      <View className="flex-1 p-4">
        <CardViewer
          key={currentCard.id}
          cardType={currentCard.cardType as CardType}
          content={currentCard.content}
        />
      </View>

      {/* Rating Buttons */}
      <View className="border-t border-slate-200 dark:border-slate-700 px-4 py-4">
        {reviewMutation.isPending ? (
          <View className="items-center py-3">
            <ActivityIndicator size="small" />
          </View>
        ) : (
          <>
            <Text variant="muted" className="mb-3 text-center text-xs">
              Comment c'était ?
            </Text>
            <View className="flex-row gap-2">
              {getRatings(colors).map(({ value, label, color, bg }) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => handleRate(value)}
                  className="flex-1 items-center rounded-xl py-3"
                  style={{ backgroundColor: bg }}
                  accessibilityLabel={label}
                  accessibilityRole="button"
                >
                  <Text className="text-xs font-semibold" style={{ color }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        {reviewMutation.error && (
          <Text className="mt-2 text-center text-xs text-red-600 dark:text-red-400">
            Erreur, réessaye
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

// ============================================================================
// SESSION COMPLETE
// ============================================================================

interface SessionCompleteProps {
  results: ReviewResult[];
  totalCards: number;
  onContinue: () => void;
  onClose: () => void;
  onAskTom?: () => void;
}

function SessionComplete({
  results,
  totalCards,
  onContinue,
  onClose,
  onAskTom,
}: SessionCompleteProps) {
  const colors = useThemeColors();
  const breakdown = [
    { label: 'À revoir', count: results.filter((r) => r.rating === 1).length, color: colors.destructive, bg: bgColors.destructive[10] },
    { label: 'Difficile', count: results.filter((r) => r.rating === 2).length, color: colors.warning, bg: bgColors.warning[10] },
    { label: 'Bien', count: results.filter((r) => r.rating === 3).length, color: colors.success, bg: bgColors.success[10] },
    { label: 'Facile', count: results.filter((r) => r.rating === 4).length, color: colors.primary, bg: bgColors.primary[10] },
  ].filter((b) => b.count > 0);

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <View className="flex-1 items-center justify-center p-6">
        <Text className="mb-2 text-6xl">🎉</Text>
        <Text variant="h2" className="text-center">
          Session terminée !
        </Text>
        <Text variant="muted" className="mt-2 text-center">
          {totalCards} carte{totalCards > 1 ? 's' : ''} révisée
          {totalCards > 1 ? 's' : ''}
        </Text>

        {/* Results breakdown */}
        <View className="mt-6 w-full gap-2">
          {breakdown.map(({ label, count, color, bg }) => (
            <View
              key={label}
              className="flex-row items-center justify-between rounded-lg px-4 py-2"
              style={{ backgroundColor: bg }}
            >
              <Text>{label}</Text>
              <Text className="font-semibold" style={{ color }}>
                {count}
              </Text>
            </View>
          ))}
        </View>

        <View className="mt-8 w-full gap-3">
          <Button onPress={onContinue}>
            <Text className="font-semibold text-white dark:text-slate-900">
              Continuer à réviser
            </Text>
          </Button>
          <Button variant="outline" onPress={onClose}>
            <Text className="font-semibold">Retour aux decks</Text>
          </Button>
          {onAskTom && (
            <Button variant="outline" onPress={onAskTom}>
              <Text className="font-semibold">Demander a Tom</Text>
            </Button>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
