/**
 * Pronote QR Connect Screen
 *
 * Camera-based QR code scanner for Pronote parent connection.
 * After successful connection, shows PronoteChildImport (multi-select),
 * then ChildPinSetup for each new child sequentially.
 *
 * Usage:
 * - From profile tab: /(parent)/tabs/(profile)/pronote-connect
 * - From child detail: /(parent)/tabs/(home)/pronote-connect?childId=xxx (re-exported)
 */

import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useRouter } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import { ArrowLeft, Camera } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import {
  PronoteQrScanner,
  PronotePinEntry,
  PronoteChildImport,
  ChildPinSetup,
} from '@/components/parent';
import type { PronoteResource } from '@/services/pronote/pronote-types';
import { usePronote } from '@/hooks/usePronote';
import { useParentDashboard, useThemeColors } from '@/hooks';
import { useUser } from '@/lib/auth';
import { useToast } from '@/components/ui/toast';
import { useChildAccessStore } from '@/stores/child-access-store';
import type { EducationLevelType } from '@/constants/levels';

// ============================================================================
// TYPES
// ============================================================================

type Step = 'scan' | 'pin' | 'import' | 'pin-setup';

interface QrData {
  json: string;
  establishment: string;
}

interface ConnectResult {
  resources: PronoteResource[];
  establishmentName: string;
}

interface PinSetupData {
  resource: PronoteResource;
  schoolLevel: EducationLevelType;
  pinType: 'pin' | 'password';
  pinValue: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function toUsername(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '');
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0] ?? fullName, lastName: '' };
  }
  // Pronote name format is typically "LASTNAME Firstname"
  const lastName = parts[0] ?? '';
  const firstName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function PronoteConnectScreen() {
  const router = useRouter();
  const toast = useToast();
  const colors = useThemeColors();
  const [permission, requestPermission] = useCameraPermissions();
  const user = useUser();
  const pronote = usePronote(user?.id ?? '');
  const { children, createChild } = useParentDashboard();
  const setCredential = useChildAccessStore((s) => s.setCredential);

  const [step, setStep] = useState<Step>('scan');
  const [qrData, setQrData] = useState<QrData | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connectResult, setConnectResult] = useState<ConnectResult | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Import flow state
  const [selectedResources, setSelectedResources] = useState<PronoteResource[]>([]);
  const [pinSetupIndex, setPinSetupIndex] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  // Maps resource.id -> created childId for PIN store
  const [createdChildIds, setCreatedChildIds] = useState<Record<string, string>>({});

  const existingChildNames = children.map(
    (c) => `${c.lastName} ${c.firstName}`.trim(),
  );

  // ============================================================================
  // QR + PIN handlers
  // ============================================================================

  const handleBarCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (step !== 'scan') return;

      try {
        const parsed = JSON.parse(data);
        if (!parsed.jeton || !parsed.login || !parsed.url) {
          setError('QR code invalide. Utilisez le QR de Pronote Espace Parents.');
          return;
        }

        const url = parsed.url as string;
        let establishment = 'Mon etablissement';
        try {
          const hostnameMatch = url.match(/^https?:\/\/([^/:]+)/);
          if (hostnameMatch?.[1]) {
            establishment = hostnameMatch[1].split('.')[0] ?? establishment;
          }
        } catch {
          // Ignore URL parsing errors
        }

        setQrData({ json: data, establishment });
        setStep('pin');
        setError(null);
      } catch {
        setError('QR code non reconnu. Scannez le QR Pronote.');
      }
    },
    [step],
  );

  const handleSubmit = async () => {
    if (!qrData || pin.length !== 4) {
      setError('Entrez le code PIN a 4 chiffres');
      return;
    }

    setError(null);
    setIsConnecting(true);

    try {
      const parsed = JSON.parse(qrData.json) as { jeton: string; login: string; url: string };
      const result = await pronote.connect(
        { jeton: parsed.jeton, login: parsed.login, url: parsed.url },
        pin,
      );

      if (result.error) {
        setError(result.error);
        setIsConnecting(false);
        return;
      }

      const resources = result.resources ?? [];

      if (resources.length === 0) {
        toast.warning('Connexion reussie', 'Votre compte Pronote est connecte, mais aucun enfant n\'a ete trouve.');
        router.back();
        return;
      }

      setConnectResult({ resources, establishmentName: qrData.establishment });
      setStep('import');
    } catch {
      setError('Erreur de connexion. Verifiez le code PIN.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleReset = () => {
    setStep('scan');
    setQrData(null);
    setPin('');
    setError(null);
  };

  // ============================================================================
  // Import flow handlers
  // ============================================================================

  const handleImport = useCallback(
    async (selected: PronoteResource[]) => {
      if (selected.length === 0) {
        router.back();
        return;
      }

      setIsImporting(true);

      try {
        // Create TomAI accounts for each selected child
        const newChildIds: Record<string, string> = {};

        for (const resource of selected) {
          const { firstName, lastName } = splitName(resource.name);
          const baseUsername = toUsername(resource.name);
          const username = `${baseUsername}.${Date.now() % 10000}`;

          // Temporary password — will be overwritten by PIN setup
          const tempPassword = `tmp-${Math.random().toString(36).slice(2)}`;

          const child = await createChild({
            firstName,
            lastName,
            username,
            password: tempPassword,
            schoolLevel: 'sixieme', // placeholder; updated in ChildPinSetup
          });

          newChildIds[resource.id] = child.id;

          // Set resource mapping for this child
          const resourceIndex = (connectResult?.resources ?? []).indexOf(resource);
          if (resourceIndex !== -1) {
            pronote.setResourceMapping(child.id, resourceIndex);
          }
        }

        setCreatedChildIds(newChildIds);
        setSelectedResources(selected);
        setPinSetupIndex(0);
        setStep('pin-setup');
      } catch {
        toast.error('Erreur', 'Impossible de creer les comptes enfants.');
      } finally {
        setIsImporting(false);
      }
    },
    [connectResult, createChild, pronote, router, toast],
  );

  const handlePinSetupComplete = useCallback(
    async (data: PinSetupData) => {
      const childId = createdChildIds[data.resource.id];
      if (childId) {
        await setCredential(childId, data.pinType, data.pinValue);
      }

      const nextIndex = pinSetupIndex + 1;
      if (nextIndex >= selectedResources.length) {
        toast.success(
          'Comptes crees',
          `${selectedResources.length} enfant(s) ajoute(s) avec succes.`,
        );
        router.back();
      } else {
        setPinSetupIndex(nextIndex);
      }
    },
    [createdChildIds, pinSetupIndex, selectedResources, setCredential, toast, router],
  );

  // ============================================================================
  // Permission states
  // ============================================================================

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-stone-50 dark:bg-stone-900">
        <Text variant="muted">Chargement...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-900">
        <View className="flex-row items-center gap-3 border-b border-stone-200 dark:border-stone-700 px-4 py-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="p-1"
            accessibilityLabel="Retour"
            accessibilityRole="button"
          >
            <ArrowLeft color={colors.foreground} size={24} />
          </TouchableOpacity>
          <Text variant="h3">Connexion Pronote</Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Camera color={colors.foreground} size={48} />
          <Text className="mt-4 text-center text-lg font-semibold">Acces camera requis</Text>
          <Text variant="muted" className="mt-2 text-center">
            Pour scanner le QR code Pronote, autorisez l'acces a la camera.
          </Text>
          <Button onPress={requestPermission} className="mt-6">
            <Text className="font-semibold text-white dark:text-stone-900">Autoriser la camera</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================================
  // PIN Setup step (full-screen, no scroll wrapper — ChildPinSetup has its own)
  // ============================================================================

  if (step === 'pin-setup') {
    const currentResource = selectedResources[pinSetupIndex];
    if (!currentResource) return null;

    return (
      <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-900">
        <View className="flex-row items-center gap-3 border-b border-stone-200 dark:border-stone-700 px-4 py-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full"
            accessibilityLabel="Retour"
            accessibilityRole="button"
          >
            <ArrowLeft color={colors.foreground} size={24} />
          </TouchableOpacity>
          <Text variant="h3">Créer l'accès enfant</Text>
        </View>
        <ChildPinSetup
          resource={currentResource}
          index={pinSetupIndex}
          total={selectedResources.length}
          onComplete={handlePinSetupComplete}
        />
      </SafeAreaView>
    );
  }

  // ============================================================================
  // Main screen (scan / pin / import)
  // ============================================================================

  return (
    <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-900">
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-stone-200 dark:border-stone-700 px-4 py-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full"
          accessibilityLabel="Retour"
          accessibilityRole="button"
        >
          <ArrowLeft color={colors.foreground} size={24} />
        </TouchableOpacity>
        <Text variant="h3">Connexion Pronote</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {step === 'scan' && (
          <PronoteQrScanner
            onBarCodeScanned={handleBarCodeScanned}
            error={error}
          />
        )}

        {step === 'pin' && (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <PronotePinEntry
              establishment={qrData?.establishment ?? ''}
              pin={pin}
              onPinChange={setPin}
              onSubmit={handleSubmit}
              onReset={handleReset}
              error={error}
              isPending={isConnecting}
            />
          </ScrollView>
        )}

        {step === 'import' && connectResult && (
          <PronoteChildImport
            resources={connectResult.resources}
            existingChildNames={existingChildNames}
            onImport={handleImport}
            isSubmitting={isImporting}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
