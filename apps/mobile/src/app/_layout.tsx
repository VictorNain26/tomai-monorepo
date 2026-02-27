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
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { ThemeProvider, RevenueCatProvider } from '@/components/providers';
import { ToastProvider } from '@/components/ui/toast';

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

/**
 * Root Layout - Expo Router Best Practice 2026
 *
 * Provider order (outside to inside):
 * 1. GestureHandlerRootView (native)
 * 2. SafeAreaProvider (native)
 * 3. KeyboardProvider (native - keyboard controller)
 * 4. PersistQueryClientProvider (React context)
 * 5. ThemeProvider (React context)
 * 6. RevenueCatProvider (React context)
 * 7. ToastProvider (global — inline styles, no NativeWind dependency)
 * 8. Slot (expo-router — initializes NavigationContainer)
 *
 * NativeWind className must NOT be used before Slot (css-interop needs NavigationContainer).
 * ToastProvider uses inline styles only, so it can safely live above Slot.
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
        >
          <ThemeProvider>
            <RevenueCatProvider>
              <ToastProvider>
                <View style={{ flex: 1 }}>
                  <Slot />
                  <StatusBar style="auto" />
                  <PortalHost />
                </View>
              </ToastProvider>
            </RevenueCatProvider>
          </ThemeProvider>
        </PersistQueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
