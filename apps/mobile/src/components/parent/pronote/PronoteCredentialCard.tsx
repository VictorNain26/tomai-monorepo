/**
 * PronoteCredentialCard — one card per Pronote establishment.
 *
 * Shows: establishment name, child count, resync, delete actions,
 * and per-child reset-password buttons.
 */

import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { PronoteCredentialSummary } from '@/hooks/usePronoteManage';
import type { IChild } from '@/hooks/useParentDashboard';

// ============================================================================
// TYPES
// ============================================================================

interface Props {
  credential: PronoteCredentialSummary;
  pronoteChildren: IChild[];
  isResyncing: boolean;
  isDeleting: boolean;
  onResync: () => void;
  onDelete: () => void;
  onResetPassword: (childId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PronoteCredentialCard({
  credential,
  pronoteChildren,
  isResyncing,
  isDeleting,
  onResync,
  onDelete,
  onResetPassword,
}: Props) {
  const { credentialId, establishmentName, establishmentUrl, childCount } = credential;

  const displayName = establishmentName ?? new URL(establishmentUrl).hostname;

  return (
    <Card
      testID={`credential-card-${credentialId}`}
      className="mb-4 rounded-2xl p-4"
      accessibilityLabel={`Établissement ${displayName}`}
    >
      {/* Header */}
      <View className="mb-3 flex-row items-start justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-base font-semibold" numberOfLines={2}>
            {displayName}
          </Text>
          <Text
            variant="muted"
            className="mt-0.5 text-sm"
            testID={`child-count-${credentialId}`}
          >
            {childCount} enfant{childCount !== 1 ? 's' : ''}
          </Text>
        </View>

        <Button
          variant="destructive"
          size="sm"
          onPress={onDelete}
          disabled={isDeleting}
          testID={`delete-btn-${credentialId}`}
          accessibilityLabel={`Retirer l'établissement ${displayName}`}
        >
          <Text className="text-xs font-medium text-destructive-foreground">
            {isDeleting ? '...' : 'Retirer'}
          </Text>
        </Button>
      </View>

      {/* Resync */}
      <Button
        variant="outline"
        size="sm"
        onPress={onResync}
        disabled={isResyncing}
        testID={`resync-btn-${credentialId}`}
        accessibilityLabel={`Resynchroniser l'établissement ${displayName}`}
        className="mb-3"
      >
        <Text className="text-sm">
          {isResyncing ? 'Synchronisation...' : 'Resynchroniser les enfants'}
        </Text>
      </Button>

      {/* Per-child reset password */}
      {pronoteChildren.length > 0 && (
        <View className="border-t pt-3" accessibilityLabel="Réinitialisation des mots de passe">
          <Text variant="muted" className="mb-2 text-xs font-medium uppercase tracking-wide">
            Mots de passe
          </Text>
          {pronoteChildren.map((child) => (
            <View
              key={child.id}
              className="flex-row items-center justify-between py-1.5"
            >
              <Text className="flex-1 text-sm">
                {child.firstName} {child.lastName}
              </Text>
              <Button
                variant="ghost"
                size="sm"
                onPress={() => onResetPassword(child.id)}
                testID={`reset-pwd-btn-${child.id}`}
                accessibilityLabel={`Réinitialiser le mot de passe de ${child.firstName}`}
              >
                <Text className="text-xs text-primary">Changer mdp</Text>
              </Button>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}
