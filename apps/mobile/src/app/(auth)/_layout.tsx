/**
 * Auth Stack - TomAI 2026
 *
 * Screens: Login, Register, Forgot password, Reset password, Callback
 */

import { Stack } from 'expo-router';
import { AppProviders } from '@/components/providers';
import { useStackScreenOptions } from '@/lib/navigation';

export default function AuthLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <AppProviders>
      <Stack screenOptions={screenOptions} />
    </AppProviders>
  );
}
