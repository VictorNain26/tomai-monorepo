/**
 * Student Profile Info Screen
 *
 * Displays student's profile information (read-only).
 * School level and LV2 are managed by parents.
 */

import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  GraduationCap,
  Info,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { useUser } from '@/lib/auth';
import { useIconColors } from '@/hooks';
import { bgColors } from '@/lib/styles';

// ============================================================================
// CONSTANTS
// ============================================================================

const LEVEL_LABELS: Record<string, string> = {
  cp: 'CP',
  ce1: 'CE1',
  ce2: 'CE2',
  cm1: 'CM1',
  cm2: 'CM2',
  sixieme: '6ème',
  cinquieme: '5ème',
  quatrieme: '4ème',
  troisieme: '3ème',
  seconde: 'Seconde',
  premiere: 'Première',
  terminale: 'Terminale',
  // Legacy format support
  'primaire-cp': 'CP',
  'primaire-ce1': 'CE1',
  'primaire-ce2': 'CE2',
  'primaire-cm1': 'CM1',
  'primaire-cm2': 'CM2',
  'college-6': '6ème',
  'college-5': '5ème',
  'college-4': '4ème',
  'college-3': '3ème',
  'lycee-2nde': 'Seconde',
  'lycee-1ere': 'Première',
  'lycee-tle': 'Terminale',
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function ProfileInfoScreen() {
  const router = useRouter();
  const user = useUser();
  const iconColors = useIconColors();

  // Extract user data with type safety
  const schoolLevel = (user as { schoolLevel?: string })?.schoolLevel;

  const levelLabel = schoolLevel ? LEVEL_LABELS[schoolLevel] ?? schoolLevel : null;

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full"
          accessibilityLabel="Retour"
          accessibilityRole="button"
        >
          <ArrowLeft color={iconColors.foreground} size={24} />
        </TouchableOpacity>
        <Text variant="h3">Mon profil</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-6">
        {/* Profile Avatar */}
        <View className="mb-6 items-center">
          <View className="mb-4 h-24 w-24 items-center justify-center rounded-full" style={{ backgroundColor: bgColors.primary[10] }}>
            <Text className="text-4xl">
              {user?.name ? user.name.charAt(0).toUpperCase() : '👤'}
            </Text>
          </View>
          <Text variant="h2">{user?.name ?? 'Utilisateur'}</Text>
          {user?.email && <Text variant="muted">{user.email}</Text>}
        </View>

        {/* Profile Info */}
        <View className="mb-6">
          <Text className="mb-3 font-semibold">Informations scolaires</Text>
          <View className="rounded-xl bg-white dark:bg-slate-800">
            {/* School Level */}
            <View className="flex-row items-center justify-between px-4 py-4">
              <View className="flex-row items-center gap-3">
                <GraduationCap color={iconColors.foreground} size={20} />
                <Text>Niveau scolaire</Text>
              </View>
              <Text variant="muted">{levelLabel ?? 'Non défini'}</Text>
            </View>
          </View>
        </View>

        {/* Info Notice */}
        <View className="rounded-xl p-4" style={{ backgroundColor: bgColors.muted[50] }}>
          <View className="flex-row items-start gap-3">
            <Info color={iconColors.muted} size={20} />
            <View className="flex-1">
              <Text variant="muted" className="text-sm">
                Ces informations sont gérées par ton parent. Si tu as besoin de
                les modifier, demande-lui de mettre à jour ton profil.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
