/**
 * Profile Selection - TomAI 2026
 *
 * Netflix-like profile grid. Redirects to onboarding if 0 children.
 * Full implementation in Task 7.
 */

import { Redirect, useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useParentDashboard } from '@/hooks';
import { SafeAreaView } from '@/components/ui/safe-area-view';

export default function ProfileSelectScreen() {
  const { children, isLoading } = useParentDashboard();
  const router = useRouter();

  if (isLoading) return null;

  if (children.length === 0) {
    return <Redirect href="/(parent)/onboarding-pronote" />;
  }

  return (
    <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-900 items-center justify-center">
      <Text variant="h2">Qui utilise Tom ?</Text>
      <Text variant="muted" className="mt-2">{children.length} profil(s)</Text>
      <Button onPress={() => router.push('/(parent)/tabs')} className="mt-6">
        <Text className="text-white dark:text-stone-900">Continuer (placeholder)</Text>
      </Button>
    </SafeAreaView>
  );
}
