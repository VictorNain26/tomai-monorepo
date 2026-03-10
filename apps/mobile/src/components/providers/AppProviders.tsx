/**
 * App Providers
 *
 * Providers that use NativeWind (className).
 * Must be used INSIDE expo-router layouts, not around them.
 *
 * NativeWind v5: dark mode handled via vars() in ThemeProvider.
 *
 * Note: ToastProvider is global (root _layout.tsx), not per-route.
 */

import { type ReactNode } from 'react';
import { ErrorBoundary } from '@/components/common/error-boundary';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}
