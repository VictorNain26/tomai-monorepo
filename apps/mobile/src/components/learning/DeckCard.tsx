/**
 * DeckCard Component
 *
 * Displays a single learning deck with play/delete options.
 */

import { memo, useCallback } from 'react';
import { View, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Play, Trash2 } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import type { LearningDeck } from '@/hooks/useLearning';
import { useDeckStats, useIconColors, useThemeColors } from '@/hooks';
import { bgColors } from '@/lib/styles';

interface DeckCardProps {
  deck: LearningDeck;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
}

// Emoji mapping for subjects
const SUBJECT_EMOJIS: Record<string, string> = {
  mathematiques: '🔢',
  maths: '🔢',
  francais: '📚',
  'histoire-geo': '🌍',
  sciences: '🔬',
  svt: '🌱',
  physique: '⚛️',
  chimie: '🧪',
  anglais: '🇬🇧',
  espagnol: '🇪🇸',
  allemand: '🇩🇪',
  philosophie: '🤔',
};

function getSubjectEmoji(subject: string): string {
  const normalized = subject.toLowerCase().replace(/[^a-z-]/g, '');
  return SUBJECT_EMOJIS[normalized] ?? '📖';
}

export const DeckCard = memo(function DeckCard({ deck, onDelete, isDeleting }: DeckCardProps) {
  const router = useRouter();
  const iconColors = useIconColors();
  const colors = useThemeColors();
  const { data: stats } = useDeckStats(deck.id);

  const dueCount = stats?.dueToday ?? 0;

  const handlePlay = useCallback(() => {
    router.push({
      pathname: '/(student)/(learning)/[id]',
      params: { id: deck.id },
    });
  }, [router, deck.id]);

  const handleDelete = useCallback(() => {
    if (!onDelete) return;

    Alert.alert(
      'Supprimer le deck',
      `Supprimer "${deck.title}" ? Cette action est irreversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => onDelete(deck.id),
        },
      ]
    );
  }, [onDelete, deck.id, deck.title]);

  const emoji = getSubjectEmoji(deck.subject);
  const dateStr = new Date(deck.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <View className="rounded-xl bg-white dark:bg-slate-800 p-4">
      <View className="flex-row items-start gap-3">
        {/* Emoji */}
        <View className="h-12 w-12 items-center justify-center rounded-lg" style={{ backgroundColor: bgColors.primary[10] }}>
          <Text className="text-2xl">{emoji}</Text>
        </View>

        {/* Content */}
        <View className="flex-1">
          <Text className="font-semibold" numberOfLines={1}>
            {deck.title}
          </Text>
          <Text variant="muted" className="text-sm capitalize">
            {deck.subject.replace('-', ' ')}
          </Text>
          <View className="mt-1 flex-row items-center gap-2">
            <Text variant="muted" className="text-xs">
              {deck.cardCount} cartes
            </Text>
            <Text variant="muted" className="text-xs">
              •
            </Text>
            <Text variant="muted" className="text-xs">
              {dateStr}
            </Text>
            {dueCount > 0 && (
              <>
                <Text variant="muted" className="text-xs">
                  •
                </Text>
                <Text className="text-xs font-semibold" style={{ color: colors.primary }}>
                  {dueCount} a reviser
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Actions */}
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={handlePlay}
            className="h-10 w-10 items-center justify-center rounded-full bg-blue-600 dark:bg-blue-400"
            accessibilityLabel={`Reviser ${deck.title}`}
            accessibilityRole="button"
          >
            <Play color={colors.primaryForeground} size={18} fill={colors.primaryForeground} />
          </TouchableOpacity>

          {onDelete && (
            <TouchableOpacity
              onPress={handleDelete}
              disabled={isDeleting}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: bgColors.destructive[10] }}
              accessibilityLabel={`Supprimer ${deck.title}`}
              accessibilityRole="button"
            >
              <Trash2 color={iconColors.destructive} size={18} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Description if exists */}
      {deck.description && (
        <Text variant="muted" className="mt-2 text-sm" numberOfLines={2}>
          {deck.description}
        </Text>
      )}
    </View>
  );
});
