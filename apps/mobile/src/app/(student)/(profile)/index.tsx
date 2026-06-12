/**
 * Student Profile Menu - TomAI 2026
 *
 * Central hub for all secondary features:
 * - Profile management
 * - Pronote detailed views
 * - Settings
 * - Help
 */

import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useRouter } from 'expo-router';
import {
  User,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  Crown,
  FileText,
  BarChart3,
  Calendar,
  School,
  UserCircle,
  FolderOpen,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { TokenUsageCard } from '@/components/dashboard';
import { useUser, useSession, signOut, hasParentSessionBackup, restoreParentSession } from '@/lib/auth';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useStudentDashboard, usePronote, useThemeColors } from '@/hooks';
import { bgColors, borderColors, shadows } from '@/lib/styles';
import { useEffect, useState } from 'react';

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

export default function StudentProfileScreen() {
  const router = useRouter();
  const toast = useToast();
  const user = useUser();
  const { refetch: refetchSession } = useSession();
  const { confirm, info } = useConfirm();
  const colors = useThemeColors();
  const { usage, isLoadingUsage } = useStudentDashboard();
  const pronote = usePronote(user?.id ?? '');

  // Check if parent session is available (launched from parent account)
  const [hasParentBackup, setHasParentBackup] = useState(false);
  const [isRestoringParent, setIsRestoringParent] = useState(false);

  useEffect(() => {
    let mounted = true;
    hasParentSessionBackup().then((v) => { if (mounted) setHasParentBackup(v); });
    return () => { mounted = false; };
  }, []);

  // Uses refetch() to sync React state after stopping impersonation
  // @see https://github.com/better-auth/better-auth/discussions/3860
  async function handleReturnToParent() {
    const confirmed = await confirm({
      title: 'Retour au compte parent',
      message: 'Voulez-vous revenir au compte parent ?',
      confirmLabel: 'Retour parent',
    });
    if (confirmed) {
      setIsRestoringParent(true);
      const restored = await restoreParentSession();
      if (restored) {
        await refetchSession();
        router.replace('/(parent)/');
      } else {
        toast.error('Erreur', 'Impossible de restaurer la session parent');
      }
      setIsRestoringParent(false);
    }
  }

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

  // Menu sections - updated paths for new structure
  const sections: MenuSection[] = [
    // Pronote section
    ...(pronote.isConnected
      ? [
          {
            title: 'Pronote',
            items: [
              {
                icon: <FileText color={colors.primary} size={20} />,
                label: 'Devoirs',
                sublabel: `${pronote.upcomingHomework} en attente`,
                onPress: () => router.push('/(student)/(profile)/pronote/homework'),
                showChevron: true,
              },
              {
                icon: <BarChart3 color={colors.primary} size={20} />,
                label: 'Notes',
                sublabel: pronote.averageGrade
                  ? `Moyenne: ${pronote.averageGrade.toFixed(1)}/20`
                  : undefined,
                onPress: () => router.push('/(student)/(profile)/pronote/grades'),
                showChevron: true,
              },
              {
                icon: <Calendar color={colors.primary} size={20} />,
                label: 'Emploi du temps',
                onPress: () => router.push('/(student)/(profile)/pronote/timetable'),
                showChevron: true,
              },
            ],
          },
        ]
      : []),

    // Account section
    {
      title: 'Compte',
      items: [
        {
          icon: <User color={colors.foreground} size={20} />,
          label: 'Mon profil',
          onPress: () => router.push('/(student)/(profile)/info'),
          showChevron: true,
        },
        {
          icon: <FolderOpen color={colors.foreground} size={20} />,
          label: 'Mon Classeur',
          sublabel: 'Documents et fichiers',
          onPress: () => router.push('/(student)/(profile)/files'),
          showChevron: true,
        },
      ],
    },

    // Support section
    {
      title: 'Support',
      items: [
        {
          icon: <Settings color={colors.foreground} size={20} />,
          label: 'Paramètres',
          onPress: () => router.push('/(student)/(profile)/settings'),
          showChevron: true,
        },
        {
          icon: <HelpCircle color={colors.foreground} size={20} />,
          label: 'Aide et support',
          sublabel: 'Bientôt disponible',
          onPress: () => info('Aide', 'Pour toute question, contacte-nous à support@tomai.fr'),
          showChevron: true,
        },
      ],
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-900">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-5 gap-5"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text variant="h2">Profil</Text>

        {/* Profile Card */}
        <Card style={shadows.sm}>
          <View className="flex-row items-center gap-4 p-4">
            <View
              className="h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: bgColors.primary[10] }}
            >
              <Text className="text-2xl font-bold" style={{ color: colors.primary }}>
                {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
            <View className="flex-1">
              <Text variant="large">{user?.name ?? 'Élève'}</Text>
              {pronote.isConnected && pronote.resources[0]?.className && (
                <View className="mt-1 flex-row items-center gap-1">
                  <School color={colors.mutedForeground} size={14} />
                  <Text variant="muted">{pronote.resources[0].className}</Text>
                </View>
              )}
            </View>
            <View
              className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
              style={{ backgroundColor: bgColors.primary[10] }}
            >
              <Crown color={colors.primary} size={14} />
              <Text variant="tiny" className="font-medium" style={{ color: colors.primary }}>
                Gratuit
              </Text>
            </View>
          </View>
        </Card>

        {/* Token Usage */}
        <TokenUsageCard usage={usage} isLoading={isLoadingUsage} />

        {/* Menu Sections */}
        {sections.map((section) => (
          <View key={section.title}>
            <Text variant="small" className="mb-2 px-1 text-stone-600 dark:text-stone-400">
              {section.title}
            </Text>
            <Card style={shadows.sm}>
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  onPress={item.onPress}
                  className={`flex-row items-center justify-between px-4 py-3.5 ${
                    index !== section.items.length - 1 ? 'border-b border-stone-200 dark:border-stone-700' : ''
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
                  {item.rightElement ?? (
                    item.showChevron && (
                      <ChevronRight color={colors.mutedForeground} size={20} />
                    )
                  )}
                </TouchableOpacity>
              ))}
            </Card>
          </View>
        ))}

        {/* Return to Parent Button (only if launched from parent) */}
        {hasParentBackup && (
          <TouchableOpacity
            onPress={handleReturnToParent}
            disabled={isRestoringParent}
            className="flex-row items-center justify-center gap-2 rounded-xl border py-4"
            style={{
              borderColor: borderColors.primary[30],
              backgroundColor: bgColors.primary[5],
              opacity: isRestoringParent ? 0.6 : 1,
            }}
            activeOpacity={0.7}
            accessibilityLabel="Retour au compte parent"
            accessibilityRole="button"
          >
            <UserCircle color={colors.primary} size={20} />
            <Text className="font-semibold" style={{ color: colors.primary }}>
              {isRestoringParent ? 'Retour en cours...' : 'Retour au compte parent'}
            </Text>
          </TouchableOpacity>
        )}

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
          <Text className="font-semibold" style={{ color: colors.destructive }}>Se déconnecter</Text>
        </TouchableOpacity>

        {/* App Version */}
        <Text variant="muted" className="text-center">
          TomIA v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
