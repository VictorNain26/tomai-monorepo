/**
 * ChildPage - Full-page swipeable content for one child.
 *
 * Avatar tappable → detail. Stats grid. Pronote CTA. Launch Tom.
 */

import { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BarChart3,
  BookOpen,
  Clock,
  Flame,
  CheckCircle2,
  Link2,
  ChevronRight,
  Play,
  School,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/toast';
import { useThemeColors } from '@/hooks';
import type { IChild } from '@/hooks/useParentDashboard';
import { getLevelLabel } from '@/constants/levels';
import { formatStudyTime } from '@/lib/formatters';
import { launchChildSession, useSession } from '@/lib/auth';
import { bgColors } from '@/lib/styles';

// ============================================================================
// TYPES
// ============================================================================

export interface ChildPageProps {
  child: IChild;
  hasPronote: boolean;
  isConnected: boolean;
  averageGrade: number | null;
  homeworkCount: number;
  studyTimeMinutes: number;
  streak: number;
  width: number;
  onViewDetail: (child: IChild) => void;
}

// ============================================================================
// PRONOTE BADGE (standardized across the app)
// ============================================================================

export function PronoteBadge({ connected }: { connected: boolean }) {
  const colors = useThemeColors();

  return (
    <View
      className="flex-row items-center gap-1.5 rounded-full px-3 py-1"
      style={{
        backgroundColor: connected ? bgColors.success[10] : bgColors.warning[10],
      }}
    >
      {connected ? (
        <>
          <CheckCircle2 color={colors.success} size={13} />
          <Text className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Pronote
          </Text>
        </>
      ) : (
        <>
          <Link2 color={colors.warning} size={13} />
          <Text className="text-xs" style={{ color: colors.warning }}>
            Non connecte
          </Text>
        </>
      )}
    </View>
  );
}

// ============================================================================
// STAT CARD (standardized across the app)
// ============================================================================

interface StatCardProps {
  icon: React.ReactNode;
  value: string;
  label: string;
}

function StatCard({ icon, value, label }: StatCardProps) {
  return (
    <Card style={{ flex: 1 }}>
      <View className="items-center p-3">
        {icon}
        <Text className="mt-1 text-lg font-bold">{value}</Text>
        <Text variant="muted" className="text-[10px]">{label}</Text>
      </View>
    </Card>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ChildPage({
  child,
  hasPronote,
  isConnected,
  averageGrade,
  homeworkCount,
  studyTimeMinutes,
  streak,
  width,
  onViewDetail,
}: ChildPageProps) {
  const colors = useThemeColors();
  const fullName = `${child.firstName} ${child.lastName}`;
  const levelLabel = getLevelLabel(child.schoolLevel);

  return (
    <ScrollView
      style={{ width }}
      contentContainerClassName="px-5 py-4 gap-4 pb-8"
      showsVerticalScrollIndicator={false}
    >
      {/* Profile header — tappable to view detail */}
      <TouchableOpacity
        onPress={() => onViewDetail(child)}
        activeOpacity={0.7}
        accessibilityLabel={`Voir le profil de ${child.firstName}`}
        accessibilityRole="button"
      >
        <View className="items-center">
          <Avatar fallback={fullName} size="xl" className="mb-2" />
          <Text className="text-xl font-bold">{fullName}</Text>
          <Text variant="muted" className="text-sm">{levelLabel}</Text>
          <View className="mt-2">
            <PronoteBadge connected={hasPronote} />
          </View>
          <View className="mt-2 flex-row items-center gap-1">
            <Text variant="muted" className="text-xs">Voir le profil</Text>
            <ChevronRight color={colors.foreground} size={12} style={{ opacity: 0.4 }} />
          </View>
        </View>
      </TouchableOpacity>

      {/* Stats grid 2x2 */}
      <View className="flex-row gap-2">
        <StatCard
          icon={<BarChart3 color={colors.primary} size={18} />}
          value={averageGrade !== null ? averageGrade.toFixed(1) : '—'}
          label="Moyenne"
        />
        <StatCard
          icon={<BookOpen color={colors.warning} size={18} />}
          value={String(homeworkCount)}
          label={homeworkCount !== 1 ? 'Devoirs' : 'Devoir'}
        />
      </View>
      <View className="flex-row gap-2">
        <StatCard
          icon={<Clock color={colors.success} size={18} />}
          value={formatStudyTime(studyTimeMinutes)}
          label="Cette sem."
        />
        <StatCard
          icon={<Flame color={colors.destructive} size={18} />}
          value={`${streak}j`}
          label="Serie"
        />
      </View>

      {/* Pronote CTA if not connected */}
      {!isConnected && (
        <PronoteCTA childId={child.id} childName={child.firstName} />
      )}

      {/* Launch Tom button */}
      <LaunchTomButton childId={child.id} childName={child.firstName} />
    </ScrollView>
  );
}

// ============================================================================
// PRONOTE CTA
// ============================================================================

function PronoteCTA({ childId, childName }: { childId: string; childName: string }) {
  const router = useRouter();
  const colors = useThemeColors();

  return (
    <Card>
      <View className="items-center p-5">
        <View
          className="mb-3 h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: bgColors.primary[10] }}
        >
          <School color={colors.primary} size={24} />
        </View>
        <Text className="mb-1 font-semibold">Connecter Pronote</Text>
        <Text variant="muted" className="mb-3 text-center text-sm">
          Synchronisez les notes et devoirs de {childName}
        </Text>
        <Button onPress={() => router.push(`/(parent)/(home)/pronote-connect?childId=${childId}`)}>
          <Text className="font-medium text-white dark:text-slate-900">Connecter</Text>
        </Button>
      </View>
    </Card>
  );
}

// ============================================================================
// LAUNCH TOM BUTTON
// ============================================================================

function LaunchTomButton({ childId, childName }: { childId: string; childName: string }) {
  const router = useRouter();
  const toast = useToast();
  const colors = useThemeColors();
  const { refetch: refetchSession } = useSession();
  const [isLaunching, setIsLaunching] = useState(false);

  const handleLaunch = async () => {
    setIsLaunching(true);
    const result = await launchChildSession(childId);
    if (result.success) {
      await refetchSession();
      router.replace('/(student)');
    } else {
      toast.error('Erreur', result.error ?? 'Impossible de lancer la session');
    }
    setIsLaunching(false);
  };

  return (
    <Button
      onPress={handleLaunch}
      disabled={isLaunching}
      accessibilityLabel={`Lancer Tom pour ${childName}`}
      className="flex-row items-center justify-center gap-2"
      style={{ backgroundColor: colors.success, opacity: isLaunching ? 0.6 : 1 }}
    >
      <Play color="#fff" size={18} />
      <Text className="font-semibold text-white">
        {isLaunching ? 'Lancement...' : `Lancer Tom pour ${childName}`}
      </Text>
    </Button>
  );
}
