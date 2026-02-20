/**
 * Feedback Components - TomAI 2026 Best Practices
 *
 * Standardized loading, error, and empty state components
 * with contextual messaging and accessibility support.
 */

import { View, ActivityIndicator, type ViewStyle } from 'react-native';
import { AlertCircle, RefreshCw } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useIconColors } from '@/hooks';
import { bgColors, borderColors, colors } from '@/lib/styles';

// ============================================================================
// LOADING STATE
// ============================================================================

interface LoadingStateProps {
  /** Contextual message describing what's loading */
  message?: string;
  /** Size of the spinner */
  size?: 'small' | 'large';
  /** Optional style override */
  style?: ViewStyle;
}

/**
 * LoadingState - Accessible loading indicator with context
 *
 * Usage:
 *   <LoadingState message="Chargement des devoirs..." />
 */
export function LoadingState({
  message = 'Chargement...',
  size = 'large',
  style,
}: LoadingStateProps) {
  return (
    <View
      style={[{ alignItems: 'center', justifyContent: 'center', padding: 24 }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator size={size} color={colors.primary.DEFAULT} />
      <Text variant="muted" className="mt-3 text-center">
        {message}
      </Text>
    </View>
  );
}

// ============================================================================
// ERROR STATE
// ============================================================================

type ErrorType = 'network' | 'auth' | 'server' | 'notFound' | 'generic';

interface ErrorStateProps {
  /** Error type for smart messaging */
  type?: ErrorType;
  /** Custom error message (overrides type-based message) */
  message?: string;
  /** Callback for retry action */
  onRetry?: () => void;
  /** Whether retry is in progress */
  isRetrying?: boolean;
  /** Optional style override */
  style?: ViewStyle;
}

const ERROR_MESSAGES: Record<ErrorType, { title: string; description: string }> = {
  network: {
    title: 'Connexion impossible',
    description: 'Vérifie ta connexion Internet et réessaie.',
  },
  auth: {
    title: 'Session expirée',
    description: 'Reconnecte-toi pour continuer.',
  },
  server: {
    title: 'Erreur serveur',
    description: 'Nous travaillons pour corriger le problème.',
  },
  notFound: {
    title: 'Contenu introuvable',
    description: 'Cette page n\'existe pas ou a été supprimée.',
  },
  generic: {
    title: 'Une erreur est survenue',
    description: 'Réessaie dans quelques instants.',
  },
};

/**
 * ErrorState - Accessible error display with retry action
 *
 * Usage:
 *   <ErrorState type="network" onRetry={refetch} />
 *   <ErrorState message="Email déjà utilisé" />
 */
export function ErrorState({
  type = 'generic',
  message,
  onRetry,
  isRetrying = false,
  style,
}: ErrorStateProps) {
  const iconColors = useIconColors();
  const errorInfo = ERROR_MESSAGES[type];

  return (
    <View
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          margin: 16,
          borderRadius: 12,
          backgroundColor: bgColors.destructive[5],
          borderWidth: 1,
          borderColor: borderColors.destructive[20],
        },
        style,
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: bgColors.destructive[15],
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        <AlertCircle color={colors.destructive.DEFAULT} size={24} />
      </View>

      <Text className="font-semibold text-center mb-1">
        {message ? 'Erreur' : errorInfo.title}
      </Text>
      <Text variant="muted" className="text-center mb-4">
        {message ?? errorInfo.description}
      </Text>

      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onPress={onRetry}
          isLoading={isRetrying}
          accessibilityLabel="Réessayer"
          accessibilityHint="Relance le chargement"
        >
          <RefreshCw color={iconColors.primary} size={16} />
          <Text className="ml-2 text-primary font-medium">Réessayer</Text>
        </Button>
      )}
    </View>
  );
}

// ============================================================================
// INLINE ERROR MESSAGE
// ============================================================================

interface InlineErrorProps {
  /** Error message */
  message: string;
  /** Optional style override */
  style?: ViewStyle;
}

/**
 * InlineError - Small error message for form fields
 *
 * Usage:
 *   <InlineError message="Ce champ est requis" />
 */
export function InlineError({ message, style }: InlineErrorProps) {
  return (
    <View
      style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }, style]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <AlertCircle color={colors.destructive.DEFAULT} size={14} />
      <Text variant="tiny" className="text-destructive">
        {message}
      </Text>
    </View>
  );
}
