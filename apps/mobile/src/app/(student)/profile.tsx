/**
 * Student Plus Menu - TomAI 2026
 *
 * Central hub for all secondary features:
 * - Profile management
 * - Pronote detailed views
 * - Settings
 * - Help
 */

import { View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  Moon,
  Sun,
  UserCircle,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { useUser, signOut, hasParentSessionBackup, restoreParentSession } from '@/lib/auth';
import { useTheme, useStudentPronote, useIconColors } from '@/hooks';
import { bgColors, borderColors, shadows, colors } from '@/lib/styles';
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

export default function StudentPlusScreen() {
  const router = useRouter();
  const user = useUser();
  const iconColors = useIconColors();
  const { isDark, toggleTheme } = useTheme();
  const pronote = useStudentPronote();

  // Check if parent session is available (launched from parent account)
  const [hasParentBackup, setHasParentBackup] = useState(false);
  const [isRestoringParent, setIsRestoringParent] = useState(false);

  useEffect(() => {
    hasParentSessionBackup().then(setHasParentBackup);
  }, []);

  async function handleReturnToParent() {
    Alert.alert(
      'Retour au compte parent',
      'Voulez-vous revenir au compte parent ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retour parent',
          onPress: async () => {
            setIsRestoringParent(true);
            const restored = await restoreParentSession();
            if (restored) {
              router.replace('/(parent)/');
            } else {
              Alert.alert('Erreur', 'Impossible de restaurer la session parent');
            }
            setIsRestoringParent(false);
          },
        },
      ]
    );
  }

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
    // Pronote section (only if connected)
    ...(pronote.isConnected
      ? [
          {
            title: 'Pronote',
            items: [
              {
                icon: <FileText color={iconColors.primary} size={20} />,
                label: 'Devoirs',
                sublabel: `${pronote.upcomingHomework} en attente`,
                onPress: () => router.push('/(student)/pronote/homework'),
                showChevron: true,
              },
              {
                icon: <BarChart3 color={iconColors.primary} size={20} />,
                label: 'Notes',
                sublabel: pronote.averageGrade
                  ? `Moyenne: ${pronote.averageGrade.toFixed(1)}/20`
                  : undefined,
                onPress: () => router.push('/(student)/pronote/grades'),
                showChevron: true,
              },
              {
                icon: <Calendar color={iconColors.primary} size={20} />,
                label: 'Emploi du temps',
                onPress: () => router.push('/(student)/pronote/timetable'),
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
          icon: <User color={iconColors.foreground} size={20} />,
          label: 'Mon profil',
          onPress: () => router.push('/(student)/profile-info'),
          showChevron: true,
        },
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
      ],
    },

    // Support section
    {
      title: 'Support',
      items: [
        {
          icon: <Settings color={iconColors.foreground} size={20} />,
          label: 'Paramètres',
          onPress: () => router.push('/(student)/settings'),
          showChevron: true,
        },
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
              <Text variant="large">{user?.name ?? 'Élève'}</Text>
              {pronote.isConnected && pronote.className && (
                <View className="mt-1 flex-row items-center gap-1">
                  <School color={iconColors.muted} size={14} />
                  <Text variant="muted">{pronote.className}</Text>
                </View>
              )}
            </View>
            <View
              className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
              style={{ backgroundColor: bgColors.primary[10] }}
            >
              <Crown color={iconColors.primary} size={14} />
              <Text variant="tiny" className="text-primary font-medium">
                Gratuit
              </Text>
            </View>
          </View>
        </Card>

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
          >
            <UserCircle color={colors.primary.DEFAULT} size={20} />
            <Text className="font-semibold text-primary">
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
