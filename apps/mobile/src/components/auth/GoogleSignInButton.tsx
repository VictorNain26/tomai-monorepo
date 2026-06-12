/**
 * GoogleSignInButton - TomAI 2026
 *
 * Bouton OAuth Google isole avec separateur "ou" au-dessus.
 */

import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { GoogleIcon } from '@/components/icons/google-icon';

interface GoogleSignInButtonProps {
  onPress: () => void;
  isLoading: boolean;
}

export function GoogleSignInButton({
  onPress,
  isLoading,
}: GoogleSignInButtonProps) {
  return (
    <>
      <View className="my-6 flex-row items-center">
        <View className="h-px flex-1 bg-muted" />
        <Text variant="muted" className="px-4">
          ou
        </Text>
        <View className="h-px flex-1 bg-muted" />
      </View>

      <Button
        variant="outline"
        onPress={onPress}
        disabled={isLoading}
        accessibilityLabel="Continuer avec Google"
      >
        <GoogleIcon size={20} />
        <Text className="font-semibold">Continuer avec Google</Text>
      </Button>
    </>
  );
}
