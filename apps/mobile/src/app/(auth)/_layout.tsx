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

export default function AuthLayout() {
  const screenOptions = useStackScreenOptions();

  return <Stack screenOptions={screenOptions} />;
}
