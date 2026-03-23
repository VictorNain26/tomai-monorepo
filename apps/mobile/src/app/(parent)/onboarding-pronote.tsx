/**
 * Pronote Onboarding Screen
 *
 * Multi-step onboarding flow shown when parent has 0 children (first login).
 * Cannot be skipped. Steps: Welcome -> QR Scan -> PIN -> Import -> Child PIN Setup -> Parent PIN -> Done.
 */

import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import { Camera } from 'lucide-react-native';

import { SafeAreaView } from '@/components/ui/safe-area-view';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { TomAvatar } from '@/components/common';
import { PronoteQrScanner, PronotePinEntry } from '@/components/parent';
import { PronoteChildImport } from '@/components/parent/PronoteChildImport';
import { ChildPinSetup } from '@/components/parent/ChildPinSetup';
import { usePronote, useThemeColors, useParentDashboard } from '@/hooks';
import { useUser } from '@/lib/auth';
import { useChildAccessStore } from '@/stores/child-access-store';
import type { PronoteResource, QrCodeData } from '@/services/pronote/pronote-types';
import type { EducationLevelType } from '@/constants/levels';
import type { ICreateChildData } from '@/hooks/useParentDashboard';

// ============================================================================
// TYPES
// ============================================================================

type Step =
  | 'welcome'
  | 'scan'
  | 'pin'
  | 'import'
  | 'pin-setup'
  | 'parent-pin'
  | 'parent-pin-confirm';

interface ChildPinData {
  resource: PronoteResource;
  schoolLevel: EducationLevelType;
  pinType: 'pin' | 'password';
  pinValue: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function parseQrCode(data: string): QrCodeData | null {
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    if (
      typeof parsed.jeton === 'string' &&
      typeof parsed.login === 'string' &&
      typeof parsed.url === 'string'
    ) {
      return { jeton: parsed.jeton, login: parsed.login, url: parsed.url };
    }
    return null;
  } catch {
    return null;
  }
}

function extractEstablishment(url: string): string {
  try {
    const match = url.match(/^https?:\/\/([^/:]+)/);
    if (match?.[1]) {
      return match[1].split('.')[0] || 'Mon etablissement';
    }
  } catch {
    // ignore
  }
  return 'Mon etablissement';
}

function generateUsername(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '');
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function OnboardingPronoteScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useUser();
  const pronote = usePronote(user?.id ?? '');
  const { createChild, children } = useParentDashboard();
  const setCredential = useChildAccessStore((s) => s.setCredential);
  const setParentCredential = useChildAccessStore((s) => s.setParentCredential);
  const [permission, requestPermission] = useCameraPermissions();

  // Step state
  const [step, setStep] = useState<Step>('welcome');
  const [qrData, setQrData] = useState<QrCodeData | null>(null);
  const [establishment, setEstablishment] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [resources, setResources] = useState<PronoteResource[]>([]);

  // Child import state
  const [selectedResources, setSelectedResources] = useState<PronoteResource[]>([]);
  const [childPinData, setChildPinData] = useState<ChildPinData[]>([]);
  const [currentPinSetupIndex, setCurrentPinSetupIndex] = useState(0);
  const [isCreatingChildren, setIsCreatingChildren] = useState(false);

  // Parent PIN state
  const [parentPinValue, setParentPinValue] = useState('');
  const [parentPinConfirm, setParentPinConfirm] = useState('');
  const [isSavingParentPin, setIsSavingParentPin] = useState(false);

  // ---- Handlers ----

  const handleBarCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (step !== 'scan') return;

      const parsed = parseQrCode(data);
      if (!parsed) {
        setError('QR code invalide. Utilisez le QR de Pronote Espace Parents.');
        return;
      }

      setQrData(parsed);
      setEstablishment(extractEstablishment(parsed.url));
      setStep('pin');
      setError(null);
    },
    [step],
  );

  const handlePinSubmit = useCallback(async () => {
    if (!qrData || pin.length !== 4) {
      setError('Entrez le code PIN a 4 chiffres');
      return;
    }

    setError(null);
    setIsConnecting(true);

    try {
      const result = await pronote.connect(qrData, pin);

      if (result.error) {
        setError(result.error);
        setIsConnecting(false);
        return;
      }

      const foundResources = result.resources ?? [];
      setResources(foundResources);

      if (foundResources.length === 0) {
        setError('Aucun enfant trouve dans votre compte Pronote.');
        setIsConnecting(false);
        return;
      }

      setStep('import');
    } catch {
      setError('Erreur de connexion. Verifiez le code PIN.');
    } finally {
      setIsConnecting(false);
    }
  }, [qrData, pin, pronote]);

  const handlePinReset = useCallback(() => {
    setStep('scan');
    setQrData(null);
    setPin('');
    setError(null);
  }, []);

  const handleImport = useCallback((selected: PronoteResource[]) => {
    setSelectedResources(selected);
    setCurrentPinSetupIndex(0);
    setChildPinData([]);
    setStep('pin-setup');
  }, []);

  const handleChildPinComplete = useCallback(
    async (data: ChildPinData) => {
      const updatedData = [...childPinData, data];
      setChildPinData(updatedData);

      if (currentPinSetupIndex < selectedResources.length - 1) {
        setCurrentPinSetupIndex((i) => i + 1);
      } else {
        // All children configured — create accounts
        setIsCreatingChildren(true);
        setError(null);

        try {
          for (const child of updatedData) {
            const nameParts = child.resource.name.split(' ');
            const firstName = nameParts[0] || child.resource.name;
            const lastName = nameParts.slice(1).join(' ') || '';

            const childData: ICreateChildData = {
              firstName,
              lastName,
              username: generateUsername(child.resource.name),
              password: child.pinValue,
              schoolLevel: child.schoolLevel,
            };

            const created = await createChild(childData);

            // Store child PIN locally
            await setCredential(created.id, child.pinType, child.pinValue);

            // Set Pronote resource mapping
            const resourceIndex = resources.findIndex(
              (r) => r.id === child.resource.id,
            );
            if (resourceIndex >= 0) {
              pronote.setResourceMapping(created.id, resourceIndex);
            }
          }

          setStep('parent-pin');
        } catch {
          setError('Erreur lors de la creation des comptes. Reessayez.');
        } finally {
          setIsCreatingChildren(false);
        }
      }
    },
    [
      childPinData,
      currentPinSetupIndex,
      selectedResources.length,
      createChild,
      setCredential,
      resources,
      pronote,
    ],
  );

  const handleParentPinSubmit = useCallback(async () => {
    if (parentPinValue.length < 4) return;
    setStep('parent-pin-confirm');
  }, [parentPinValue]);

  const handleParentPinConfirm = useCallback(async () => {
    if (parentPinConfirm !== parentPinValue) {
      setError('Les codes ne correspondent pas');
      return;
    }

    setIsSavingParentPin(true);
    setError(null);

    try {
      await setParentCredential(parentPinValue);
      router.replace('/(parent)/profile-select');
    } catch {
      setError('Erreur lors de la sauvegarde. Reessayez.');
    } finally {
      setIsSavingParentPin(false);
    }
  }, [parentPinConfirm, parentPinValue, setParentCredential, router]);

  // ---- Permission screens ----

  if (step === 'scan' && !permission) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-stone-50 dark:bg-stone-900">
        <Text variant="muted">Chargement...</Text>
      </SafeAreaView>
    );
  }

  if (step === 'scan' && permission && !permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-900">
        <View className="flex-1 items-center justify-center px-6">
          <Camera color={colors.foreground} size={48} />
          <Text className="mt-4 text-center text-lg font-semibold">
            Acces camera requis
          </Text>
          <Text variant="muted" className="mt-2 text-center">
            Pour scanner le QR code Pronote, autorisez l'acces a la camera.
          </Text>
          <Button onPress={requestPermission} className="mt-6">
            <Text className="font-semibold text-white dark:text-stone-900">
              Autoriser la camera
            </Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // ---- Render steps ----

  return (
    <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-900">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {step === 'welcome' && (
          <WelcomeStep onContinue={() => setStep('scan')} />
        )}

        {step === 'scan' && (
          <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
            <PronoteQrScanner
              onBarCodeScanned={handleBarCodeScanned}
              error={error}
            />
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
              onReset={handlePinReset}
              error={error}
              isPending={isConnecting}
            />
          </ScrollView>
        )}

        {step === 'import' && (
          <PronoteChildImport
            resources={resources}
            existingChildNames={children.map(
              (c) => `${c.firstName} ${c.lastName}`,
            )}
            onImport={handleImport}
            isSubmitting={false}
          />
        )}

        {step === 'pin-setup' && selectedResources[currentPinSetupIndex] && (
          <View className="flex-1">
            {isCreatingChildren ? (
              <View className="flex-1 items-center justify-center px-6">
                <TomAvatar size="lg" />
                <Text className="mt-4 text-center text-lg font-semibold">
                  Creation des comptes...
                </Text>
                <Text variant="muted" className="mt-2 text-center">
                  Veuillez patienter
                </Text>
              </View>
            ) : (
              <ChildPinSetup
                resource={selectedResources[currentPinSetupIndex]}
                index={currentPinSetupIndex}
                total={selectedResources.length}
                onComplete={handleChildPinComplete}
              />
            )}
            {error && (
              <View className="mx-4 mb-4 rounded-xl bg-red-50 dark:bg-red-950 p-4">
                <Text className="text-center text-red-600 dark:text-red-400">
                  {error}
                </Text>
              </View>
            )}
          </View>
        )}

        {step === 'parent-pin' && (
          <ParentPinStep
            value={parentPinValue}
            onChangeText={setParentPinValue}
            onSubmit={handleParentPinSubmit}
            error={null}
            isPending={false}
            isConfirm={false}
          />
        )}

        {step === 'parent-pin-confirm' && (
          <ParentPinStep
            value={parentPinConfirm}
            onChangeText={setParentPinConfirm}
            onSubmit={handleParentPinConfirm}
            error={error}
            isPending={isSavingParentPin}
            isConfirm
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="flex-1 items-center justify-center px-6"
    >
      <TomAvatar size="lg" />

      <Text className="mt-6 text-center text-2xl font-bold">
        Bienvenue sur TomAI !
      </Text>

      <Text variant="muted" className="mt-3 text-center text-base leading-6">
        Pour commencer, connectons votre compte Pronote.{'\n'}
        Tom pourra ainsi acceder aux devoirs, notes et emploi du temps de vos
        enfants.
      </Text>

      <Text variant="muted" className="mt-6 text-center text-xs leading-5">
        TomAI n'est pas affilie a Index Education.{'\n'}
        Vos donnees Pronote restent sur votre appareil.
      </Text>

      <Button onPress={onContinue} className="mt-8 w-full">
        <Text className="font-semibold text-white dark:text-stone-900">
          Scanner le QR code
        </Text>
      </Button>
    </ScrollView>
  );
}

function ParentPinStep({
  value,
  onChangeText,
  onSubmit,
  error,
  isPending,
  isConfirm,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  error: string | null;
  isPending: boolean;
  isConfirm: boolean;
}) {
  const colors = useThemeColors();

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="flex-1 px-6 py-8"
      keyboardShouldPersistTaps="handled"
    >
      <View className="flex-1 justify-center">
        <Text className="text-center text-xl font-bold">
          {isConfirm ? 'Confirmez votre code' : 'Code parent'}
        </Text>
        <Text variant="muted" className="mt-2 text-center">
          {isConfirm
            ? 'Ressaisissez votre code PIN pour confirmer'
            : 'Choisissez un code PIN pour acceder aux reglages'}
        </Text>

        <TextInput
          value={value}
          onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, 6))}
          secureTextEntry
          keyboardType="numeric"
          maxLength={6}
          placeholder="• • • •"
          placeholderTextColor={colors.muted}
          className="mt-8 rounded-xl border bg-white dark:bg-stone-800 px-4 py-4 text-center text-2xl tracking-widest text-foreground"
          style={{ borderColor: error ? colors.destructive : colors.border }}
          autoFocus
          onSubmitEditing={value.length >= 4 ? onSubmit : undefined}
        />

        {error && (
          <Text className="mt-3 text-center text-sm text-red-500">{error}</Text>
        )}
      </View>

      <Button
        onPress={onSubmit}
        disabled={value.length < 4 || isPending}
        className="mt-6"
      >
        <Text className="font-semibold text-white dark:text-stone-900">
          {isPending ? 'En cours...' : isConfirm ? 'Terminer' : 'Continuer'}
        </Text>
      </Button>
    </ScrollView>
  );
}
