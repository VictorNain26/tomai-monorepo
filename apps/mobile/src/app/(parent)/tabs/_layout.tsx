/**
 * Parent Tabs - TomAI 2026
 *
 * Swipeable tab navigation (Material Top Tabs at bottom position).
 */

import { withLayoutContext } from 'expo-router';
import { Home, User } from 'lucide-react-native';
import type { ParamListBase, TabNavigationState } from '@react-navigation/native';
import {
  createMaterialTopTabNavigator,
  type MaterialTopTabNavigationOptions,
  type MaterialTopTabNavigationEventMap,
} from '@react-navigation/material-top-tabs';
import { useSwipeableTabConfig } from '@/lib/navigation';

const { Navigator } = createMaterialTopTabNavigator();

const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

export default function ParentTabsLayout() {
  const swipeableOptions = useSwipeableTabConfig();

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
