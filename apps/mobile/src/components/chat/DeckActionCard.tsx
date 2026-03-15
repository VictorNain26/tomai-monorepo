/**
 * DeckActionCard Component
 *
 * Compact card displayed in chat after an assistant message
 * generates a flashcard deck. Navigates to the learning review screen.
 */

import { View, TouchableOpacity } from 'react-native';
import { BookOpen, ArrowRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/components/ui/text';
import { useIconColors, useThemeColors } from '@/hooks';
import { bgColors, shadows } from '@/lib/styles';

interface DeckActionCardProps {
  deckId: string;
  title: string;
  cardCount: number;
  subject: string;
}

export function DeckActionCard({ deckId, title, cardCount, subject }: DeckActionCardProps) {
  const router = useRouter();
  const iconColors = useIconColors();
  const colors = useThemeColors();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push(`/(student)/(learning)/${deckId}`)}
      style={shadows.sm}
      className="flex-row items-center gap-3 rounded-xl bg-white dark:bg-stone-800 p-3"
      accessibilityRole="button"
      accessibilityLabel={`Réviser ${title}`}
    >
      <View
        className="h-9 w-9 items-center justify-center rounded-lg"
        style={{ backgroundColor: bgColors.primary[10] }}
      >
        <BookOpen color={iconColors.primary} size={18} />
      </View>

      <View className="flex-1">
        <Text className="font-semibold" numberOfLines={1}>{title}</Text>
        <Text variant="muted" className="text-xs">
          {cardCount} cartes · {subject}
        </Text>
      </View>

      <View className="flex-row items-center gap-1">
        <Text className="text-sm font-medium text-blue-600 dark:text-blue-400">Réviser</Text>
        <ArrowRight color={colors.primary} size={16} />
      </View>
    </TouchableOpacity>
  );
}
