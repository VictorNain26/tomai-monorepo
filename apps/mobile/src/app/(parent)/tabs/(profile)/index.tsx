/**
 * Parent Profile Menu - TomAI 2026
 *
 * Central hub for all secondary features:
 * - Subscription management
 * - Settings
 * - Help
 */

import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useRouter } from 'expo-router';
import {
  Settings,
  School,
  LogOut,
  ChevronRight,
  Crown,
  CreditCard,
  Sparkles,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUser, signOut } from '@/lib/auth';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useIsPro, useThemeColors, usePronote } from '@/hooks';
import { bgColors, borderColors } from '@/lib/styles';

// ============================================================================
// TYPES
// ============================================================================

interface MenuSection {
  title: string;
  items: MenuItem[];
}

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onPress: () => void;
  showChevron?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ParentProfileScreen() {
  const router = useRouter();
  const user = useUser();
  const { confirm } = useConfirm();
  const colors = useThemeColors();
  const { isPro, isLoading: isLoadingPro } = useIsPro();
  const pronote = usePronote(user?.id ?? '');

  async function handleLogout() {
    const confirmed = await confirm({
      title: 'Déconnexion',
      message: 'Voulez-vous vraiment vous déconnecter ?',
      confirmLabel: 'Déconnexion',
      variant: 'destructive',
    });
    if (confirmed) {
      await signOut();
      router.replace('/(auth)/login');
    }
  }

  // Menu sections
  const sections: MenuSection[] = [
    // Subscription section
    {
      title: 'Abonnement',
      items: [
        {
          icon: <CreditCard color={colors.primary} size={20} />,
          label: 'Gérer l\'abonnement',
          sublabel: isLoadingPro
            ? 'Chargement...'
            : isPro
              ? 'Plan Premium actif'
              : 'Plan Gratuit',
          onPress: () => router.push('/(parent)/tabs/(profile)/pricing'),
          showChevron: true,
        },
      ],
    },

    // Pronote section
    {
      title: 'Pronote',
      items: [
        {
          icon: <School color={colors.foreground} size={20} />,
          label: 'Pronote',
          sublabel: pronote.isConnected ? 'Connecte' : 'Non connecte',
          onPress: () => router.push('/(parent)/tabs/(profile)/pronote-connect'),
          showChevron: true,
        },
      ],
    },

    // Preferences section
    {
      title: 'Preferences',
      items: [
        {
          icon: <Settings color={colors.foreground} size={20} />,
          label: 'Parametres',
          sublabel: 'Apparence',
          onPress: () => router.push('/(parent)/tabs/(profile)/settings'),
          showChevron: true,
        },
      ],
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-5 gap-5"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text variant="h2">Profil</Text>

        {/* Profile Card */}
        <Card>
          <View className="flex-row items-center gap-4 p-4">
            <View
              className="h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: bgColors.primary[10] }}
            >
              <Text className="text-2xl font-bold text-primary">
                {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
            <View className="flex-1">
              <Text variant="large">{user?.name ?? 'Parent'}</Text>
              <Text variant="muted">{user?.email ?? ''}</Text>
            </View>
            <View
              className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
              style={{
                backgroundColor: isPro ? bgColors.success[10] : bgColors.primary[10],
              }}
            >
              {isPro ? (
                <Sparkles color={colors.success} size={14} />
              ) : (
                <Crown color={colors.primary} size={14} />
              )}
              <Text
                variant="tiny"
                className={isPro ? 'text-success font-medium' : 'text-primary font-medium'}
              >
                {isPro ? 'Premium' : 'Gratuit'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Premium CTA (only for non-premium) */}
        {!isPro && !isLoadingPro && (
          <Card className="overflow-hidden">
            <View
              className="p-4"
              style={{ backgroundColor: colors.primary + '0F' /* 6% */ }}
            >
              <View className="mb-2 flex-row items-center gap-2">
                <Sparkles color={colors.primary} size={20} />
                <Text variant="large">Passez Premium</Text>
              </View>
              <Text variant="muted" className="mb-3">
                Accès illimité pour vos enfants, flashcards avancées et plus encore.
              </Text>
              <Button onPress={() => router.push('/(parent)/tabs/(profile)/pricing')}>
                Voir les offres
              </Button>
            </View>
          </Card>
        )}

        {/* Menu Sections */}
        {sections.map((section) => (
          <View key={section.title}>
            <Text variant="small" className="mb-2 px-1 text-muted-foreground">
              {section.title}
            </Text>
            <Card>
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  onPress={item.onPress}
                  className={`flex-row items-center justify-between px-4 py-3.5 ${
                    index !== section.items.length - 1 ? 'border-b border-border' : ''
                  }`}
                  activeOpacity={0.7}
                  accessibilityLabel={item.label}
                  accessibilityHint={item.sublabel}
                >
                  <View className="flex-row items-center gap-3 flex-1">
                    {item.icon}
                    <View>
                      <Text>{item.label}</Text>
                      {item.sublabel && (
                        <Text variant="tiny">{item.sublabel}</Text>
                      )}
                    </View>
                  </View>
                  {item.showChevron && (
                    <ChevronRight color={colors.mutedForeground} size={20} />
                  )}
                </TouchableOpacity>
              ))}
            </Card>
          </View>
        ))}

        {/* Logout Button */}
        <TouchableOpacity
          onPress={handleLogout}
          className="flex-row items-center justify-center gap-2 rounded-xl border py-4"
          style={{
            borderColor: borderColors.destructive[20],
            backgroundColor: bgColors.destructive[5],
          }}
          activeOpacity={0.7}
          accessibilityLabel="Se déconnecter"
          accessibilityRole="button"
        >
          <LogOut color={colors.destructive} size={20} />
          <Text className="font-semibold text-destructive">Se déconnecter</Text>
        </TouchableOpacity>

        {/* App Version */}
        <Text variant="muted" className="text-center">
          TomIA v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
