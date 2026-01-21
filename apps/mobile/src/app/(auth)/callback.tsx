/**
 * OAuth Callback Screen
 *
 * Handles deep link callback from Google OAuth.
 * Waits for session and redirects based on user role.
 */

import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession, type IAppUser } from '@/lib/auth';

import { Text } from '@/components/ui/text';

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    // Wait for session to load
    if (isPending) return;

    // If session exists, redirect based on role
    if (session?.user) {
      // TomIA backend adds role to user, cast safely
      const user = session.user as unknown as IAppUser;
      const redirectPath = user.role === 'parent' ? '/(parent)' : '/(student)';
      router.replace(redirectPath);
      return;
    }

    // No session after loading = back to login
    router.replace('/(auth)/login');
  }, [session, isPending, router]);

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" color="hsl(222.2, 47.4%, 11.2%)" />
      <Text variant="muted" className="mt-4">
        Connexion en cours...
      </Text>
    </View>
  );
}
