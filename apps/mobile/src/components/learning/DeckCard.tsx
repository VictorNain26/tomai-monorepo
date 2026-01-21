/**
 * DeckCard Component
 *
 * Displays a single learning deck with play/delete options.
 */

import { View, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Play, Trash2 } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import type { LearningDeck } from '@/hooks/useLearning';

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
  français: '📚',
  'histoire-geo': '🌍',
  sciences: '🔬',
  svt: '🌱',
  physique: '⚛️',
  chimie: '🧪',
  anglais: '🇬🇧',
  espagnol: '🇪🇸',
  allemand: '🇩🇪',
  philosophie: '🧠',
};

function getSubjectEmoji(subject: string): string {
  const normalized = subject.toLowerCase().replace(/[^a-z]/g, '');
  return SUBJECT_EMOJIS[normalized] ?? '📖';
}

export function DeckCard({ deck, onDelete, isDeleting }: DeckCardProps) {
  const router = useRouter();

  function handlePlay() {
    router.push({
      pathname: '/(student)/deck/[id]',
      params: { id: deck.id },
    });
  }

  function handleDelete() {
    if (!onDelete) return;

    Alert.alert(
      'Supprimer le deck',
      `Supprimer "${deck.title}" ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => onDelete(deck.id),
        },
      ]
    );
  }

  const emoji = getSubjectEmoji(deck.subject);
  const dateStr = new Date(deck.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <View className="rounded-xl border border-border bg-card p-4">
      <View className="flex-row items-start gap-3">
        {/* Emoji */}
        <View className="h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
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
          </View>
        </View>

        {/* Actions */}
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={handlePlay}
            className="h-10 w-10 items-center justify-center rounded-full bg-primary"
          >
            <Play color="white" size={18} fill="white" />
          </TouchableOpacity>

          {onDelete && (
            <TouchableOpacity
              onPress={handleDelete}
              disabled={isDeleting}
              className="h-10 w-10 items-center justify-center rounded-full bg-destructive/10"
            >
              <Trash2 color="hsl(0 84.2% 60.2%)" size={18} />
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
}
