/**
 * ChatErrorBanner Component - TomAI 2026
 *
 * Inline error banner with retry action.
 * Announced via accessibilityRole="alert" + accessibilityLiveRegion="polite".
 */

import { View, TouchableOpacity } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks';
import { bgColors } from '@/lib/styles';

interface ChatErrorBannerProps {
  error: string;
  onRetry: () => void;
}

export function ChatErrorBanner({ error, onRetry }: ChatErrorBannerProps) {
  const colors = useThemeColors();

  return (
    <View
      className="mx-4 mt-2 flex-row items-center gap-3 rounded-lg p-3"
      style={{ backgroundColor: bgColors.destructive[10] }}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text className="flex-1 text-red-600 dark:text-red-400">{error}</Text>
      <TouchableOpacity
        onPress={onRetry}
        className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
        style={{ backgroundColor: bgColors.destructive[20] }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Réessayer"
        accessibilityRole="button"
      >
        <RefreshCw color={colors.destructive} size={14} />
        <Text className="text-sm font-semibold text-red-600 dark:text-red-400">
          Réessayer
        </Text>
      </TouchableOpacity>
    </View>
  );
}
