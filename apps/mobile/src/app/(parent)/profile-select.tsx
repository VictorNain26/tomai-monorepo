/**
 * Profile Selection - TomAI 2026
 *
 * Netflix-like profile grid. Parent + children profiles.
 * - Redirects to onboarding if 0 children
 * - Child tap -> PIN verify -> launchChildSession -> Stack.Protected flips to (student)
 * - Parent tap -> PIN verify -> router.push('/(parent)/tabs')
 * - First visit: forces parent PIN setup
 */

import { useState, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { ProfileCard } from '@/components/parent/ProfileCard';
import { PinPrompt } from '@/components/parent/PinPrompt';
import { useParentDashboard, useThemeColors } from '@/hooks';
import { useChildAccessStore } from '@/stores/child-access-store';
import { launchChildSession, useSession } from '@/lib/auth';
import type { IChild } from '@/hooks';

// ============================================================================
// TYPES
// ============================================================================

type ScreenState =
  | { mode: 'grid' }
  | { mode: 'pin'; child: IChild }
  | { mode: 'pin-parent' }
  | { mode: 'setup-parent-pin' }
  | { mode: 'setup-parent-pin-confirm'; firstPin: string };

// ============================================================================
// SCREEN
// ============================================================================

export default function ProfileSelectScreen() {
  const { children, isLoading, userName } = useParentDashboard();
  const { refetch: refetchSession } = useSession();
  const router = useRouter();
  const colors = useThemeColors();

  const [state, setState] = useState<ScreenState>({ mode: 'grid' });
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  const {
    parentCredential,
    verifyCredential,
    verifyParentCredential,
    hasCredential,
    setParentCredential,
  } = useChildAccessStore();

  // -- Handlers ---------------------------------------------------------------

  const handleChildPress = useCallback(
    (child: IChild) => {
      if (!hasCredential(child.id)) {
        // Should not happen (PIN set during import), but handle gracefully
        setError(`Aucun code configuré pour ${child.firstName}`);
        return;
      }
      setError(null);
      setState({ mode: 'pin', child });
    },
    [hasCredential],
  );

  const handleParentPress = useCallback(() => {
    setError(null);
    if (!parentCredential) {
      setState({ mode: 'setup-parent-pin' });
      return;
    }
    setState({ mode: 'pin-parent' });
  }, [parentCredential]);

  const handleCancel = useCallback(() => {
    setError(null);
    setState({ mode: 'grid' });
  }, []);

  const handleChildPinSubmit = useCallback(
    async (childId: string, value: string): Promise<boolean> => {
      const valid = await verifyCredential(childId, value);
      if (!valid) return false;

      setSwitching(true);
      const result = await launchChildSession(childId);
      if (!result.success) {
        setSwitching(false);
        setError(result.error ?? 'Erreur lors du changement de session');
        setState({ mode: 'grid' });
        return true; // PIN was correct, session switch failed
      }

      await refetchSession();
      // Stack.Protected handles navigation automatically
      return true;
    },
    [verifyCredential, refetchSession],
  );

  const handleParentPinSubmit = useCallback(
    async (value: string): Promise<boolean> => {
      const valid = await verifyParentCredential(value);
      if (!valid) return false;

      router.push('/(parent)/tabs');
      return true;
    },
    [verifyParentCredential, router],
  );

  const handleSetupPinSubmit = useCallback(
    async (value: string): Promise<boolean> => {
      // First step: store PIN and move to confirm
      setState({ mode: 'setup-parent-pin-confirm', firstPin: value });
      return true;
    },
    [],
  );

  const handleConfirmPinSubmit = useCallback(
    async (firstPin: string, value: string): Promise<boolean> => {
      if (value !== firstPin) return false;

      await setParentCredential(value);
      setState({ mode: 'grid' });
      return true;
    },
    [setParentCredential],
  );

  // -- Loading / Redirect -----------------------------------------------------

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-900 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (children.length === 0) {
    return <Redirect href="/(parent)/onboarding-pronote" />;
  }

  // -- Switching overlay ------------------------------------------------------

  if (switching) {
    return (
      <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-900 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="muted" className="mt-4">
          Changement de profil...
        </Text>
      </SafeAreaView>
    );
  }

  // -- PIN Prompt states ------------------------------------------------------

  if (state.mode === 'pin') {
    const credential = useChildAccessStore
      .getState()
      .credentials.find((c) => c.childId === state.child.id);

    return (
      <PinPrompt
        name={state.child.firstName}
        type={credential?.type ?? 'pin'}
        onSubmit={(value) => handleChildPinSubmit(state.child.id, value)}
        onCancel={handleCancel}
      />
    );
  }

  if (state.mode === 'pin-parent') {
    return (
      <PinPrompt
        name="Parent"
        type="pin"
        onSubmit={handleParentPinSubmit}
        onCancel={handleCancel}
      />
    );
  }

  if (state.mode === 'setup-parent-pin') {
    return (
      <PinPrompt
        name="nouveau code parent"
        type="pin"
        onSubmit={handleSetupPinSubmit}
        onCancel={handleCancel}
      />
    );
  }

  if (state.mode === 'setup-parent-pin-confirm') {
    return (
      <PinPrompt
        name="confirmation"
        type="pin"
        onSubmit={(value) =>
          handleConfirmPinSubmit(state.firstPin, value)
        }
        onCancel={handleCancel}
      />
    );
  }

  // -- Grid -------------------------------------------------------------------

  return (
    <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-900 items-center justify-center px-6">
      <Text variant="h2" className="mb-2">
        Qui utilise Tom ?
      </Text>
      <Text variant="muted" className="mb-10">
        Sélectionnez un profil pour continuer
      </Text>

      {error && (
        <Text className="mb-4 text-red-500 text-sm text-center">{error}</Text>
      )}

      <View className="flex-row flex-wrap justify-center gap-8">
        {children.map((child) => (
          <ProfileCard
            key={child.id}
            name={child.firstName}
            subtitle={child.schoolLevel ?? undefined}
            variant="child"
            onPress={() => handleChildPress(child)}
          />
        ))}

        <ProfileCard
          name={userName}
          subtitle="Espace parent"
          variant="parent"
          onPress={handleParentPress}
        />
      </View>
    </SafeAreaView>
  );
}
