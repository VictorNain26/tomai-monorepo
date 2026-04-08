/**
 * OAuth Callback Screen
 *
 * Handles deep link callback from Google OAuth.
 * Stack.Protected in root layout auto-redirects when session resolves.
 */

import { View, ActivityIndicator } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Text } from '@/components/ui/text';

export default function OAuthCallbackScreen() {
  const colors = useThemeColors();

  return (
    <View className="flex-1 items-center justify-center bg-stone-50 dark:bg-stone-900">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text variant="muted" className="mt-4">
        Connexion en cours...
      </Text>
    </View>
  );
}
