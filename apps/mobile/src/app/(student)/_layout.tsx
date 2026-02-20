/**
 * Student Layout - TomAI 2026
 *
 * Optimized navigation structure with proper Stack navigators inside each tab.
 * Uses popToTopOnBlur to reset stacks when switching tabs (standard UX).
 *
 * Structure:
 * - (home)/    → Stack: Dashboard, Chat
 * - (learning)/ → Stack: Decks list, Create deck, Deck detail
 * - (profile)/ → Stack: Profile menu, Settings, Info, Pronote screens
 *
 * Quick Switch: Shows "Return to Parent" banner when in impersonation mode.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { View, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, BookOpen, User, ArrowLeft } from 'lucide-react-native';
import { useSession, useUser, useImpersonatedBy, restoreParentSession } from '@/lib/auth';
import { AppProviders } from '@/components/providers';
import { useTheme } from '@/hooks';
import { colors } from '@/lib/styles';
import { useTabScreenOptions } from '@/lib/navigation';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { setupPushNotifications } from '@/lib/notifications';

// Base tab bar height (without safe area)
const TAB_BAR_HEIGHT = 56;
const TAB_BAR_PADDING_TOP = 8;

export default function StudentLayout() {
  const router = useRouter();
  const toast = useToast();
  const { data: session, isPending, refetch: refetchSession } = useSession();
  const user = useUser();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Quick Switch: Check if this is an impersonated session
  const impersonatedBy = useImpersonatedBy();
  const isImpersonating = !!impersonatedBy;
  const [isRestoring, setIsRestoring] = useState(false);

  // Handle return to parent
  // Uses refetch() to sync React state after stopping impersonation
  // @see https://github.com/better-auth/better-auth/discussions/3860
  const handleReturnToParent = useCallback(async () => {
    Alert.alert(
      'Retour au compte parent',
      'Voulez-vous quitter la session élève ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setIsRestoring(true);
            const success = await restoreParentSession();

            if (success) {
              // Refresh session state before navigation
              await refetchSession();
              router.replace('/(parent)/');
            } else {
              toast.error('Erreur', 'Impossible de restaurer la session parent');
            }
            setIsRestoring(false);
          },
        },
      ]
    );
  }, [router, toast, refetchSession]);

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
      <View style={{ flex: 1 }}>
        {/* Quick Switch Banner - shown when parent is viewing as child */}
        {isImpersonating && (
          <TouchableOpacity
            onPress={handleReturnToParent}
            disabled={isRestoring}
            style={{
              backgroundColor: colors.primary.DEFAULT,
              paddingTop: insets.top + 4,
              paddingBottom: 8,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            accessibilityLabel="Retour au compte parent"
            accessibilityRole="button"
          >
            <ArrowLeft color={colors.primary.foreground} size={16} />
            <Text
              style={{
                color: colors.primary.foreground,
                fontWeight: '600',
                fontSize: 14,
              }}
            >
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
            tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
            popToTopOnBlur: true,
            ...tabOptions,
          }}
        >
          {/* Tab 1: Home (Dashboard + Chat) */}
          <Tabs.Screen
            name="(home)"
            options={{
              title: 'Accueil',
              tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
            }}
          />

          {/* Tab 2: Learning (Decks) */}
          <Tabs.Screen
            name="(learning)"
            options={{
              title: 'Révisions',
              tabBarIcon: ({ color, size }) => (
                <BookOpen color={color} size={size} />
              ),
            }}
          />

          {/* Tab 3: Profile (Settings, Pronote, etc.) */}
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
