import '../global.css';

import { useEffect, useRef, useState } from 'react';
import { Slot } from 'expo-router';
import { View } from 'react-native';
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

import { queryClient, persistOptions, initializeNetInfo } from '@/lib/query-client';
import { initializeAppApi } from '@/lib/api';
import { initializeDatabase } from '@/db';
import { ThemeProvider, RevenueCatProvider } from '@/components/providers';

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

/**
 * Root Layout - Expo Router Best Practice 2026
 *
 * IMPORTANT: No NativeWind (className) before Slot!
 * NativeWind/css-interop requires NavigationContainer which Slot provides.
 *
 * Provider order (outside to inside):
 * 1. GestureHandlerRootView (native, no className)
 * 2. SafeAreaProvider (native, no className)
 * 3. PersistQueryClientProvider (React context only)
 * 4. ThemeProvider (React context only - no View with className!)
 * 5. Slot (expo-router - initializes NavigationContainer)
 *
 * Providers that use NativeWind (ToastProvider, etc.) go INSIDE the routes.
 */
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

  // IMPORTANT: Only native components and pure React context providers here
  // NO className usage before Slot!
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
        >
          <ThemeProvider>
            <RevenueCatProvider>
              <View style={{ flex: 1 }}>
                <Slot />
                <StatusBar style="auto" />
                <PortalHost />
              </View>
            </RevenueCatProvider>
          </ThemeProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
