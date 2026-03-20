/**
 * Parent Home Stack - TomAI 2026
 *
 * Screens: Dashboard, Child detail, Pronote connect
 */

import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/lib/navigation';

export default function HomeLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-child" options={{ title: 'Nouvel enfant' }} />
      <Stack.Screen name="child" />
      <Stack.Screen name="pronote-connect" />
    </Stack>
  );
}
