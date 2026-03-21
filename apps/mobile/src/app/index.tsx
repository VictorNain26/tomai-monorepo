/**
 * Loading Screen
 *
 * Shown briefly while Stack.Protected evaluates auth guards.
 * No redirect logic — Stack.Protected handles routing declaratively.
 */

import { View, ActivityIndicator } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function LoadingScreen() {
  const colors = useThemeColors();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
      }}
    >
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
