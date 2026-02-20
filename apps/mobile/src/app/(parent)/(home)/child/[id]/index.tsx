/**
 * Child Detail Screen
 *
 * Displays child profile and Pronote integration status.
 * Parent can connect Pronote and view homework/grades/timetable.
 */

import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, useCallback } from 'react';
import {
  ArrowLeft,
  School,
  CheckCircle,
  XCircle,
  RefreshCw,
  Calendar,
  FileText,
  BarChart3,
  GraduationCap,
  User,
  Edit3,
  Trash2,
  Play,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/toast';
import { DeleteChildModal, ChildUsageCard } from '@/components/parent';
import { useParentDashboard, useChildTokenUsage, useIconColors } from '@/hooks';
import { useChildPronote } from '@/hooks/useParentPronote';
import { getLevelLabel } from '@/constants/levels';
import { launchChildSession, useSession } from '@/lib/auth';
import { bgColors, borderColors, colors } from '@/lib/styles';

// ============================================================================
// COMPONENT
// ============================================================================

export default function ChildDetailScreen() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refetch: refetchSession } = useSession();

  const {
    children,
    isLoading: isLoadingChildren,
    deleteChild,
    isDeleting,
  } = useParentDashboard();
  const pronote = useChildPronote(id);
  const tokenUsage = useChildTokenUsage({ childId: id });
  const iconColors = useIconColors();

  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  // Find child by ID
  const child = useMemo(
    () => children.find((c) => c.id === id),
    [children, id]
  );

  // Delete child handler - must be defined before early returns
  const handleDeleteChild = useCallback(async () => {
    if (!id) return;
    try {
      await deleteChild(id);
      setShowDeleteModal(false);
      toast.success('Succès', 'Le compte a été supprimé');
      router.replace('/(parent)/(home)');
    } catch (error) {
      toast.error(
        'Erreur',
        error instanceof Error ? error.message : 'Impossible de supprimer le compte'
      );
    }
  }, [id, deleteChild, router, toast]);

  // Launch child session handler - direct launch without confirmation
  // Uses refetch() to sync React state after impersonation
  // @see https://github.com/better-auth/better-auth/discussions/3860
  const handleLaunchSession = useCallback(async () => {
    if (!id || !child) return;

    setIsLaunching(true);
    const result = await launchChildSession(id);

    if (result.success) {
      // Refresh session state before navigation
      await refetchSession();
      router.replace('/(student)/');
    } else {
      toast.error('Erreur', result.error ?? 'Impossible de lancer la session');
    }
    setIsLaunching(false);
  }, [id, child, router, toast, refetchSession]);

  // Loading state
  if (isLoadingChildren || !id) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-6 w-32 rounded" />
        </View>
        <ScrollView className="flex-1 px-4 py-6">
          <Skeleton className="mb-4 h-20 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Child not found
  if (!child) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-destructive">Enfant non trouvé</Text>
          <Button onPress={() => router.back()} className="mt-4">
            <Text className="text-primary-foreground">Retour</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const fullName = `${child.firstName} ${child.lastName}`;
  const levelLabel = getLevelLabel(child.schoolLevel);

  const handleConnectPronote = () => {
    // Navigate with childId to auto-show mapping selector after connection
    router.push(`/(parent)/(home)/pronote-connect?childId=${id}`);
  };

  const handleNavigatePronote = (section: 'grades' | 'homework' | 'timetable') => {
    if (!pronote.isMapped) {
      toast.warning(
        'Pronote non configuré',
        'Connectez d\'abord votre compte Pronote pour accéder aux données.'
      );
      return;
    }
    router.push(`/(parent)/(home)/child/${id}/${section}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full"
          accessibilityLabel="Retour"
          accessibilityRole="button"
        >
          <ArrowLeft color={iconColors.foreground} size={20} />
        </TouchableOpacity>
        <Avatar fallback={fullName} size="md" />
        <View className="flex-1">
          <Text className="font-semibold">{fullName}</Text>
          <Text variant="muted" className="text-sm">
            @{child.username}
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 py-6">
        {/* Child Info Card */}
        <View className="mb-6 rounded-xl border border-border bg-card p-4">
          <View className="flex-row items-center gap-3 border-b border-border pb-4">
            <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: bgColors.primary[10] }}>
              <User color={iconColors.foreground} size={24} />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-semibold">{fullName}</Text>
              <Text variant="muted">@{child.username}</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={() => router.push(`/(parent)/(home)/child/${id}/edit`)}
                className="p-2"
                accessibilityLabel="Modifier le profil"
                accessibilityRole="button"
              >
                <Edit3 color={iconColors.foreground} size={20} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowDeleteModal(true)}
                className="p-2"
                accessibilityLabel="Supprimer le compte"
                accessibilityRole="button"
              >
                <Trash2 color={iconColors.destructive} size={20} />
              </TouchableOpacity>
            </View>
          </View>

          <View className="mt-4 flex-row gap-4">
            <View className="flex-row items-center gap-2">
              <GraduationCap color={iconColors.muted} size={16} />
              <Text variant="muted">{levelLabel}</Text>
            </View>
          </View>
        </View>

        {/* Launch Tom Button */}
        <Button
          onPress={handleLaunchSession}
          disabled={isLaunching}
          className="mb-6 flex-row items-center justify-center gap-2"
          style={{
            backgroundColor: colors.success.DEFAULT,
            opacity: isLaunching ? 0.6 : 1,
          }}
        >
          <Play color={colors.primary.foreground} size={18} />
          <Text className="font-semibold text-primary-foreground">
            {isLaunching ? 'Lancement...' : `Lancer Tom pour ${child.firstName}`}
          </Text>
        </Button>

        {/* Token Usage Section */}
        <View className="mb-6">
          <ChildUsageCard
            window={tokenUsage.window}
            weekly={tokenUsage.weekly}
            plan={tokenUsage.plan}
            isLoading={tokenUsage.isLoading}
          />
        </View>

        {/* Pronote Section */}
        <View className="rounded-xl border border-border bg-card">
          <View className="flex-row items-center justify-between border-b border-border p-4">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: bgColors.primary[10] }}>
                <School color={iconColors.foreground} size={20} />
              </View>
              <View>
                <Text className="font-semibold">Pronote</Text>
                <Text variant="muted" className="text-sm">
                  Données scolaires officielles
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={pronote.refresh}
              disabled={pronote.isLoading}
              className="p-2"
              accessibilityLabel="Rafraîchir Pronote"
              accessibilityRole="button"
            >
              <RefreshCw
                color={iconColors.foreground}
                size={18}
                className={pronote.isLoading ? 'animate-spin' : ''}
              />
            </TouchableOpacity>
          </View>

          <View className="p-4">
            {pronote.isMapped && pronote.childMapping ? (
              <>
                {/* Connected state */}
                <View
                  className="mb-4 flex-row items-center gap-3 rounded-xl p-4"
                  style={{ backgroundColor: bgColors.success[10], borderWidth: 1, borderColor: borderColors.success[20] }}
                >
                  <CheckCircle color={colors.success.DEFAULT} size={20} />
                  <View className="flex-1">
                    <Text className="font-semibold" style={{ color: colors.success.DEFAULT }}>
                      {pronote.establishmentName ?? 'Établissement Pronote'}
                    </Text>
                    <Text className="text-sm" style={{ color: colors.success.DEFAULT }}>
                      Élève: {pronote.childMapping.pronoteChildName}
                      {pronote.childMapping.pronoteClassName &&
                        ` (${pronote.childMapping.pronoteClassName})`}
                    </Text>
                    {pronote.lastSyncAt && (
                      <Text className="mt-1 text-xs" style={{ color: colors.success.DEFAULT }}>
                        Synchronisé le{' '}
                        {new Date(pronote.lastSyncAt).toLocaleDateString('fr-FR')}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Quick actions */}
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => handleNavigatePronote('grades')}
                    className="flex-1 items-center rounded-xl border p-4"
                    style={{ borderColor: borderColors.primary[30] }}
                    accessibilityLabel="Voir les notes"
                  >
                    <BarChart3 color={iconColors.foreground} size={20} />
                    <Text className="mt-2 text-sm font-medium">Notes</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleNavigatePronote('timetable')}
                    className="flex-1 items-center rounded-xl border p-4"
                    style={{ borderColor: borderColors.primary[30] }}
                    accessibilityLabel="Voir l'emploi du temps"
                  >
                    <Calendar color={iconColors.foreground} size={20} />
                    <Text className="mt-2 text-sm font-medium">EDT</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleNavigatePronote('homework')}
                    className="flex-1 items-center rounded-xl border p-4"
                    style={{ borderColor: borderColors.primary[30] }}
                    accessibilityLabel="Voir les devoirs"
                  >
                    <FileText color={iconColors.foreground} size={20} />
                    <Text className="mt-2 text-sm font-medium">Devoirs</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* Not connected state */
              <View className="items-center py-4">
                <View className="mb-4 h-16 w-16 items-center justify-center rounded-xl" style={{ backgroundColor: bgColors.primary[10] }}>
                  <XCircle color={iconColors.foreground} size={32} />
                </View>
                <Text className="mb-2 text-center font-semibold">
                  {pronote.isConnected
                    ? 'Enfant non mappé à Pronote'
                    : 'Connexion Pronote requise'}
                </Text>
                <Text variant="muted" className="mb-4 text-center">
                  {pronote.isConnected
                    ? `Associez ${child.firstName} à un élève de votre compte Pronote.`
                    : `Connectez votre compte Pronote parent pour synchroniser les données.`}
                </Text>
                <Button onPress={handleConnectPronote}>
                  <Text className="font-semibold text-primary-foreground">
                    {pronote.isConnected ? 'Configurer le mapping' : 'Connecter Pronote'}
                  </Text>
                </Button>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Delete Child Modal */}
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
