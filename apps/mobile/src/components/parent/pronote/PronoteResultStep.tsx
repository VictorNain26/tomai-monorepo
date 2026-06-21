/**
 * PronoteResultStep — final step of the Pronote onboarding wizard.
 *
 * Shows:
 *  - Activated children (with logins to hand to the child)
 *  - Failed children (with reason + retry button for the failed subset)
 *  - "Terminer" button when no failures remain
 */

import { View, ScrollView } from 'react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { ChildAccessSelection, DiscoveredChild } from '@/hooks/usePronoteConnect';
import type { AccessForm } from './pronote-connect-types';

// ============================================================================
// TYPES
// ============================================================================

export interface PronoteResultStepProps {
  results: {
    activated: { resourceId: number; childId: string }[];
    failed: { resourceId: number; reason: string }[];
  };
  discovered: DiscoveredChild[];
  selections: ChildAccessSelection[];
  accessForms: Record<number, AccessForm>;
  onRetry: () => void;
  onDone: () => void;
  isPending: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PronoteResultStep({
  results,
  discovered,
  selections,
  accessForms,
  onRetry,
  onDone,
  isPending,
}: PronoteResultStepProps) {
  const colors = useThemeColors();

  const nameForResource = (resourceId: number): string => {
    const child = discovered.find((d) => d.resourceId === resourceId);
    if (!child) return `Enfant #${resourceId}`;
    return `${child.suggested.firstName} ${child.suggested.lastName}`;
  };

  const usernameForResource = (resourceId: number): string | undefined => {
    const sel = selections.find((s) => s.resourceId === resourceId);
    const form = accessForms[resourceId];
    return form?.username || sel?.username;
  };

  const hasActivated = results.activated.length > 0;
  const hasFailed = results.failed.length > 0;

  return (
    <ScrollView className="flex-1 px-4 py-5" showsVerticalScrollIndicator={false}>
      <Text className="mb-1 text-xl font-bold">
        {hasFailed && !hasActivated ? 'Activation incomplète' : 'Pronote connecté !'}
      </Text>
      <Text variant="muted" className="mb-5 text-sm">
        {hasFailed
          ? "Certains comptes n'ont pas pu être activés. Corrigez les erreurs et réessayez."
          : 'Les enfants peuvent maintenant utiliser TomAI avec Pronote.'}
      </Text>

      {/* Activated */}
      {hasActivated && (
        <View testID="result-activated-list" className="mb-4">
          <Text
            className="mb-2 text-sm font-semibold uppercase tracking-wide"
            style={{ color: colors.success }}
          >
            Activés ({results.activated.length})
          </Text>
          {results.activated.map(({ resourceId }) => {
            const login = usernameForResource(resourceId);
            return (
              <Card
                key={resourceId}
                className="mb-2 rounded-xl p-4"
                style={{ borderWidth: 1, borderColor: colors.success + '40' }}
                accessibilityLabel={`${nameForResource(resourceId)} activé`}
              >
                <Text className="font-semibold">{nameForResource(resourceId)}</Text>
                {login && (
                  <Text variant="muted" className="mt-0.5 text-xs">
                    Identifiant : {login}
                  </Text>
                )}
              </Card>
            );
          })}
        </View>
      )}

      {/* Failed */}
      {hasFailed && (
        <View testID="result-failed-list" className="mb-4">
          <Text
            className="mb-2 text-sm font-semibold uppercase tracking-wide"
            style={{ color: colors.destructive }}
          >
            Échecs ({results.failed.length})
          </Text>
          {results.failed.map(({ resourceId, reason }) => (
            <Card
              key={resourceId}
              className="mb-2 rounded-xl p-4"
              style={{ borderWidth: 1, borderColor: colors.destructive + '40' }}
              accessibilityLabel={`Échec pour ${nameForResource(resourceId)}: ${reason}`}
            >
              <Text className="font-semibold">{nameForResource(resourceId)}</Text>
              <Text variant="muted" className="mt-0.5 text-xs text-destructive">
                {reason}
              </Text>
            </Card>
          ))}

          <Button
            testID="result-retry-btn"
            onPress={onRetry}
            disabled={isPending}
            className="mt-3"
            accessibilityLabel="Réessayer les activations échouées"
          >
            <Text className="font-semibold text-primary-foreground">
              {isPending ? 'Réessai...' : 'Réessayer les échecs'}
            </Text>
          </Button>
        </View>
      )}

      {/* Done */}
      {!hasFailed && (
        <Button
          onPress={onDone}
          className="mt-4"
          accessibilityLabel="Terminer l'onboarding Pronote"
        >
          <Text className="font-semibold text-primary-foreground">Terminer</Text>
        </Button>
      )}
    </ScrollView>
  );
}
