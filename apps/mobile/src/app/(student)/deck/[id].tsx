/**
 * Deck Play Screen
 *
 * Plays through a deck's cards with navigation and feedback.
 */

import { useState, useCallback } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, X, RotateCcw } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { CardViewer } from '@/components/learning';
import { useDeck } from '@/hooks';

export default function DeckPlayScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data, isLoading, error } = useDeck(id ?? '');

  const cards = data?.cards ?? [];
  const deck = data?.deck;
  const totalCards = cards.length;
  const currentCard = cards[currentIndex];
  const progress = totalCards > 0 ? ((currentIndex + 1) / totalCards) * 100 : 0;

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < totalCards - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, totalCards]);

  const handleRestart = useCallback(() => {
    setCurrentIndex(0);
  }, []);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <Skeleton className="mb-4 h-8 w-48 rounded" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !deck) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="mb-4 text-destructive">
            {error?.message ?? 'Deck non trouvé'}
          </Text>
          <Button onPress={handleClose}>
            <Text className="text-primary-foreground">Retour</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Completion state
  if (currentIndex >= totalCards && totalCards > 0) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="mb-2 text-6xl">🎉</Text>
          <Text variant="h2" className="text-center">
            Terminé !
          </Text>
          <Text variant="muted" className="mt-2 text-center">
            Tu as parcouru les {totalCards} cartes de ce deck.
          </Text>
          <View className="mt-8 w-full gap-3">
            <Button onPress={handleRestart}>
              <Text className="font-semibold text-primary-foreground">
                Recommencer
              </Text>
            </Button>
            <Button variant="outline" onPress={handleClose}>
              <Text className="font-semibold">Retour aux decks</Text>
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <TouchableOpacity onPress={handleClose} className="p-2">
          <X color="hsl(215.4, 16.3%, 46.9%)" size={24} />
        </TouchableOpacity>

        <View className="flex-1 items-center">
          <Text className="font-semibold" numberOfLines={1}>
            {deck.title}
          </Text>
          <Text variant="muted" className="text-xs">
            {currentIndex + 1} / {totalCards}
          </Text>
        </View>

        <TouchableOpacity onPress={handleRestart} className="p-2">
          <RotateCcw color="hsl(215.4, 16.3%, 46.9%)" size={20} />
        </TouchableOpacity>
      </View>

      {/* Progress */}
      <Progress value={progress} className="h-1 rounded-none" />

      {/* Card Content */}
      <View className="flex-1 p-4">
        {currentCard && (
          <CardViewer
            key={currentCard.id}
            cardType={currentCard.cardType}
            content={currentCard.content}
          />
        )}
      </View>

      {/* Navigation */}
      <View className="flex-row items-center justify-between border-t border-border px-4 py-4">
        <TouchableOpacity
          onPress={handlePrevious}
          disabled={currentIndex === 0}
          className={`h-12 w-12 items-center justify-center rounded-full ${
            currentIndex === 0 ? 'bg-muted' : 'bg-primary/10'
          }`}
        >
          <ChevronLeft
            color={
              currentIndex === 0
                ? 'hsl(215.4, 16.3%, 46.9%)'
                : 'hsl(222.2, 47.4%, 11.2%)'
            }
            size={24}
          />
        </TouchableOpacity>

        <Text variant="muted">
          Carte {currentIndex + 1} sur {totalCards}
        </Text>

        <TouchableOpacity
          onPress={handleNext}
          className="h-12 w-12 items-center justify-center rounded-full bg-primary"
        >
          <ChevronRight color="white" size={24} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
