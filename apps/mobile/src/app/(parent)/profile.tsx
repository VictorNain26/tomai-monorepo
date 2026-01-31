/**
 * Parent Plus Menu - TomAI 2026
 *
 * Central hub for all secondary features:
 * - Subscription management
 * - Settings
 * - Help
 */

import { View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  Crown,
  CreditCard,
  Sparkles,
  Moon,
  Sun,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUser, signOut } from '@/lib/auth';
import { useIsPro, useTheme, useIconColors } from '@/hooks';
import { bgColors, borderColors, shadows, colors } from '@/lib/styles';

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
  rightElement?: React.ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ParentPlusScreen() {
  const router = useRouter();
  const user = useUser();
  const iconColors = useIconColors();
  const { isPro, isLoading: isLoadingPro } = useIsPro();
  const { isDark, toggleTheme } = useTheme();

  async function handleLogout() {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  // Menu sections
  const sections: MenuSection[] = [
    // Subscription section
    {
      title: 'Abonnement',
      items: [
        {
          icon: <CreditCard color={iconColors.primary} size={20} />,
          label: 'Gérer l\'abonnement',
          sublabel: isLoadingPro
            ? 'Chargement...'
            : isPro
              ? 'Plan Premium actif'
              : 'Plan Gratuit',
          onPress: () => router.push('/(parent)/pricing'),
          showChevron: true,
        },
      ],
    },

    // Preferences section
    {
      title: 'Préférences',
      items: [
        {
          icon: isDark ? (
            <Sun color={iconColors.foreground} size={20} />
          ) : (
            <Moon color={iconColors.foreground} size={20} />
          ),
          label: 'Mode sombre',
          onPress: toggleTheme,
          rightElement: (
            <View
              className="h-6 w-11 rounded-full p-0.5"
              style={{
                backgroundColor: isDark ? colors.primary.DEFAULT : colors.muted.DEFAULT,
              }}
            >
              <View
                className="h-5 w-5 rounded-full bg-white"
                style={{
                  transform: [{ translateX: isDark ? 20 : 0 }],
                }}
              />
            </View>
          ),
        },
        {
          icon: <Settings color={iconColors.foreground} size={20} />,
          label: 'Paramètres',
          sublabel: 'Notifications, confidentialité',
          onPress: () => router.push('/(parent)/settings'),
          showChevron: true,
        },
      ],
    },

    // Support section
    {
      title: 'Support',
      items: [
        {
          icon: <HelpCircle color={iconColors.foreground} size={20} />,
          label: 'Aide et support',
          onPress: () => {},
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
        <Text variant="h2">Plus</Text>

        {/* Profile Card */}
        <Card style={shadows.sm}>
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
                <Sparkles color={colors.success.DEFAULT} size={14} />
              ) : (
                <Crown color={iconColors.primary} size={14} />
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
          <Card
            style={[
              shadows.md,
              { borderWidth: 1, borderColor: colors.primary.DEFAULT },
            ]}
          >
            <View className="p-4">
              <View className="mb-2 flex-row items-center gap-2">
                <Sparkles color={colors.primary.DEFAULT} size={20} />
                <Text variant="large">Passez Premium</Text>
              </View>
              <Text variant="muted" className="mb-3">
                Accès illimité pour vos enfants, flashcards avancées et plus encore.
              </Text>
              <Button onPress={() => router.push('/(parent)/pricing')}>
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
            <Card style={shadows.sm}>
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  onPress={item.onPress}
                  className={`flex-row items-center justify-between px-4 py-3.5 ${
                    index !== section.items.length - 1 ? 'border-b border-border' : ''
                  }`}
                  activeOpacity={0.7}
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
                  {item.rightElement ?? (
                    item.showChevron && (
                      <ChevronRight color={iconColors.muted} size={20} />
                    )
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
        >
          <LogOut color={colors.destructive.DEFAULT} size={20} />
          <Text className="font-semibold text-destructive">Se déconnecter</Text>
        </TouchableOpacity>

        {/* App Version */}
        <Text variant="caption" className="text-center">
          TomIA v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
