/**
 * Parent Profile Stack - TomAI 2026
 *
 * Screens: Profile menu, Settings, Pricing
 */

import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/lib/navigation';

export default function ProfileLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="pricing" />
    </Stack>
  );
}
