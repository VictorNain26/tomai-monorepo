/**
 * Student Layout - TomAI 2026
 *
 * Simplified 3-tab navigation:
 * 1. Accueil - Pronote-centered dashboard with Tom access
 * 2. Révisions - Flashcards and learning
 * 3. Plus - Profile, settings, detailed Pronote views
 *
 * Chat is a full-screen modal accessed from dashboard, not a tab.
 *
 * Quick Switch 2026: Shows "Return to Parent" banner when in impersonation mode.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { View, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, BookOpen, Menu, ArrowLeft } from 'lucide-react-native';
import { useSession, useUser, useImpersonatedBy, restoreParentSession } from '@/lib/auth';
import { AppProviders } from '@/components/providers';
import { useTheme } from '@/hooks';
import { colors } from '@/lib/styles';
import { Text } from '@/components/ui/text';

// Base tab bar height (without safe area)
const TAB_BAR_HEIGHT = 56;
const TAB_BAR_PADDING_TOP = 8;

export default function StudentLayout() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const user = useUser();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Quick Switch: Check if this is an impersonated session
  const impersonatedBy = useImpersonatedBy();
  const isImpersonating = !!impersonatedBy;
  const [isRestoring, setIsRestoring] = useState(false);

  // Handle return to parent
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
            setIsRestoring(false);

            if (success) {
              router.replace('/(parent)/');
            } else {
              Alert.alert('Erreur', 'Impossible de restaurer la session parent');
            }
          },
        },
      ]
    );
  }, [router]);

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
            name="learning"
            options={{
              title: 'Révisions',
              tabBarIcon: ({ color, size }) => (
                <BookOpen color={color} size={size} />
              ),
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
          <Tabs.Screen name="chat" options={{ href: null }} />
          <Tabs.Screen name="deck" options={{ href: null }} />
          <Tabs.Screen name="pronote" options={{ href: null }} />
          <Tabs.Screen name="profile-info" options={{ href: null }} />
          <Tabs.Screen name="settings" options={{ href: null }} />
        </Tabs>
      </View>
    </AppProviders>
  );
}
