import { Stack } from 'expo-router';
import { AppProviders } from '@/components/providers';

export default function AuthLayout() {
  return (
    <AppProviders>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
    </AppProviders>
  );
}
