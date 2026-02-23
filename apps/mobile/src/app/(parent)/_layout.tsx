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

import { useEffect, useMemo } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, User } from 'lucide-react-native';
import { useSession, useUser } from '@/lib/auth';
import { AppProviders } from '@/components/providers';
import { useTheme } from '@/hooks';
import { colors } from '@/lib/styles';
import { useTabScreenOptions } from '@/lib/navigation';
import { setupPushNotifications } from '@/lib/notifications';

// Base tab bar height (without safe area)
const TAB_BAR_HEIGHT = 56;
const TAB_BAR_PADDING_TOP = 8;

export default function ParentLayout() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const user = useUser();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Compute tab colors based on theme
  const tabColors = useMemo(
    () => ({
      active: colors.primary.DEFAULT,
      inactive: colors.muted.foreground,
      background: isDark ? colors.background.dark : colors.background.light,
      border: isDark ? colors.border.dark : colors.border.light,
    }),
    [isDark]
  );

  // Compute tab bar style with safe area insets
  const tabBarStyle = useMemo(
    () => ({
      backgroundColor: tabColors.background,
      borderTopColor: tabColors.border,
      borderTopWidth: 1,
      paddingTop: TAB_BAR_PADDING_TOP,
      paddingBottom: Math.max(insets.bottom, 8),
      height: TAB_BAR_HEIGHT + Math.max(insets.bottom, 8),
    }),
    [tabColors, insets.bottom]
  );

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
          backgroundColor: isDark ? colors.background.dark : colors.background.light,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  return (
    <AppProviders>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: tabColors.active,
          tabBarInactiveTintColor: tabColors.inactive,
          tabBarStyle,
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
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
    </AppProviders>
  );
}
