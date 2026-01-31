/**
 * App Providers
 *
 * Providers that use NativeWind (className).
 * Must be used INSIDE expo-router layouts, not around them.
 *
 * IMPORTANT: This wrapper applies the `.dark` class when dark mode is active.
 * NativeWind v4's setColorScheme() doesn't add the .dark class automatically,
 * so we need to do it manually for CSS variables in global.css to work.
 */

import { type ReactNode } from 'react';
import { View } from 'react-native';
import { ErrorBoundary } from '@/components/common/error-boundary';
import { ToastProvider } from '@/components/ui/toast';
import { useTheme } from '@/hooks';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const { isDark } = useTheme();

  return (
    <View className={`flex-1 ${isDark ? 'dark' : ''}`}>
      <ErrorBoundary>
        <ToastProvider>{children}</ToastProvider>
      </ErrorBoundary>
    </View>
  );
}
