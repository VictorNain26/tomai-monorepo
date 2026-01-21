/**
 * Children Management Screen
 *
 * Full list of children with CRUD operations.
 */

import { View, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, User, Mail } from 'lucide-react-native';
import { useState, useCallback } from 'react';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChildCard, CreateChildModal } from '@/components/parent';
import { useParentDashboard, type IChild, type ICreateChildData } from '@/hooks';

// ============================================================================
// COMPONENT
// ============================================================================

export default function ChildrenScreen() {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    children,
    childrenCount,
    levels,
    isLoadingChildren,
    isCreating,
    createChild,
    refresh,
  } = useParentDashboard();

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    refresh();
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
  if (isLoadingChildren) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView className="flex-1 px-4 py-6">
          <View className="mb-6 flex-row items-center justify-between">
            <View>
              <Skeleton className="mb-2 h-7 w-32 rounded" />
              <Skeleton className="h-4 w-48 rounded" />
            </View>
            <Skeleton className="h-10 w-10 rounded-full" />
          </View>
          <View className="gap-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
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
        <View className="mb-6 flex-row items-center justify-between">
          <View>
            <Text variant="h2" className="text-primary">
              Mes enfants
            </Text>
            <Text variant="muted" className="mt-1">
              {childrenCount} {childrenCount === 1 ? 'compte' : 'comptes'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowCreateModal(true)}
            className="h-10 w-10 items-center justify-center rounded-full bg-primary"
            activeOpacity={0.7}
          >
            <Plus color="hsl(210, 40%, 98%)" size={20} />
          </TouchableOpacity>
        </View>

        {/* Children List */}
        {children.length > 0 ? (
          <View className="gap-3">
            {children.map((child) => (
              <ChildCard
                key={child.id}
                child={child}
                onPress={handleChildPress}
              />
            ))}
          </View>
        ) : (
          /* Empty State */
          <View className="rounded-xl border border-border bg-card p-8">
            <View className="items-center">
              <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-muted">
                <User color="hsl(215.4, 16.3%, 46.9%)" size={40} />
              </View>
              <Text variant="h3" className="text-center">
                Aucun enfant inscrit
              </Text>
              <Text variant="muted" className="mt-2 text-center">
                Ajoutez vos enfants pour suivre leur progression et gérer leur
                apprentissage.
              </Text>
              <Button onPress={() => setShowCreateModal(true)} className="mt-6">
                <View className="flex-row items-center gap-2">
                  <Plus color="hsl(210, 40%, 98%)" size={18} />
                  <Text className="font-semibold text-primary-foreground">
                    Ajouter un enfant
                  </Text>
                </View>
              </Button>
            </View>
          </View>
        )}

        {/* Invite Section */}
        <View className="mt-6 rounded-xl border border-border bg-muted/50 p-4">
          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Mail color="hsl(222.2, 47.4%, 11.2%)" size={20} />
            </View>
            <View className="flex-1">
              <Text className="font-semibold">Inviter par email</Text>
              <Text variant="muted" className="mt-1 text-sm">
                Envoyez une invitation à votre enfant pour qu'il crée son compte
                et le lie à votre espace parent.
              </Text>
              <TouchableOpacity className="mt-3">
                <Text className="font-semibold text-primary">
                  Bientôt disponible →
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Help Section */}
        <View className="mt-6 rounded-xl border border-border bg-card p-4">
          <Text variant="h4" className="mb-2">
            Comment ça marche ?
          </Text>
          <View className="gap-2">
            <View className="flex-row gap-2">
              <Text className="text-primary">1.</Text>
              <Text variant="muted" className="flex-1 text-sm">
                Créez un compte pour votre enfant avec un nom d'utilisateur
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Text className="text-primary">2.</Text>
              <Text variant="muted" className="flex-1 text-sm">
                Votre enfant se connecte avec ses identifiants pour utiliser Tom
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Text className="text-primary">3.</Text>
              <Text variant="muted" className="flex-1 text-sm">
                Suivez sa progression depuis votre tableau de bord
              </Text>
            </View>
          </View>
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
