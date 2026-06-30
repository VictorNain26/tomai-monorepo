/**
 * Parent Tabs - TomAI 2026
 *
 * Bottom Tabs (Expo Router), aligned with the student layout so a single tab-bar
 * system is used across the app. React Navigation reserves the bottom safe-area
 * inset automatically (no overlap with the system navigation bar).
 */

import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Home, User } from 'lucide-react-native';
import { useTabBarConfig, useTabScreenOptions } from '@/lib/navigation';

export default function ParentTabsLayout() {
  const { tabColors, tabBarStyle } = useTabBarConfig();
  const tabOptions = useTabScreenOptions(tabColors.background);

  return (
    <View className="flex-1">
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
        <Tabs.Screen
          name="(home)"
          options={{
            title: 'Accueil',
            tabBarButtonTestID: 'parent-tab-home',
            tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="(profile)"
          options={{
            title: 'Profil',
            tabBarButtonTestID: 'parent-tab-profile',
            tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
          }}
        />
      </Tabs>
    </View>
  );
}
