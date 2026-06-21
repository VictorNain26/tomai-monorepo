/**
 * PronoteManageScreen — manage connected Pronote establishments.
 *
 * Actions per establishment:
 *   - Resync: discovers new children added to the establishment in Pronote.
 *   - Delete: removes the Pronote link. Child accounts are kept; they flip
 *     to hasPronote:false.
 *
 * Actions per child:
 *   - Reset password: PATCH /parent/children/:id { password }.
 *     New password must be re-shared with the child.
 *
 * Empty state: shows "Connecter Pronote" CTA.
 */

import { useState, useCallback } from 'react';
import { View, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';

import { SafeAreaView } from '@/components/ui/safe-area-view';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { usePronoteManage } from '@/hooks/usePronoteManage';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { useThemeColors } from '@/hooks/useThemeColors';
import { validatePassword } from '@/lib/child-credential-validators';
import { PronoteCredentialCard } from '@/components/parent/pronote/PronoteCredentialCard';

// ============================================================================
// RESET PASSWORD INLINE FORM
// ============================================================================

interface ResetPasswordFormProps {
  childId: string;
  childName: string;
  onSubmit: (childId: string, password: string) => Promise<void>;
  onCancel: () => void;
  colors: ReturnType<typeof useThemeColors>;
}

function ResetPasswordForm({
  childId,
  childName,
  onSubmit,
  onCancel,
  colors,
}: ResetPasswordFormProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = useCallback(async () => {
    const err = validatePassword(password);
    if (err) {
      setError(err);
      return;
    }
    setError(undefined);
    setIsPending(true);
    try {
      await onSubmit(childId, password);
    } finally {
      setIsPending(false);
    }
  }, [childId, password, onSubmit]);

  return (
    <View
      className="mt-2 rounded-xl p-4"
      style={{ backgroundColor: colors.mutedForeground + '20' }}
      accessibilityLabel={`Formulaire de réinitialisation pour ${childName}`}
    >
      <Text className="mb-2 text-sm font-medium">Nouveau mot de passe pour {childName}</Text>

      <TextInput
        testID="reset-pwd-input"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setError(undefined);
        }}
        secureTextEntry
        placeholder="Nouveau mot de passe"
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Nouveau mot de passe"
        style={{
          borderWidth: 1,
          borderColor: error ? colors.destructive : colors.border,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 14,
          color: colors.foreground,
          backgroundColor: colors.card,
          marginBottom: error ? 4 : 12,
          minHeight: 44,
        }}
      />

      {error && (
        <Text
          testID="reset-pwd-error"
          className="mb-3 text-xs text-destructive"
        >
          {error}
        </Text>
      )}

      <View className="flex-row gap-2">
        <Button
          variant="outline"
          size="sm"
          onPress={onCancel}
          disabled={isPending}
          accessibilityLabel="Annuler"
          className="flex-1"
        >
          <Text className="text-sm">Annuler</Text>
        </Button>
        <Button
          size="sm"
          onPress={handleSubmit}
          disabled={isPending}
          testID="reset-pwd-submit"
          accessibilityLabel="Confirmer le nouveau mot de passe"
          className="flex-1"
        >
          <Text className="text-sm font-medium text-primary-foreground">
            {isPending ? '...' : 'Confirmer'}
          </Text>
        </Button>
      </View>
    </View>
  );
}

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function PronoteManageScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { confirm } = useConfirm();
  const toast = useToast();

  const {
    credentials,
    pronoteChildren,
    isLoading,
    isError,
    resync,
    deleteCredential,
    resetChildPassword,
    resyncingId,
    deletingId,
  } = usePronoteManage();

  // Track which child's reset-password form is open
  const [activeResetChildId, setActiveResetChildId] = useState<string | null>(null);

  const handleResync = useCallback(async (credentialId: string) => {
    try {
      const result = await resync(credentialId);
      const addedCount = result.added.length;
      if (addedCount > 0) {
        toast.success(
          'Synchronisation terminée',
          `${addedCount} enfant${addedCount > 1 ? 's' : ''} ajouté${addedCount > 1 ? 's' : ''}`,
        );
      } else {
        toast.success('Synchronisation terminée', 'Liste d\'enfants à jour');
      }
    } catch {
      toast.error('Erreur', 'Impossible de resynchroniser. Réessayez.');
    }
  }, [resync, toast]);

  const handleDelete = useCallback(async (credentialId: string, name: string) => {
    const confirmed = await confirm({
      title: `Retirer ${name} ?`,
      message:
        'Le lien Pronote sera supprimé. Les comptes enfants sont conservés : ils pourront continuer à se connecter avec leurs identifiants.',
      confirmLabel: 'Retirer',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await deleteCredential(credentialId);
      toast.success('Établissement retiré', 'Les comptes enfants sont conservés.');
    } catch {
      toast.error('Erreur', 'Impossible de retirer l\'établissement. Réessayez.');
    }
  }, [confirm, deleteCredential, toast]);

  const handleResetPassword = useCallback(async (childId: string, password: string) => {
    await resetChildPassword(childId, password);
    setActiveResetChildId(null);
    toast.success(
      'Mot de passe mis à jour',
      'Partagez le nouveau mot de passe avec votre enfant.',
    );
  }, [resetChildPassword, toast]);

  // ── Loading / Error states ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text variant="muted">Chargement...</Text>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        <Text className="mb-4 text-center text-destructive">
          Impossible de charger les établissements Pronote.
        </Text>
        <Button variant="outline" onPress={() => router.back()}>
          <Text>Retour</Text>
        </Button>
      </SafeAreaView>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (credentials.length === 0) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        <Text variant="large" className="mb-2 text-center font-bold">
          Aucun établissement connecté
        </Text>
        <Text variant="muted" className="mb-6 text-center text-sm">
          Connectez Pronote pour importer automatiquement les devoirs et notes de vos enfants.
        </Text>
        <Button
          onPress={() => router.push('/(parent)/pronote-connect')}
          testID="empty-connect-cta"
          accessibilityLabel="Connecter Pronote"
        >
          <Text className="font-semibold text-primary-foreground">Connecter Pronote</Text>
        </Button>
      </SafeAreaView>
    );
  }

  // ── Main list ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1 px-4"
        contentContainerClassName="py-5"
        showsVerticalScrollIndicator={false}
      >
        <Text className="mb-1 text-lg font-bold">Établissements Pronote</Text>
        <Text variant="muted" className="mb-5 text-sm">
          Gérez les connexions Pronote de votre famille.
        </Text>

        {credentials.map((credential) => {
          const displayName =
            credential.establishmentName ??
            (() => {
              try {
                return new URL(credential.establishmentUrl).hostname;
              } catch {
                return credential.establishmentUrl;
              }
            })();

          const credentialChildren = pronoteChildren.filter(
            (c) => c.pronoteCredentialId === credential.credentialId,
          );

          return (
            <PronoteCredentialCard
              key={credential.credentialId}
              credential={credential}
              pronoteChildren={credentialChildren}
              isResyncing={resyncingId === credential.credentialId}
              isDeleting={deletingId === credential.credentialId}
              onResync={() => void handleResync(credential.credentialId)}
              onDelete={() => void handleDelete(credential.credentialId, displayName)}
              onResetPassword={(childId) => setActiveResetChildId(childId)}
            />
          );
        })}

        {activeResetChildId !== null &&
          pronoteChildren.some((c) => c.id === activeResetChildId) && (
            <Card className="mb-4 rounded-2xl p-4">
              <ResetPasswordForm
                childId={activeResetChildId}
                childName={
                  pronoteChildren.find((c) => c.id === activeResetChildId)?.firstName ?? ''
                }
                onSubmit={handleResetPassword}
                onCancel={() => setActiveResetChildId(null)}
                colors={colors}
              />
            </Card>
          )}

        {/* Add another establishment */}
        <Button
          variant="outline"
          onPress={() => router.push('/(parent)/pronote-connect')}
          accessibilityLabel="Connecter un autre établissement"
          className="mt-2"
        >
          <Text className="font-medium">+ Connecter un autre établissement</Text>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
