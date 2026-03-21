/**
 * Parent Layout - TomAI 2026
 *
 * Swipeable tab navigation (Material Top Tabs at bottom position).
 * Parent can swipe between Accueil and Profil like Instagram.
 *
 * Uses withLayoutContext to integrate @react-navigation/material-top-tabs
 * with Expo Router file-based routing.
 *
 * @see https://docs.expo.dev/versions/latest/sdk/router/#withlayoutcontext
 *
 * Structure:
 * - (home)/    → Stack: Dashboard, Child screens
 * - (profile)/ → Stack: Profile menu, Settings, Pricing, Pronote
 */

import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { withLayoutContext } from 'expo-router';
import { Home, User } from 'lucide-react-native';
import type { ParamListBase, TabNavigationState } from '@react-navigation/native';
import {
  createMaterialTopTabNavigator,
  type MaterialTopTabNavigationOptions,
  type MaterialTopTabNavigationEventMap,
} from '@react-navigation/material-top-tabs';
import { useSession, useUser } from '@/lib/auth';
import { AppProviders } from '@/components/providers';
import { useThemeColors } from '@/hooks';
import { useSwipeableTabConfig } from '@/lib/navigation';
import { setupPushNotifications } from '@/lib/notifications';

const { Navigator } = createMaterialTopTabNavigator();

const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

export default function ParentLayout() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const user = useUser();
  const colors = useThemeColors();
  const swipeableOptions = useSwipeableTabConfig();

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
      <View className="flex-1 items-center justify-center bg-background dark:bg-stone-900">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <AppProviders>
        <MaterialTopTabs
          tabBarPosition="bottom"
          screenOptions={swipeableOptions}
        >
          <MaterialTopTabs.Screen
            name="(home)"
            options={{
              title: 'Accueil',
              tabBarIcon: ({ color }) => <Home color={color} size={22} />,
            }}
          />
          <MaterialTopTabs.Screen
            name="(profile)"
            options={{
              title: 'Profil',
              tabBarIcon: ({ color }) => <User color={color} size={22} />,
            }}
          />
        </MaterialTopTabs>
    </AppProviders>
  );
}
