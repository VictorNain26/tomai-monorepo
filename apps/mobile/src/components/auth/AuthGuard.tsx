/**
 * Auth Guard Component
 *
 * Protects routes requiring authentication.
 * Redirects to login if not authenticated.
 */

import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useSession, useUser, type IAppUser } from '@repo/api';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: 'student' | 'parent';
}

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const router = useRouter();
  const segments = useSegments();
  const { data: session, isPending } = useSession();
  const user = useUser();

  useEffect(() => {
    if (isPending) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isAuthenticated = !!session?.user;

    if (!isAuthenticated && !inAuthGroup) {
      // Not authenticated and not in auth group -> redirect to login
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Authenticated but in auth group -> redirect to appropriate dashboard
      if (user?.role === 'parent') {
        router.replace('/(parent)/');
      } else {
        router.replace('/(student)/');
      }
    } else if (isAuthenticated && requiredRole && user?.role !== requiredRole) {
      // Wrong role -> redirect to correct dashboard
      if (user?.role === 'parent') {
        router.replace('/(parent)/');
      } else {
        router.replace('/(student)/');
      }
    }
  }, [isPending, session, segments, requiredRole, user, router]);

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="hsl(222.2 47.4% 11.2%)" />
      </View>
    );
  }

  return <>{children}</>;
}

/**
 * Hook to get current user with type safety.
 * Throws if used outside authenticated context.
 */
export function useRequiredUser(): IAppUser {
  const user = useUser();
  if (!user) {
    throw new Error('useRequiredUser must be used in authenticated context');
  }
  return user;
}
