/**
 * Parent Layout - TomAI 2026
 *
 * Swipeable tab navigation (Material Top Tabs at bottom position).
 * Parent can swipe between Accueil and Profil like Instagram.
 *
 * Auth guards handled by Stack.Protected in root _layout.tsx.
 *
 * @see https://docs.expo.dev/versions/latest/sdk/router/#withlayoutcontext
 */

import { useEffect } from 'react';
import { withLayoutContext } from 'expo-router';
import { Home, User } from 'lucide-react-native';
import type { ParamListBase, TabNavigationState } from '@react-navigation/native';
import {
  createMaterialTopTabNavigator,
  type MaterialTopTabNavigationOptions,
  type MaterialTopTabNavigationEventMap,
} from '@react-navigation/material-top-tabs';
import { useSession } from '@/lib/auth';
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
  const { data: session } = useSession();
  const swipeableOptions = useSwipeableTabConfig();

  // Push notification registration (once, non-blocking)
  useEffect(() => {
    if (!session?.user) return;
    void setupPushNotifications();
  }, [session?.user]);

  return (
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
  );
}
