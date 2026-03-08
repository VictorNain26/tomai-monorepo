/**
 * Auth Stack - TomAI 2026
 *
 * Screens: Login, Register, Forgot password, Reset password, Callback
 */

import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { AppProviders } from '@/components/providers';
import { useStackScreenOptions } from '@/lib/navigation';

export default function AuthLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <AppProviders>
      <Suspense
        fallback={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" />
          </View>
        }
      >
        <Stack screenOptions={screenOptions} />
      </Suspense>
    </AppProviders>
  );
}
