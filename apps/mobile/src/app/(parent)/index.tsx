/**
 * Parent Dashboard Screen - TomAI 2026
 *
 * Overview for parents: children list with Pronote status and stats.
 */

import { useState, useCallback } from 'react';
import { View, ScrollView, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Users,
  Plus,
  Clock,
  BookOpen,
  TrendingUp,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChildCard, CreateChildModal } from '@/components/parent';
import { useParentDashboard, useIconColors, type IChild, type ICreateChildData } from '@/hooks';
import { useChildMappings } from '@/hooks/useParentPronote';
import { bgColors, colors, shadows } from '@/lib/styles';

// ============================================================================
// HELPERS
// ============================================================================

function formatStudyTime(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ParentDashboard() {
  const router = useRouter();
  const iconColors = useIconColors();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    children,
    childrenCount,
    totalSessions,
    totalStudyTime,
    activeChildren,
    levels,
    isLoading,
    isCreating,
    userName,
    createChild,
    refresh,
  } = useParentDashboard();

  // Fetch Pronote mappings to show status on child cards
  const { data: pronoteMappings } = useChildMappings();
  const hasPronoteFor = useCallback(
    (childId: string) => pronoteMappings?.some((m) => m.childId === childId) ?? false,
    [pronoteMappings]
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [refresh]);

  const handleChildPress = (child: IChild) => {
    router.push(`/(parent)/child/${child.id}`);
  };

  const handleCreateChild = useCallback(
    async (data: ICreateChildData) => {
      try {
        await createChild(data);
        setShowCreateModal(false);
        Alert.alert('Succès', `${data.firstName} peut maintenant utiliser Tom !`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Erreur lors de la création';
        Alert.alert('Erreur', message);
      }
    },
    [createChild]
  );

  // Loading skeleton
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView className="flex-1" contentContainerClassName="px-4 py-5 gap-4">
          <Skeleton className="h-8 w-48 rounded" />
          <Skeleton className="h-4 w-64 rounded" />
          <View className="flex-row gap-3">
            <Skeleton className="h-24 flex-1 rounded-xl" />
            <Skeleton className="h-24 flex-1 rounded-xl" />
          </View>
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-5 gap-5"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary.DEFAULT}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View>
          <Text variant="h2">Bonjour, {userName}</Text>
          <Text variant="muted" className="mt-1">
            Suivez la progression de vos enfants
          </Text>
        </View>

        {/* Stats Grid */}
        <View className="flex-row gap-3">
          <Card style={[shadows.xs, { flex: 1 }]}>
            <View className="p-4">
              <View
                className="mb-2 h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: bgColors.primary[10] }}
              >
                <Users color={colors.primary.DEFAULT} size={20} />
              </View>
              <Text variant="h3">{childrenCount}</Text>
              <Text variant="tiny" className="text-muted-foreground">
                {childrenCount === 1 ? 'Enfant' : 'Enfants'}
              </Text>
            </View>
          </Card>

          <Card style={[shadows.xs, { flex: 1 }]}>
            <View className="p-4">
              <View
                className="mb-2 h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: bgColors.success[10] }}
              >
                <TrendingUp color={colors.success.DEFAULT} size={20} />
              </View>
              <Text variant="h3">{activeChildren}</Text>
              <Text variant="tiny" className="text-muted-foreground">
                Actifs cette semaine
              </Text>
            </View>
          </Card>
        </View>

        <View className="flex-row gap-3">
          <Card style={[shadows.xs, { flex: 1 }]}>
            <View className="p-4">
              <View
                className="mb-2 h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: bgColors.warning[10] }}
              >
                <Clock color={colors.warning.DEFAULT} size={20} />
              </View>
              <Text variant="h3">{formatStudyTime(totalStudyTime)}</Text>
              <Text variant="tiny" className="text-muted-foreground">
                Temps total
              </Text>
            </View>
          </Card>

          <Card style={[shadows.xs, { flex: 1 }]}>
            <View className="p-4">
              <View
                className="mb-2 h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: bgColors.info[10] }}
              >
                <BookOpen color={colors.info.DEFAULT} size={20} />
              </View>
              <Text variant="h3">{totalSessions}</Text>
              <Text variant="tiny" className="text-muted-foreground">
                Sessions
              </Text>
            </View>
          </Card>
        </View>

        {/* Children Section */}
        <View>
          <View className="mb-3 flex-row items-center justify-between">
            <Text variant="large">Vos enfants</Text>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => setShowCreateModal(true)}
              className="flex-row items-center gap-1"
            >
              <Plus color={colors.primary.DEFAULT} size={16} />
              <Text variant="small" className="text-primary">
                Ajouter
              </Text>
            </Button>
          </View>

          {children.length > 0 ? (
            <View className="gap-3">
              {children.slice(0, 3).map((child) => (
                <ChildCard
                  key={child.id}
                  child={child}
                  hasPronote={hasPronoteFor(child.id)}
                  onPress={handleChildPress}
                />
              ))}
              {children.length > 3 && (
                <Button
                  variant="outline"
                  onPress={() => router.push('/(parent)/children')}
                >
                  Voir tous les {children.length} enfants
                </Button>
              )}
            </View>
          ) : (
            <Card style={shadows.sm}>
              <View className="items-center p-6">
                <View
                  className="mb-4 h-16 w-16 items-center justify-center rounded-full"
                  style={{ backgroundColor: bgColors.muted[50] }}
                >
                  <Users color={iconColors.muted} size={32} />
                </View>
                <Text variant="large" className="mb-1">
                  Aucun enfant
                </Text>
                <Text variant="muted" className="mb-4 text-center">
                  Ajoutez votre premier enfant pour commencer
                </Text>
                <Button onPress={() => setShowCreateModal(true)}>
                  <Plus color={colors.primary.foreground} size={18} />
                  <Text className="ml-2 text-primary-foreground font-medium">
                    Ajouter un enfant
                  </Text>
                </Button>
              </View>
            </Card>
          )}
        </View>

              </ScrollView>

      {/* Create Child Modal */}
      <CreateChildModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateChild}
        isSubmitting={isCreating}
        levels={levels}
      />
    </SafeAreaView>
  );
}
