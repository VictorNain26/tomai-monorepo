/**
 * DeckCard Component
 *
 * Displays a single learning deck with play/delete options.
 */

import { memo, useCallback } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Play, Trash2 } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { SubjectIcon } from '@/components/common/SubjectIcon';
import { enrichSubjectKey, getSubjectStyles } from '@/constants/subjects';
import { cn } from '@/lib/utils';
import type { LearningDeck } from '@/hooks/useLearning';
import { useDeckStats, useThemeColors } from '@/hooks';
import { bgColors } from '@/lib/styles';

interface DeckCardProps {
  deck: LearningDeck;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
}


export const DeckCard = memo(function DeckCard({ deck, onDelete, isDeleting }: DeckCardProps) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const colors = useThemeColors();
  const { data: stats } = useDeckStats(deck.id);

  const dueCount = stats?.dueToday ?? 0;

  const handlePlay = useCallback(() => {
    router.push({
      pathname: '/(student)/(learning)/[id]',
      params: { id: deck.id },
    });
  }, [router, deck.id]);

  const handleDelete = useCallback(async () => {
    if (!onDelete) return;

    const confirmed = await confirm({
      title: 'Supprimer le deck',
      message: `Supprimer "${deck.title}" ? Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      variant: 'destructive',
    });
    if (confirmed) {
      onDelete(deck.id);
    }
  }, [onDelete, deck.id, deck.title, confirm]);

  const subjectMeta = enrichSubjectKey(deck.subject);
  const subjectStyles = getSubjectStyles(subjectMeta.color);
  const dateStr = new Date(deck.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <View className="rounded-xl bg-white dark:bg-stone-800 p-4">
      <View className="flex-row items-start gap-3">
        {/* Subject icon */}
        <View className={cn('h-12 w-12 items-center justify-center rounded-lg', subjectStyles.bgSubtle)}>
          <SubjectIcon subject={deck.subject} size={24} />
        </View>

        {/* Content */}
        <View className="flex-1">
          <Text className="font-semibold" numberOfLines={1}>
            {deck.title}
          </Text>
          <Text variant="muted" className="text-sm">
            {subjectMeta.name}
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
            className="h-11 w-11 items-center justify-center rounded-full bg-blue-600 dark:bg-blue-400"
            accessibilityLabel={`Reviser ${deck.title}`}
            accessibilityRole="button"
          >
            <Play color={colors.primaryForeground} size={18} fill={colors.primaryForeground} />
          </TouchableOpacity>

          {onDelete && (
            <TouchableOpacity
              onPress={handleDelete}
              disabled={isDeleting}
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: bgColors.destructive[10] }}
              accessibilityLabel={`Supprimer ${deck.title}`}
              accessibilityRole="button"
            >
              <Trash2 color={colors.destructive} size={18} />
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
