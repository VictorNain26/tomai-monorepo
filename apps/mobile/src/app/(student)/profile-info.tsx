/**
 * Student Profile Info Screen
 *
 * Displays student's profile information (read-only).
 * School level and LV2 are managed by parents.
 */

import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  GraduationCap,
  Globe,
  Info,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { useUser } from '@/lib/auth';
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

const LV2_LABELS: Record<string, string> = {
  espagnol: 'Espagnol',
  allemand: 'Allemand',
  italien: 'Italien',
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function ProfileInfoScreen() {
  const router = useRouter();
  const user = useUser();

  // Extract user data with type safety
  const schoolLevel = (user as { schoolLevel?: string })?.schoolLevel;
  const selectedLv2 = (user as { selectedLv2?: string })?.selectedLv2;

  const levelLabel = schoolLevel ? LEVEL_LABELS[schoolLevel] ?? schoolLevel : null;
  const lv2Label = selectedLv2 ? LV2_LABELS[selectedLv2] ?? selectedLv2 : null;

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <ArrowLeft color="hsl(222.2, 47.4%, 11.2%)" size={24} />
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
          <View className="rounded-xl border border-border bg-card">
            {/* School Level */}
            <View className="flex-row items-center justify-between border-b border-border px-4 py-4">
              <View className="flex-row items-center gap-3">
                <GraduationCap color="hsl(222.2, 47.4%, 11.2%)" size={20} />
                <Text>Niveau scolaire</Text>
              </View>
              <Text variant="muted">{levelLabel ?? 'Non défini'}</Text>
            </View>

            {/* LV2 */}
            <View className="flex-row items-center justify-between px-4 py-4">
              <View className="flex-row items-center gap-3">
                <Globe color="hsl(222.2, 47.4%, 11.2%)" size={20} />
                <Text>LV2</Text>
              </View>
              <Text variant="muted">{lv2Label ?? 'Non définie'}</Text>
            </View>
          </View>
        </View>

        {/* Info Notice */}
        <View className="rounded-xl p-4" style={{ backgroundColor: bgColors.muted[50] }}>
          <View className="flex-row items-start gap-3">
            <Info color="hsl(215.4, 16.3%, 46.9%)" size={20} />
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
