/**
 * Auth Stack - TomAI 2026
 *
 * Screens: Login, Register, Forgot password, Reset password, Callback
 *
 * Error handling: Use per-route `export function ErrorBoundary` in individual
 * screen files instead of wrapping the navigator (Expo Router best practice).
 */

import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/lib/navigation';

export const unstable_settings = {
  initialRouteName: 'login',
};

export default function AuthLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="callback" />
    </Stack>
  );
}
