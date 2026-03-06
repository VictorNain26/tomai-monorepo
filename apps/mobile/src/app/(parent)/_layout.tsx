/**
 * Parent Layout - TomAI 2026
 *
 * Optimized navigation structure with proper Stack navigators inside each tab.
 * Uses popToTopOnBlur to reset stacks when switching tabs (standard UX).
 *
 * Structure:
 * - (home)/    → Stack: Dashboard, Child screens
 * - (profile)/ → Stack: Profile menu, Settings, Pricing, Pronote
 */

import { Suspense, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Home, User } from 'lucide-react-native';
import { useSession, useUser } from '@/lib/auth';
import { AppProviders } from '@/components/providers';
import { useTheme, useThemeColors } from '@/hooks';
import { useTabScreenOptions, useTabBarConfig } from '@/lib/navigation';
import { setupPushNotifications } from '@/lib/notifications';

export default function ParentLayout() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const user = useUser();
  useTheme();
  const colors = useThemeColors();

  // Shared tab bar config (colors + style)
  const { tabColors, tabBarStyle } = useTabBarConfig();

  // Shared tab animation/performance options (React Navigation 7)
  const tabOptions = useTabScreenOptions(tabColors.background);

  // Push notification registration (once, non-blocking)
  useEffect(() => {
    if (!session?.user) return;
    void setupPushNotifications();
  }, [session?.user]);

  useEffect(() => {
    if (isPending) return;

    if (!session?.user) {
      router.replace('/(auth)/login');
    } else if (user?.role !== 'parent') {
      router.replace('/(student)/');
    }
  }, [isPending, session, user, router]);

  // Show loading while checking auth
  if (isPending || !session?.user || user?.role !== 'parent') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <AppProviders>
      <Suspense
        fallback={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        }
      >
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: tabColors.active,
          tabBarInactiveTintColor: tabColors.inactive,
          tabBarStyle,
          tabBarShowLabel: false,
          popToTopOnBlur: true,
          ...tabOptions,
        }}
      >
        {/* Tab 1: Home (Dashboard + Child screens) */}
        <Tabs.Screen
          name="(home)"
          options={{
            title: 'Accueil',
            tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
          }}
        />

        {/* Tab 2: Profile (Settings, Pricing, Pronote) */}
        <Tabs.Screen
          name="(profile)"
          options={{
            title: 'Profil',
            tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
          }}
        />
      </Tabs>
      </Suspense>
    </AppProviders>
  );
}
