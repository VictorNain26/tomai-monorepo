/**
 * Pronote Onboarding - TomAI 2026
 *
 * Shown on first login when parent has 0 children.
 * Full implementation in Task 8.
 */

import { Text } from '@/components/ui/text';
import { SafeAreaView } from '@/components/ui/safe-area-view';

export default function OnboardingPronoteScreen() {
  return (
    <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-900 items-center justify-center px-6">
      <Text variant="h2" className="text-center">Bienvenue !</Text>
      <Text variant="muted" className="mt-2 text-center">
        Pour commencer, connectons Pronote
      </Text>
      <Text variant="muted" className="mt-4 text-center text-xs">
        TomAI n'est pas affilie a Index Education.{'\n'}
        Vos donnees Pronote restent sur votre appareil.
      </Text>
    </SafeAreaView>
  );
}
