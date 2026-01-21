/**
 * Parent Dashboard Screen
 *
 * Overview for parents: children count, stats, and quick actions.
 */

import { View, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Users, Plus, Clock, BookOpen } from 'lucide-react-native';
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChildCard, CreateChildModal } from '@/components/parent';
import { useParentDashboard, type IChild, type ICreateChildData } from '@/hooks';

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
  const [showCreateModal, setShowCreateModal] = useState(false);

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

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    refresh();
    // Small delay for UX
    setTimeout(() => setIsRefreshing(false), 500);
  }, [refresh]);

  const handleChildPress = (child: IChild) => {
    // Navigate to child details (Phase 6)
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
        <ScrollView className="flex-1 px-4 py-6">
          <Skeleton className="mb-2 h-8 w-48 rounded" />
          <Skeleton className="mb-6 h-4 w-64 rounded" />
          <Skeleton className="mb-4 h-14 w-full rounded-xl" />
          <Skeleton className="mb-4 h-14 w-full rounded-xl" />
          <View className="flex-row gap-3">
            <Skeleton className="h-24 flex-1 rounded-xl" />
            <Skeleton className="h-24 flex-1 rounded-xl" />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1 px-4 py-6"
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View className="mb-6">
          <Text variant="h2" className="text-primary">
            Bonjour, {userName} 👋
          </Text>
          <Text variant="muted" className="mt-1">
            Suivez la progression de vos enfants
          </Text>
        </View>

        {/* Quick Actions */}
        <View className="mb-6 gap-3">
          <Button
            onPress={() => router.push('/(parent)/children')}
            className="flex-row items-center justify-start gap-3 p-4"
          >
            <Users color="hsl(210, 40%, 98%)" size={24} />
            <View>
              <Text className="font-semibold text-primary-foreground">
                Gérer les comptes
              </Text>
              <Text className="text-sm text-primary-foreground/80">
                {childrenCount} {childrenCount === 1 ? 'enfant' : 'enfants'}
              </Text>
            </View>
          </Button>

          <Button
            variant="outline"
            onPress={() => setShowCreateModal(true)}
            className="flex-row items-center justify-start gap-3 p-4"
          >
            <Plus color="hsl(222.2, 47.4%, 11.2%)" size={24} />
            <View>
              <Text className="font-semibold">Ajouter un enfant</Text>
              <Text variant="muted" className="text-sm">
                Créer un nouveau compte élève
              </Text>
            </View>
          </Button>
        </View>

        {/* Stats Overview */}
        <Text variant="h3" className="mb-4">
          Vue d'ensemble
        </Text>
        <View className="mb-6 flex-row gap-3">
          <View className="flex-1 rounded-xl border border-border bg-card p-4">
            <View className="mb-2 h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Users color="hsl(222.2, 47.4%, 11.2%)" size={20} />
            </View>
            <Text variant="h3">{childrenCount}</Text>
            <Text variant="muted" className="text-sm">
              {childrenCount === 1 ? 'Enfant inscrit' : 'Enfants inscrits'}
            </Text>
          </View>

          <View className="flex-1 rounded-xl border border-border bg-card p-4">
            <View className="mb-2 h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Clock color="hsl(222.2, 47.4%, 11.2%)" size={20} />
            </View>
            <Text variant="h3">{formatStudyTime(totalStudyTime)}</Text>
            <Text variant="muted" className="text-sm">
              Temps total
            </Text>
          </View>
        </View>

        <View className="mb-6 flex-row gap-3">
          <View className="flex-1 rounded-xl border border-border bg-card p-4">
            <View className="mb-2 h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <BookOpen color="hsl(222.2, 47.4%, 11.2%)" size={20} />
            </View>
            <Text variant="h3">{totalSessions}</Text>
            <Text variant="muted" className="text-sm">
              Sessions totales
            </Text>
          </View>

          <View className="flex-1 rounded-xl border border-border bg-card p-4">
            <View className="mb-2 h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Users color="hsl(222.2, 47.4%, 11.2%)" size={20} />
            </View>
            <Text variant="h3">{activeChildren}</Text>
            <Text variant="muted" className="text-sm">
              Actifs cette semaine
            </Text>
          </View>
        </View>

        {/* Children List Preview */}
        <Text variant="h3" className="mb-4">
          Vos enfants
        </Text>

        {children.length > 0 ? (
          <View className="gap-3">
            {children.slice(0, 3).map((child) => (
              <ChildCard
                key={child.id}
                child={child}
                onPress={handleChildPress}
              />
            ))}
            {children.length > 3 && (
              <Button
                variant="ghost"
                onPress={() => router.push('/(parent)/children')}
              >
                <Text className="text-primary">
                  Voir tous les {children.length} enfants →
                </Text>
              </Button>
            )}
          </View>
        ) : (
          <View className="rounded-xl border border-border bg-card p-6">
            <View className="items-center">
              <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Users color="hsl(215.4, 16.3%, 46.9%)" size={32} />
              </View>
              <Text variant="muted" className="text-center">
                Aucun enfant inscrit pour le moment.
              </Text>
              <Button
                onPress={() => setShowCreateModal(true)}
                variant="outline"
                className="mt-4"
              >
                <Text className="font-semibold">Ajouter un enfant</Text>
              </Button>
            </View>
          </View>
        )}
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
