/**
 * Student Chat Stack - TomAI 2026
 *
 * Screens:
 * - conversations: List of all conversations
 * - index: Chat screen (receives sessionId param)
 */

import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/lib/navigation';

export default function ChatLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="conversations" options={{ title: 'Conversations' }} />
      <Stack.Screen name="index" />
    </Stack>
  );
}
