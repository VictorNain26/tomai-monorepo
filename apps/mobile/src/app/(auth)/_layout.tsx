/**
 * Auth Stack - TomAI 2026
 *
 * Screens: Login, Register, Forgot password, Reset password, Callback
 */

import { Stack } from 'expo-router';
import { ErrorBoundary } from '@/components/common/error-boundary';
import { useStackScreenOptions } from '@/lib/navigation';

export default function AuthLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <ErrorBoundary>
      <Stack screenOptions={screenOptions} />
    </ErrorBoundary>
  );
}
