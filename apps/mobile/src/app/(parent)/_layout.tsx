/**
 * Parent Layout - TomAI 2026
 *
 * Stack navigator wrapping:
 * - profile-select: Netflix-like profile grid (initial)
 * - add-child: manual child add screen (0 children empty-state)
 * - tabs: MaterialTopTabs shell (home + profile)
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/lib/navigation';
import { useSession } from '@/lib/auth';
import { setupPushNotifications } from '@/lib/notifications';

export default function ParentLayout() {
  const screenOptions = useStackScreenOptions();
  const { data: session } = useSession();

  // Push notification registration (once, non-blocking)
  useEffect(() => {
    if (!session?.user) return;
    void setupPushNotifications();
  }, [session?.user]);

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="profile-select" />
      <Stack.Screen name="add-child" options={{ title: 'Ajouter un enfant' }} />
      <Stack.Screen name="tabs" />
    </Stack>
  );
}
