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
  NunitoSans_400Regular,
  NunitoSans_500Medium,
  NunitoSans_600SemiBold,
} from '@expo-google-fonts/nunito-sans';
import {
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';

import { queryClient, persistOptions, initializeNetInfo } from '@/lib/query-client';
import { initializeAppApi } from '@/lib/api';
import { initializeDatabase } from '@/db';
import { startDevLogServer } from '@/lib/dev-logger';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { ThemeProvider, RevenueCatProvider } from '@/components/providers';
import { ToastProvider } from '@/components/ui/toast';
import { ConfirmDialogProvider } from '@/components/ui/confirm-dialog';
import { useSession, useUser } from '@/lib/auth';

// Start dev debug server (port 8347) for remote error access
startDevLogServer();

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

/**
 * Root Layout - Expo Router SDK 55 Best Practice
 *
 * Auth routing uses Stack.Protected (SDK 53+ pattern):
 * - No useEffect redirects, no race conditions
 * - Routes are declaratively guarded by session state
 * - History is auto-cleaned when guard changes
 *
 * @see https://docs.expo.dev/router/advanced/protected/
 * @see https://docs.expo.dev/router/advanced/authentication/
 */
function RootLayout() {
  const apiInitialized = useRef(false);
  const [isReady, setIsReady] = useState(false);

  const [fontsLoaded] = useFonts({
    NunitoSans_400Regular,
    NunitoSans_500Medium,
    NunitoSans_600SemiBold,
    Poppins_600SemiBold,
    Poppins_700Bold,
    JetBrainsMono_400Regular,
  });

  useEffect(() => {
    async function initialize() {
      if (apiInitialized.current) return;
      apiInitialized.current = true;

      try {
        initializeAppApi();
        initializeNetInfo();
        await initializeDatabase();
        setIsReady(true);
      } catch (error) {
        console.error('[App] Initialization error:', error);
        setIsReady(true);
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
      <SafeAreaProvider>
        <KeyboardProvider>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={persistOptions}
            onSuccess={() => {
              void queryClient.resumePausedMutations();
            }}
          >
            <ThemeProvider>
              <RevenueCatProvider>
                <ToastProvider>
                  <ConfirmDialogProvider>
                    <RootNavigator />
                    <StatusBar style="auto" />
                    <PortalHost />
                  </ConfirmDialogProvider>
                </ToastProvider>
              </RevenueCatProvider>
            </ThemeProvider>
          </PersistQueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Root Navigator - Stack.Protected auth guards
 *
 * Replaces the old index.tsx useEffect redirect pattern.
 * Expo Router auto-redirects to the first available screen
 * when a guard changes from true to false.
 */
function RootNavigator() {
  const { data: session, isPending } = useSession();
  const user = useUser();

  const isAuthenticated = !isPending && !!session?.user;
  const isParent = isAuthenticated && user?.role === 'parent';
  const isStudent = isAuthenticated && !isParent;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Unauthenticated: show auth screens */}
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      {/* Authenticated student: show student screens */}
      <Stack.Protected guard={isStudent}>
        <Stack.Screen name="(student)" />
      </Stack.Protected>

      {/* Authenticated parent: show parent screens */}
      <Stack.Protected guard={isParent}>
        <Stack.Screen name="(parent)" />
      </Stack.Protected>

      {/* Loading screen while auth is pending */}
      <Stack.Screen name="index" />
    </Stack>
  );
}

export default RootLayout;
