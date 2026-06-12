/**
 * ScrollToBottomFab Component - TomAI 2026
 *
 * Floating action button shown when user has scrolled away from the bottom
 * of an inverted chat list. Minimum 44x44pt tap target (WCAG 2.5.5).
 */

import { TouchableOpacity } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useThemeColors } from '@/hooks';

interface ScrollToBottomFabProps {
  onPress: () => void;
}

export function ScrollToBottomFab({ onPress }: ScrollToBottomFabProps) {
  const colors = useThemeColors();

  return (
    <TouchableOpacity
      onPress={onPress}
      className="absolute bottom-3 right-3 h-11 w-11 items-center justify-center rounded-full bg-card shadow-sm"
      style={{ elevation: 3 }}
      accessibilityRole="button"
      accessibilityLabel="Retourner en bas de la conversation"
    >
      <ChevronDown color={colors.foreground} size={20} />
    </TouchableOpacity>
  );
}
