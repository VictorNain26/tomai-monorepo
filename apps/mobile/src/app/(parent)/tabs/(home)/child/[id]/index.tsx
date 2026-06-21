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
  BarChart3,
  BookOpen,
  Clock,
  Flame,
  ChevronRight,
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
import { computeAverageGrade, formatStudyTime, formatFrenchDate } from '@/lib/formatters';
import { bgColors } from '@/lib/styles';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// ============================================================================
// COMPONENT
// ============================================================================

export default function ChildDetailScreen() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
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

  const child = useMemo(() => children.find((c) => c.id === id), [children, id]);
  const childMetrics = useMemo(() => metrics.find((m) => m.studentId === id), [metrics, id]);
  const isMapped = id ? pronoteHook.resourceMappings[id] !== undefined : false;

  const average = useMemo(
    () => (isMapped ? computeAverageGrade(pronoteHook.grades) : null),
    [isMapped, pronoteHook.grades]
  );
  const recentGrades = useMemo(() => pronoteHook.grades.slice(0, 3), [pronoteHook.grades]);
  const upcomingHomework = useMemo(
    () => pronoteHook.homework.filter((h) => !h.done).slice(0, 3),
    [pronoteHook.homework]
  );
  const homeworkCount = useMemo(
    () => pronoteHook.homework.filter((h) => !h.done).length,
    [pronoteHook.homework]
  );

  const handleDeleteChild = async () => {
    if (!id) return;
    try {
      await deleteChild(id);
      setShowDeleteModal(false);
      toast.success('Succes', 'Le compte a ete supprime');
      router.replace('/(parent)/tabs/(home)');
    } catch (error) {
      toast.error('Erreur', error instanceof Error ? error.message : 'Impossible de supprimer');
    }
  };

  if (isLoadingChildren || !id) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="px-4 py-6">
          <Skeleton className="mb-4 h-40 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </View>
      </SafeAreaView>
    );
  }

  if (!child) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-destructive">Enfant non trouve</Text>
          <Button onPress={() => router.back()} className="mt-4">
            <Text className="text-primary-foreground">Retour</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const fullName = `${child.firstName} ${child.lastName}`;
  const levelLabel = getLevelLabel(child.schoolLevel);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero Header */}
        {/* Dégradé décoratif d'en-tête, volontairement theme-invariant : les icônes badge (#86efac, #fde68a) ci-dessous sont calibrées contre ces stops. */}
        <LinearGradient colors={['#2563eb', '#1d4ed8']} className="px-5 pb-6 pt-4">
          <View className="items-center">
            <Avatar fallback={fullName} size="xl" className="mb-3" />
            <Text className="text-xl font-bold text-white">{fullName}</Text>
            <Text className="mt-0.5 text-sm text-white/80">{levelLabel}</Text>
            <View className="mt-2 flex-row items-center gap-1 rounded-full bg-white/20 px-3 py-1">
              {isMapped ? (
                <>
                  {/* green-300 / amber-200: decorative badge icon always over primary gradient — theme-invariant */}
                  <CheckCircle2 color="#86efac" size={14} />
                  <Text className="text-xs font-medium text-white">Pronote</Text>
                </>
              ) : (
                <>
                  <Link2 color="#fde68a" size={14} />
                  <Text className="text-xs text-white">Non connecte</Text>
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
                <Text className="mt-1 text-lg font-bold">
                  {average !== null ? average.toFixed(1) : '—'}
                </Text>
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
                <Text className="mt-1 text-lg font-bold">
                  {formatStudyTime(childMetrics?.totalStudyTime ?? 0)}
                </Text>
                <Text variant="muted" className="text-[10px]">Cette sem.</Text>
              </View>
            </Card>
          </View>

          {/* Recent Grades */}
          {isMapped && recentGrades.length > 0 && (
            <Card>
              <View className="p-4">
                <View className="mb-3 flex-row items-center justify-between">
                  <Text className="font-semibold">Dernieres notes</Text>
                  <TouchableOpacity
                    onPress={() => router.push(`/(parent)/tabs/(home)/child/${id}/grades`)}
                    className="flex-row items-center gap-1"
                    accessibilityLabel="Voir toutes les notes"
                  >
                    <Text className="text-xs text-primary">Voir toutes</Text>
                    <ChevronRight color={colors.primary} size={14} />
                  </TouchableOpacity>
                </View>
                {recentGrades.map((grade, i) => (
                  <View
                    key={`grade-${i}`}
                    className={`flex-row items-center justify-between py-2 ${i < recentGrades.length - 1 ? 'border-b border-border' : ''}`}
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
                    onPress={() => router.push(`/(parent)/tabs/(home)/child/${id}/homework`)}
                    className="flex-row items-center gap-1"
                    accessibilityLabel="Voir tous les devoirs"
                  >
                    <Text className="text-xs text-primary">Voir tous</Text>
                    <ChevronRight color={colors.primary} size={14} />
                  </TouchableOpacity>
                </View>
                {upcomingHomework.map((hw, i) => (
                  <View
                    key={`hw-${i}`}
                    className={`py-2 ${i < upcomingHomework.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-medium">{hw.subject}</Text>
                      <Text variant="muted" className="text-xs">
                        {formatFrenchDate(hw.dueDate)}
                      </Text>
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
                  <View
                    className="mb-1 h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: bgColors.success[10] }}
                  >
                    <Clock color={colors.success} size={18} />
                  </View>
                  <Text className="font-bold">
                    {formatStudyTime(childMetrics?.totalStudyTime ?? 0)}
                  </Text>
                  <Text variant="muted" className="text-[10px]">Temps</Text>
                </View>
                <View className="flex-1 items-center">
                  <View
                    className="mb-1 h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: bgColors.primary[10] }}
                  >
                    <BookOpen color={colors.primary} size={18} />
                  </View>
                  <Text className="font-bold">{childMetrics?.totalSessions ?? 0}</Text>
                  <Text variant="muted" className="text-[10px]">Sessions</Text>
                </View>
                <View className="flex-1 items-center">
                  <View
                    className="mb-1 h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: bgColors.destructive[10] }}
                  >
                    <Flame color={colors.destructive} size={18} />
                  </View>
                  <Text className="font-bold">{childMetrics?.studyDays ?? 0}j</Text>
                  <Text variant="muted" className="text-[10px]">Serie</Text>
                </View>
              </View>

              {/* Weekly activity bar */}
              <View className="mt-4 flex-row items-center justify-between border-t border-border pt-3">
                {WEEKDAYS.map((day, i) => {
                  const isActive = i < (childMetrics?.studyDays ?? 0);
                  return (
                    <View key={`day-${i}`} className="items-center gap-1">
                      <View
                        className="h-3 w-3 rounded-full"
                        style={{
                          backgroundColor: isActive
                            ? colors.success
                            : colors.border,
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
            accessibilityLabel="Supprimer ce profil"
          >
            <Text className="text-sm text-destructive">Supprimer ce profil</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
