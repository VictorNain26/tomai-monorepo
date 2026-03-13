/**
 * Child Detail Screen - TomAI 2026
 *
 * Hero header with gradient + stats band + grades + homework + activity.
 */

import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Play,
  BarChart3,
  BookOpen,
  Clock,
  Flame,
  ChevronRight,
  School,
  CheckCircle2,
  Link2,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/toast';
import { DeleteChildModal } from '@/components/parent';
import { useParentDashboard, useThemeColors, usePronote } from '@/hooks';
import { useUser } from '@/lib/auth';
import { getLevelLabel } from '@/constants/levels';
import { launchChildSession, useSession } from '@/lib/auth';
import { bgColors } from '@/lib/styles';
import type { PronoteGrade } from '@/services/pronote/pronote-types';

// ============================================================================
// HELPERS
// ============================================================================

function computeAverage(grades: PronoteGrade[]): number | null {
  const valid = grades.filter((g): g is PronoteGrade & { value: number } => g.value !== null && g.outOf > 0);
  if (valid.length === 0) return null;
  const normalized = valid.map((g) => (g.value / g.outOf) * 20);
  return normalized.reduce((sum, v) => sum + v, 0) / normalized.length;
}

function formatStudyTime(minutes: number): string {
  if (minutes === 0) return '0min';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h${String(mins).padStart(2, '0')}` : `${hours}h`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// ============================================================================
// COMPONENT
// ============================================================================

export default function ChildDetailScreen() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refetch: refetchSession } = useSession();
  const colors = useThemeColors();

  const {
    children,
    metrics,
    isLoading: isLoadingChildren,
    deleteChild,
    isDeleting,
  } = useParentDashboard();

  const user = useUser();
  const pronoteHook = usePronote(user?.id ?? '');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  const child = useMemo(() => children.find((c) => c.id === id), [children, id]);
  const childMetrics = useMemo(() => metrics.find((m) => m.studentId === id), [metrics, id]);
  const isMapped = id ? pronoteHook.resourceMappings[id] !== undefined : false;

  // Pronote data
  const average = useMemo(() => isMapped ? computeAverage(pronoteHook.grades) : null, [isMapped, pronoteHook.grades]);
  const recentGrades = useMemo(() => pronoteHook.grades.slice(0, 3), [pronoteHook.grades]);
  const upcomingHomework = useMemo(
    () => pronoteHook.homework.filter((h) => !h.done).slice(0, 3),
    [pronoteHook.homework]
  );
  const homeworkCount = useMemo(() => pronoteHook.homework.filter((h) => !h.done).length, [pronoteHook.homework]);

  const handleDeleteChild = async () => {
    if (!id) return;
    try {
      await deleteChild(id);
      setShowDeleteModal(false);
      toast.success('Succes', 'Le compte a ete supprime');
      router.replace('/(parent)/(home)');
    } catch (error) {
      toast.error('Erreur', error instanceof Error ? error.message : 'Impossible de supprimer');
    }
  };

  const handleLaunchSession = async () => {
    if (!id || !child) return;
    setIsLaunching(true);
    const result = await launchChildSession(id);
    if (result.success) {
      await refetchSession();
      router.replace('/(student)');
    } else {
      toast.error('Erreur', result.error ?? 'Impossible de lancer la session');
    }
    setIsLaunching(false);
  };

  // Loading
  if (isLoadingChildren || !id) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
        <View className="px-4 py-6">
          <Skeleton className="mb-4 h-40 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </View>
      </SafeAreaView>
    );
  }

  if (!child) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-red-600 dark:text-red-400">Enfant non trouve</Text>
          <Button onPress={() => router.back()} className="mt-4">
            <Text className="text-white dark:text-slate-900">Retour</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const fullName = `${child.firstName} ${child.lastName}`;
  const levelLabel = getLevelLabel(child.schoolLevel);

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900" edges={['bottom']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero Header */}
        <LinearGradient
          colors={['#2563eb', '#1d4ed8']}
          className="px-5 pb-6 pt-4"
        >
          <View className="items-center">
            <Avatar fallback={fullName} size="xl" className="mb-3" />
            <Text className="text-xl font-bold text-white">{fullName}</Text>
            <Text className="mt-0.5 text-sm text-blue-200">{levelLabel}</Text>

            {/* Pronote badge */}
            <View className="mt-2 flex-row items-center gap-1 rounded-full bg-white/20 px-3 py-1">
              {isMapped ? (
                <>
                  <CheckCircle2 color="#86efac" size={14} />
                  <Text className="text-xs font-medium text-green-200">Pronote connecte</Text>
                </>
              ) : (
                <>
                  <Link2 color="#fde68a" size={14} />
                  <Text className="text-xs text-yellow-200">Pronote non connecte</Text>
                </>
              )}
            </View>
          </View>
        </LinearGradient>

        <View className="px-4 py-4 gap-4">
          {/* Stats Band */}
          <View className="flex-row gap-2">
            <Card style={{ flex: 1 }}>
              <View className="items-center p-3">
                <BarChart3 color={colors.primary} size={18} />
                <Text className="mt-1 text-lg font-bold">{average !== null ? average.toFixed(1) : '—'}</Text>
                <Text variant="muted" className="text-[10px]">Moyenne</Text>
              </View>
            </Card>
            <Card style={{ flex: 1 }}>
              <View className="items-center p-3">
                <BookOpen color={colors.warning} size={18} />
                <Text className="mt-1 text-lg font-bold">{homeworkCount}</Text>
                <Text variant="muted" className="text-[10px]">Devoirs</Text>
              </View>
            </Card>
            <Card style={{ flex: 1 }}>
              <View className="items-center p-3">
                <Clock color={colors.success} size={18} />
                <Text className="mt-1 text-lg font-bold">{formatStudyTime(childMetrics?.totalStudyTime ?? 0)}</Text>
                <Text variant="muted" className="text-[10px]">Cette sem.</Text>
              </View>
            </Card>
          </View>

          {/* Pronote not connected CTA */}
          {!pronoteHook.isConnected && (
            <Card>
              <View className="items-center p-5">
                <View className="mb-3 h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: bgColors.primary[10] }}>
                  <School color={colors.primary} size={24} />
                </View>
                <Text className="mb-1 font-semibold">Connecter Pronote</Text>
                <Text variant="muted" className="mb-3 text-center text-sm">
                  Synchronisez les notes et devoirs de {child.firstName}
                </Text>
                <Button onPress={() => router.push(`/(parent)/(home)/pronote-connect?childId=${id}`)}>
                  <Text className="font-medium text-white dark:text-slate-900">Connecter</Text>
                </Button>
              </View>
            </Card>
          )}

          {/* Recent Grades */}
          {isMapped && recentGrades.length > 0 && (
            <Card>
              <View className="p-4">
                <View className="mb-3 flex-row items-center justify-between">
                  <Text className="font-semibold">Dernieres notes</Text>
                  <TouchableOpacity
                    onPress={() => router.push(`/(parent)/(home)/child/${id}/grades`)}
                    className="flex-row items-center gap-1"
                  >
                    <Text className="text-xs text-blue-600 dark:text-blue-400">Voir toutes</Text>
                    <ChevronRight color={colors.primary} size={14} />
                  </TouchableOpacity>
                </View>
                {recentGrades.map((grade, i) => (
                  <View
                    key={`grade-${i}`}
                    className={`flex-row items-center justify-between py-2 ${i < recentGrades.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''}`}
                  >
                    <Text className="text-sm flex-1" numberOfLines={1}>{grade.subject}</Text>
                    <Text className="font-semibold text-sm">
                      {grade.value}/{grade.outOf}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* Upcoming Homework */}
          {isMapped && upcomingHomework.length > 0 && (
            <Card>
              <View className="p-4">
                <View className="mb-3 flex-row items-center justify-between">
                  <Text className="font-semibold">Devoirs a venir</Text>
                  <TouchableOpacity
                    onPress={() => router.push(`/(parent)/(home)/child/${id}/homework`)}
                    className="flex-row items-center gap-1"
                  >
                    <Text className="text-xs text-blue-600 dark:text-blue-400">Voir tous</Text>
                    <ChevronRight color={colors.primary} size={14} />
                  </TouchableOpacity>
                </View>
                {upcomingHomework.map((hw, i) => (
                  <View
                    key={`hw-${i}`}
                    className={`py-2 ${i < upcomingHomework.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''}`}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-medium">{hw.subject}</Text>
                      <Text variant="muted" className="text-xs">{formatDate(hw.dueDate)}</Text>
                    </View>
                    <Text variant="muted" className="text-xs mt-0.5" numberOfLines={1}>
                      {hw.description}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* Activity */}
          <Card>
            <View className="p-4">
              <Text className="mb-3 font-semibold">Activite Tom</Text>
              <View className="flex-row gap-4">
                <View className="flex-1 items-center">
                  <View className="mb-1 h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: bgColors.success[10] }}>
                    <Clock color={colors.success} size={18} />
                  </View>
                  <Text className="font-bold">{formatStudyTime(childMetrics?.totalStudyTime ?? 0)}</Text>
                  <Text variant="muted" className="text-[10px]">Temps</Text>
                </View>
                <View className="flex-1 items-center">
                  <View className="mb-1 h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: bgColors.primary[10] }}>
                    <BookOpen color={colors.primary} size={18} />
                  </View>
                  <Text className="font-bold">{childMetrics?.totalSessions ?? 0}</Text>
                  <Text variant="muted" className="text-[10px]">Sessions</Text>
                </View>
                <View className="flex-1 items-center">
                  <View className="mb-1 h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: bgColors.destructive[10] }}>
                    <Flame color={colors.destructive} size={18} />
                  </View>
                  <Text className="font-bold">{childMetrics?.studyDays ?? 0}j</Text>
                  <Text variant="muted" className="text-[10px]">Serie</Text>
                </View>
              </View>

              {/* Weekly activity bar */}
              <View className="mt-4 flex-row items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-3">
                {WEEKDAYS.map((day, i) => {
                  const isActive = i < (childMetrics?.studyDays ?? 0);
                  return (
                    <View key={`day-${i}`} className="items-center gap-1">
                      <View
                        className="h-3 w-3 rounded-full"
                        style={{
                          backgroundColor: isActive ? colors.success : 'rgba(107, 114, 128, 0.2)',
                        }}
                      />
                      <Text variant="muted" className="text-[9px]">{day}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </Card>

          {/* Delete (subtle link) */}
          <TouchableOpacity
            onPress={() => setShowDeleteModal(true)}
            className="items-center py-3"
          >
            <Text className="text-sm text-red-500 dark:text-red-400">Supprimer ce profil</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Sticky Launch Tom button */}
      <View className="border-t border-slate-200 dark:border-slate-700 px-5 py-3">
        <Button
          onPress={handleLaunchSession}
          disabled={isLaunching}
          className="flex-row items-center justify-center gap-2"
          style={{ backgroundColor: colors.success, opacity: isLaunching ? 0.6 : 1 }}
        >
          <Play color="#fff" size={18} />
          <Text className="font-semibold text-white">
            {isLaunching ? 'Lancement...' : `Lancer Tom pour ${child.firstName}`}
          </Text>
        </Button>
      </View>

      <DeleteChildModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteChild}
        childName={child.firstName}
        childUsername={child.username}
        isDeleting={isDeleting}
      />
    </SafeAreaView>
  );
}
