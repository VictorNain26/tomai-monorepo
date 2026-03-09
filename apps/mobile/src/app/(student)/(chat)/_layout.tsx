/**
 * Student Chat Stack - TomAI 2026
 *
 * Screens:
 * - index: Conversations list (initial screen)
 * - chat: Chat screen (receives sessionId param)
 */

import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/lib/navigation';

export default function ChatLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="chat" options={{ headerShown: false }} />
    </Stack>
  );
}
