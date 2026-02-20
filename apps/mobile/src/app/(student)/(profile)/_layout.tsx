/**
 * Student Profile Stack - TomAI 2026
 *
 * Screens: Profile menu, Settings, Info, Pronote screens
 */

import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/lib/navigation';

export default function ProfileLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="info" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="pronote" />
    </Stack>
  );
}
