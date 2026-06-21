/**
 * Parent Home Stack - TomAI 2026
 *
 * Screens: Dashboard, Child detail
 */

import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/lib/navigation';

export default function HomeLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="child" />
    </Stack>
  );
}
