/**
 * ChatEmptyState Component - TomAI 2026
 *
 * Welcome screen shown when no messages exist.
 * Displays Tom avatar, greeting and up to 3 contextual suggestions.
 */

import { View, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { TomAvatar, SubjectIcon } from '@/components/common';
import { useThemeColors } from '@/hooks';

export interface ChatSuggestion {
  subject: string;
  label: string;
  prompt: string;
}

interface ChatEmptyStateProps {
  suggestions: ChatSuggestion[];
  onSendSuggestion: (prompt: string) => void;
}

export function ChatEmptyState({
  suggestions,
  onSendSuggestion,
}: ChatEmptyStateProps) {
  const colors = useThemeColors();

  return (
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
              onPress={() => onSendSuggestion(s.prompt)}
              className="flex-row items-center gap-3 rounded-xl bg-card p-3"
              activeOpacity={0.7}
              accessibilityLabel={s.label}
              accessibilityHint="Envoie cette question a Tom"
              accessibilityRole="button"
            >
              <SubjectIcon subject={s.subject} size={20} />
              <Text className="flex-1">{s.label}</Text>
              <ChevronRight color={colors.mutedForeground} size={16} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
