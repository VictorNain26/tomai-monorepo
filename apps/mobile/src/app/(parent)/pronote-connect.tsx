/**
 * PronoteConnectScreen — server-driven Pronote onboarding wizard.
 *
 * Step flow (mirrors OnboardingStep from usePronoteConnect):
 *   intro → scan → pin → discovering → select → activating → result
 *
 * Hook contract points honored:
 *   1. goToScan() advances from intro to scan.
 *   2. setQrData(parsed) is called from the QR scan callback BEFORE the pin step
 *      is shown. submitPin no-ops when qrData is null — screen must set it first.
 *   3. existingChildId child → defaults to mode='link' with linkToChildId set.
 *      New child → defaults to mode='create'. Both can be overridden by the parent.
 */

import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

import { SafeAreaView } from '@/components/ui/safe-area-view';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { usePronoteConnect } from '@/hooks/usePronoteConnect';
import { useParentDashboard } from '@/hooks/useParentDashboard';
import { useThemeColors } from '@/hooks/useThemeColors';
import { parseQrCode, extractEstablishment } from '@/lib/pronote-helpers';
import { validateUsername, validatePassword } from '@/lib/child-credential-validators';

import { PronoteQrScanner } from '@/components/parent/PronoteQrScanner';
import { PronotePinEntry } from '@/components/parent/PronotePinEntry';
import { PronoteStepIntro } from '@/components/parent/pronote/PronoteStepIntro';
import { PronoteStepConnecting } from '@/components/parent/pronote/PronoteStepConnecting';
import { ChildAccessCard } from '@/components/parent/pronote/ChildAccessCard';
import { PronoteResultStep, CONFLICT_REASONS } from '@/components/parent/pronote/PronoteResultStep';

import { buildDefaultAccessForm } from '@/components/parent/pronote/pronote-connect-types';
import type { AccessForm } from '@/components/parent/pronote/pronote-connect-types';
import type { ChildAccessSelection, DiscoveredChild } from '@/hooks/usePronoteConnect';
import type { ChildCredentialsErrors } from '@/components/parent/ChildCredentialsFields';

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function PronoteConnectScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  const {
    step,
    qrData,
    discovered,
    selections,
    isPending,
    error,
    results,
    setQrData,
    goToScan,
    submitPin,
    confirmSelections,
    retryFailed,
    reset,
  } = usePronoteConnect();

  const { children: existingChildren } = useParentDashboard();

  // ── Local state ────────────────────────────────────────────────────────────
  const [pin, setPin] = useState('');
  const [accessForms, setAccessForms] = useState<Record<number, AccessForm>>({});
  const [accessErrors, setAccessErrors] = useState<Record<number, ChildCredentialsErrors>>({});

  const getForm = useCallback(
    (child: DiscoveredChild): AccessForm => {
      return accessForms[child.resourceId] ?? buildDefaultAccessForm(child);
    },
    [accessForms],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleQrScanned = useCallback(
    (result: { data: string }) => {
      const parsed = parseQrCode(result.data);
      if (parsed) {
        setQrData(parsed);
      }
    },
    [setQrData],
  );

  const handlePinSubmit = useCallback(() => {
    void submitPin(pin);
  }, [submitPin, pin]);

  const handleFormChange = useCallback(
    (resourceId: number, field: keyof AccessForm, value: string) => {
      const fallback = discovered.find((d) => d.resourceId === resourceId);
      setAccessForms((prev) => ({
        ...prev,
        [resourceId]: {
          ...(prev[resourceId] ?? (fallback ? buildDefaultAccessForm(fallback) : {})),
          [field]: value,
        },
      }));
      setAccessErrors((prev) => ({
        ...prev,
        [resourceId]: { ...prev[resourceId], [field]: undefined },
      }));
    },
    [discovered],
  );

  const handleModeChange = useCallback(
    (resourceId: number, mode: 'create' | 'link', linkToChildId?: string) => {
      const fallback = discovered.find((d) => d.resourceId === resourceId);
      setAccessForms((prev) => ({
        ...prev,
        [resourceId]: {
          ...(prev[resourceId] ?? (fallback ? buildDefaultAccessForm(fallback) : {})),
          mode,
          linkToChildId,
          ...(mode === 'link' ? { username: '', password: '' } : {}),
        },
      }));
    },
    [discovered],
  );

  const handleConfirm = useCallback(() => {
    let hasErrors = false;
    const newErrors: Record<number, ChildCredentialsErrors> = {};

    for (const child of discovered) {
      const form = getForm(child);
      if (form.mode === 'create') {
        const errs: ChildCredentialsErrors = {};
        const usernameErr = validateUsername(form.username);
        if (usernameErr) { errs.username = usernameErr; hasErrors = true; }
        const passwordErr = validatePassword(form.password);
        if (passwordErr) { errs.password = passwordErr; hasErrors = true; }
        if (Object.keys(errs).length > 0) newErrors[child.resourceId] = errs;
      }
    }

    if (hasErrors) {
      setAccessErrors(newErrors);
      return;
    }

    const sels: ChildAccessSelection[] = discovered.map((child) => {
      const form = getForm(child);
      return {
        resourceId: child.resourceId,
        firstName: child.suggested.firstName,
        lastName: child.suggested.lastName,
        schoolLevel: form.schoolLevel,
        mode: form.mode,
        ...(form.mode === 'create'
          ? { username: form.username, password: form.password }
          : { linkToChildId: form.linkToChildId }),
      };
    });

    void confirmSelections(sels);
  }, [discovered, getForm, confirmSelections]);

  const handleRetry = useCallback(() => {
    const correctableFailedIds = new Set(
      results.failed
        .filter((f) => !CONFLICT_REASONS.includes(f.reason))
        .map((f) => f.resourceId),
    );
    const failedSelections = selections
      .filter((s) => correctableFailedIds.has(s.resourceId))
      .map((s) => {
        const form = accessForms[s.resourceId];
        if (!form) return s;
        return {
          ...s,
          username: form.username || s.username,
          password: form.password || s.password,
        };
      });
    void retryFailed(failedSelections);
  }, [results.failed, selections, accessForms, retryFailed]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const establishment = qrData ? extractEstablishment(qrData.url) : '';
  const mappedChildren = existingChildren.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
  }));

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {step === 'intro' && (
          <PronoteStepIntro onContinue={goToScan} />
        )}

        {step === 'scan' && (
          <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
            <PronoteQrScanner onBarCodeScanned={handleQrScanned} error={error} />
          </ScrollView>
        )}

        {step === 'pin' && (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <PronotePinEntry
              establishment={establishment}
              pin={pin}
              onPinChange={setPin}
              onSubmit={handlePinSubmit}
              onReset={reset}
              error={error}
              isPending={isPending}
            />
          </ScrollView>
        )}

        {step === 'discovering' && <PronoteStepConnecting />}

        {step === 'select' && (
          <View className="flex-1">
            <ScrollView
              className="flex-1 px-4 py-5"
              showsVerticalScrollIndicator={false}
            >
              <Text className="mb-1 text-lg font-bold">Configurer l&apos;accès</Text>
              <Text variant="muted" className="mb-5 text-sm">
                Définissez les identifiants de connexion pour chaque enfant.
              </Text>

              {error && (
                <Card
                  className="mb-4 rounded-xl p-4"
                  style={{ backgroundColor: colors.destructive + '10' }}
                >
                  <Text className="text-center text-destructive">{error}</Text>
                </Card>
              )}

              {discovered.map((child) => (
                <ChildAccessCard
                  key={child.resourceId}
                  child={child}
                  form={getForm(child)}
                  errors={accessErrors[child.resourceId] ?? {}}
                  existingChildren={mappedChildren}
                  onChange={(field, value) => handleFormChange(child.resourceId, field, value)}
                  onModeChange={(mode, linkToChildId) =>
                    handleModeChange(child.resourceId, mode, linkToChildId)
                  }
                />
              ))}
            </ScrollView>

            <View className="border-t px-4 py-4" style={{ borderColor: colors.border }}>
              <Button
                onPress={handleConfirm}
                disabled={isPending || discovered.length === 0}
                accessibilityLabel="Confirmer les accès et activer Pronote"
              >
                <Text className="font-semibold text-primary-foreground">
                  {isPending ? 'Activation...' : 'Confirmer et activer'}
                </Text>
              </Button>
            </View>
          </View>
        )}

        {step === 'activating' && <PronoteStepConnecting />}

        {step === 'result' && (
          <PronoteResultStep
            results={results}
            discovered={discovered}
            selections={selections}
            accessForms={accessForms}
            onFormChange={handleFormChange}
            onRetry={handleRetry}
            onDone={() => router.back()}
            isPending={isPending}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
