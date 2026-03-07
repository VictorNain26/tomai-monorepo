/**
 * App Entry Point
 *
 * Redirects to appropriate screen based on auth state.
 * Best Practice 2026: No landing page, direct to login or dashboard.
 */

import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession, useUser } from '@/lib/auth';
import { useThemeColors } from '@/hooks';

export default function Index() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const user = useUser();
  const colors = useThemeColors();

  useEffect(() => {
    if (isPending) return;

    if (session?.user) {
      // Authenticated -> redirect to dashboard
      if (user?.role === 'parent') {
        router.replace('/(parent)/');
      } else {
        router.replace('/(student)/');
      }
    } else {
      // Not authenticated -> redirect to login
      router.replace('/(auth)/login');
    }
  }, [isPending, session, user, router]);

  // Show loading while checking auth
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
