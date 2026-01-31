/**
 * Parent Layout - TomAI 2026
 *
 * 3-tab navigation for parents:
 * 1. Accueil - Dashboard with children stats
 * 2. Enfants - Child management
 * 3. Plus - Profile, subscription, settings
 */

import { useEffect, useMemo } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Users, Menu } from 'lucide-react-native';
import { useSession, useUser } from '@/lib/auth';
import { AppProviders } from '@/components/providers';
import { useTheme } from '@/hooks';
import { colors } from '@/lib/styles';

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
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
        }}
      >
        {/* Main tabs */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Accueil',
            tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="children"
          options={{
            title: 'Enfants',
            tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Plus',
            tabBarIcon: ({ color, size }) => <Menu color={color} size={size} />,
          }}
        />

        {/* Hidden screens - accessed via navigation, not tabs */}
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="pricing" options={{ href: null }} />
        <Tabs.Screen name="pronote-connect" options={{ href: null }} />
        <Tabs.Screen name="child" options={{ href: null }} />
      </Tabs>
    </AppProviders>
  );
}
