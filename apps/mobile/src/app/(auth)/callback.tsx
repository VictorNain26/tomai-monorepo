/**
 * OAuth Callback Screen
 *
 * Handles deep link callback from Google OAuth.
 * Waits for session and redirects based on user role.
 */

import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useUser, useSession } from '@/lib/auth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Text } from '@/components/ui/text';

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const user = useUser();
  const { data: session, isPending } = useSession();
  const colors = useThemeColors();

  useEffect(() => {
    if (isPending) return;

    if (user) {
      const redirectPath = user.role === 'parent' ? '/(parent)' : '/(student)';
      router.replace(redirectPath);
      return;
    }

    router.replace('/(auth)/login');
  }, [session, isPending, router, user]);

  return (
    <View className="flex-1 items-center justify-center bg-stone-50 dark:bg-stone-900">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text variant="muted" className="mt-4">
        Connexion en cours...
      </Text>
    </View>
  );
}
