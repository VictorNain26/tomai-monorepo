/**
 * Student Chat Stack - TomAI 2026
 *
 * Screens: Chat (Tom AI tutor)
 */

import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/lib/navigation';

export default function ChatLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
