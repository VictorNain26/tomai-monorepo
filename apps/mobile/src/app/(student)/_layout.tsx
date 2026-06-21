/**
 * Student Layout - TomAI 2026
 *
 * Optimized navigation structure with proper Stack navigators inside each tab.
 * Uses popToTopOnBlur to reset stacks when switching tabs (standard UX).
 *
 * Structure:
 * - (home)/    → Stack: Dashboard
 * - (chat)/    → Stack: Chat (Tom AI tutor)
 * - (learning)/ → Stack: Decks list, Create deck, Deck detail
 * - (profile)/ → Stack: Profile menu, Settings, Info, Pronote screens
 */

import { useEffect } from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Home, MessageCircle, BookOpen, User } from 'lucide-react-native';
import { useSession } from '@/lib/auth';
import { useThemeColors, useDueSummary } from '@/hooks';
import { useTabScreenOptions, useTabBarConfig } from '@/lib/navigation';
import { setupPushNotifications } from '@/lib/notifications';

export default function StudentLayout() {
  const { data: session } = useSession();
  const colors = useThemeColors();

  // Due cards count for Learning tab badge
  const { data: dueSummary } = useDueSummary();
  const dueCount = dueSummary?.totalDue ?? 0;

  // Shared tab bar config (colors + style)
  const { tabColors, tabBarStyle } = useTabBarConfig();

  // Shared tab animation/performance options (React Navigation 7)
  const tabOptions = useTabScreenOptions(tabColors.background);

  // Push notification registration (once, non-blocking)
  useEffect(() => {
    if (!session?.user) return;
    void setupPushNotifications();
  }, [session?.user]);

  // Auth guards handled by Stack.Protected in root _layout.tsx
  // No useEffect redirects needed here

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
          {/* Tab 1: Home (Dashboard) */}
          <Tabs.Screen
            name="(home)"
            options={{
              title: 'Accueil',
              tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
            }}
          />

          {/* Tab 2: Chat (Tom AI tutor) */}
          <Tabs.Screen
            name="(chat)"
            options={{
              title: 'Tom',
              tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />,
            }}
          />

          {/* Tab 3: Learning (Decks) */}
          <Tabs.Screen
            name="(learning)"
            options={{
              title: 'Révisions',
              tabBarIcon: ({ color, size }) => (
                <BookOpen color={color} size={size} />
              ),
              tabBarBadge: dueCount > 0 ? (dueCount > 99 ? '99+' : dueCount) : undefined,
              tabBarBadgeStyle: dueCount > 0 ? { backgroundColor: colors.warning, fontSize: 10 } : undefined,
            }}
          />

          {/* Tab 4: Profile (Settings, Pronote, etc.) */}
          <Tabs.Screen
            name="(profile)"
            options={{
              title: 'Profil',
              tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
            }}
          />
        </Tabs>
      </View>
  );
}
