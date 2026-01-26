import '../global.css';

import { useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
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

import { queryClient, persistOptions } from '@/lib/query-client';
import { initializeAppApi } from '@/lib/api';
import { initializeDatabase } from '@/db';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ErrorBoundary } from '@/components/common/error-boundary';
import { ToastProvider } from '@/components/ui/toast';
import { ThemeProvider, RevenueCatProvider } from '@/components/providers';

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const apiInitialized = useRef(false);
  const [isReady, setIsReady] = useState(false);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    JetBrainsMono_400Regular,
  });

  // Initialize API and database once when component mounts
  useEffect(() => {
    async function initialize() {
      if (apiInitialized.current) return;
      apiInitialized.current = true;

      try {
        // Initialize API client
        initializeAppApi();

        // Initialize SQLite database
        await initializeDatabase();

        setIsReady(true);
      } catch (error) {
        console.error('[App] Initialization error:', error);
        setIsReady(true); // Continue even on error
      }
    }

    initialize();
  }, []);

  useEffect(() => {
    if (fontsLoaded && isReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isReady]);

  if (!fontsLoaded || !isReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={persistOptions}
            onSuccess={() => {
              // Query cache restored from AsyncStorage
              console.log('[App] Query cache restored');
            }}
          >
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
          </PersistQueryClientProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
