import '../global.css';

import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PortalHost } from '@rn-primitives/portal';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';

import { queryClient } from '@/lib/query-client';
import { initializeAppApi } from '@/lib/api';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ErrorBoundary } from '@/components/common/error-boundary';
import { ToastProvider } from '@/components/ui/toast';
import { ThemeProvider, RevenueCatProvider } from '@/components/providers';

// Keep splash screen visible while loading fonts
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const apiInitialized = useRef(false);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    JetBrainsMono_400Regular,
  });

  // Initialize API once when component mounts (safe for native modules)
  useEffect(() => {
    if (!apiInitialized.current) {
      apiInitialized.current = true;
      initializeAppApi();
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <ToastProvider>
                <AuthGuard>
                  <RevenueCatProvider>
                    <Stack
                      screenOptions={{
                        headerShown: false,
                        animation: 'slide_from_right',
                      }}
                    >
                      <Stack.Screen name="index" />
                      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                      <Stack.Screen name="(student)" options={{ headerShown: false }} />
                      <Stack.Screen name="(parent)" options={{ headerShown: false }} />
                    </Stack>
                  </RevenueCatProvider>
                </AuthGuard>
                <StatusBar style="auto" />
                <PortalHost />
              </ToastProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
