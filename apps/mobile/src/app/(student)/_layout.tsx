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
 *
 * Quick Switch: Shows "Return to Parent" banner when in impersonation mode.
 */

import { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, MessageCircle, BookOpen, User, ArrowLeft } from 'lucide-react-native';
import { useSession, useUser, useImpersonatedBy, restoreParentSession } from '@/lib/auth';
import { AppProviders } from '@/components/providers';
import { useThemeColors, useDueSummary } from '@/hooks';
import { useTabScreenOptions, useTabBarConfig } from '@/lib/navigation';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { setupPushNotifications } from '@/lib/notifications';

export default function StudentLayout() {
  const router = useRouter();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { data: session, isPending, refetch: refetchSession } = useSession();
  const user = useUser();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  // Due cards count for Learning tab badge
  const { data: dueSummary } = useDueSummary();
  const dueCount = dueSummary?.totalDue ?? 0;

  // Quick Switch: Check if this is an impersonated session
  const impersonatedBy = useImpersonatedBy();
  const isImpersonating = !!impersonatedBy;
  const [isRestoring, setIsRestoring] = useState(false);

  // Handle return to parent
  // Uses refetch() to sync React state after stopping impersonation
  // @see https://github.com/better-auth/better-auth/discussions/3860
  const handleReturnToParent = useCallback(async () => {
    const confirmed = await confirm({
      title: 'Retour au compte parent',
      message: 'Voulez-vous quitter la session élève ?',
    });
    if (confirmed) {
      setIsRestoring(true);
      const success = await restoreParentSession();

      if (success) {
        await refetchSession();
        router.replace('/(parent)/');
      } else {
        toast.error('Erreur', 'Impossible de restaurer la session parent');
      }
      setIsRestoring(false);
    }
  }, [router, toast, refetchSession, confirm]);

  // Shared tab bar config (colors + style)
  const { tabColors, tabBarStyle } = useTabBarConfig();

  // Shared tab animation/performance options (React Navigation 7)
  const tabOptions = useTabScreenOptions(tabColors.background);

  // Push notification registration (once, non-blocking)
  useEffect(() => {
    if (!session?.user || isImpersonating) return;
    void setupPushNotifications();
  }, [session?.user, isImpersonating]);

  useEffect(() => {
    if (isPending) return;

    if (!session?.user) {
      router.replace('/(auth)/login');
    } else if (user?.role !== 'student') {
      // Don't redirect if impersonating - parent viewing as student
      if (!isImpersonating) {
        router.replace('/(parent)/');
      }
    }
  }, [isPending, session, user, router, isImpersonating]);

  // Show loading while checking auth
  if (isPending || !session?.user || user?.role !== 'student') {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-stone-900">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <AppProviders>
      <View className="flex-1">
        {/* Quick Switch Banner - shown when parent is viewing as child */}
        {isImpersonating && (
          <TouchableOpacity
            onPress={handleReturnToParent}
            disabled={isRestoring}
            className="flex-row items-center justify-center gap-2 bg-primary dark:bg-blue-400 px-4 pb-2"
            style={{ paddingTop: insets.top + 4 }}
            accessibilityLabel="Retour au compte parent"
            accessibilityRole="button"
          >
            <ArrowLeft color={colors.primaryForeground} size={16} />
            <Text className="text-sm font-semibold text-white dark:text-stone-900">
              {isRestoring ? 'Retour en cours...' : 'Retour au compte parent'}
            </Text>
          </TouchableOpacity>
        )}

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
    </AppProviders>
  );
}
