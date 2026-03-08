/**
 * Pronote QR Connect Screen
 *
 * Camera-based QR code scanner for Pronote parent connection.
 * Optionally accepts childId to auto-show mapping selector after connection.
 *
 * Usage:
 * - From profile tab: /(parent)/(profile)/pronote-connect
 * - From child detail: /(parent)/(home)/pronote-connect?childId=xxx (re-exported)
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import { ArrowLeft, Camera } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { PronoteChildSelectorModal, PronoteQrScanner, PronotePinEntry } from '@/components/parent';
import {
  useConnectPronote,
  useCreateMappings,
  type PronoteResource,
} from '@/hooks/useParentPronote';
import { useParentDashboard, useIconColors } from '@/hooks';
import { useToast } from '@/components/ui/toast';

// ============================================================================
// TYPES
// ============================================================================

type Step = 'scan' | 'pin' | 'select';

interface QrData {
  json: string;
  establishment: string;
}

interface ConnectResult {
  resources: PronoteResource[];
  establishmentName: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function PronoteConnectScreen() {
  const router = useRouter();
  const toast = useToast();
  const iconColors = useIconColors();
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const connectMutation = useConnectPronote();
  const createMappingsMutation = useCreateMappings();
  const { children } = useParentDashboard();

  const [step, setStep] = useState<Step>('scan');
  const [qrData, setQrData] = useState<QrData | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connectResult, setConnectResult] = useState<ConnectResult | null>(null);
  const [showSelector, setShowSelector] = useState(false);

  const currentChild = childId ? children.find((c) => c.id === childId) : null;
  const childName = currentChild ? `${currentChild.firstName} ${currentChild.lastName}` : '';

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
            establishment = hostnameMatch[1].split('.')[0] || establishment;
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
    [step]
  );

  const handleSubmit = async () => {
    if (!qrData || pin.length !== 4) {
      setError('Entrez le code PIN a 4 chiffres');
      return;
    }

    setError(null);

    try {
      const result = await connectMutation.mutateAsync({
        qrCodeJson: qrData.json,
        pin: pin,
        establishmentName: qrData.establishment,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      const resources = (result as { resources?: PronoteResource[] }).resources ?? [];
      const establishment = (result as { establishmentName?: string }).establishmentName ?? qrData.establishment;

      if (childId && resources.length > 0) {
        setConnectResult({ resources, establishmentName: establishment });
        setStep('select');
        setShowSelector(true);
      } else if (resources.length === 0) {
        toast.warning('Connexion reussie', 'Votre compte Pronote est connecte, mais aucun enfant n\'a ete trouve.');
        router.back();
      } else {
        toast.success('Connexion reussie', `Votre compte Pronote est connecte. ${resources.length} enfant(s) trouve(s).`);
        router.back();
      }
    } catch {
      setError('Erreur de connexion. Verifiez le code PIN.');
    }
  };

  const handleChildSelect = useCallback(
    async (resourceIndex: number, resource: PronoteResource) => {
      if (!childId) return;

      try {
        const result = await createMappingsMutation.mutateAsync([
          {
            childId,
            resourceIndex,
            pronoteChildName: resource.name,
            pronoteClassName: resource.className,
          },
        ]);

        if (result.error) {
          toast.error('Erreur', result.error);
          return;
        }

        setShowSelector(false);
        toast.success('Association reussie', `${resource.name} est maintenant lie a ${childName}.`);
        router.back();
      } catch {
        toast.error('Erreur', 'Impossible de creer l\'association.');
      }
    },
    [childId, childName, createMappingsMutation, router, toast]
  );

  const handleReset = () => {
    setStep('scan');
    setQrData(null);
    setPin('');
    setError(null);
  };

  // Permission states
  if (!permission) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Text variant="muted">Chargement...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
        <View className="flex-row items-center gap-3 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <TouchableOpacity onPress={() => router.back()} className="p-1" accessibilityLabel="Retour" accessibilityRole="button">
            <ArrowLeft color={iconColors.foreground} size={24} />
          </TouchableOpacity>
          <Text variant="h3">Connexion Pronote</Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Camera color={iconColors.foreground} size={48} />
          <Text className="mt-4 text-center text-lg font-semibold">Acces camera requis</Text>
          <Text variant="muted" className="mt-2 text-center">
            Pour scanner le QR code Pronote, autorisez l'acces a la camera.
          </Text>
          <Button onPress={requestPermission} className="mt-6">
            <Text className="font-semibold text-white dark:text-slate-900">Autoriser la camera</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full"
          accessibilityLabel="Retour"
          accessibilityRole="button"
        >
          <ArrowLeft color={iconColors.foreground} size={24} />
        </TouchableOpacity>
        <Text variant="h3">Connexion Pronote</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'scan' ? (
            <PronoteQrScanner
              onBarCodeScanned={handleBarCodeScanned}
              error={error}
            />
          ) : (
            <PronotePinEntry
              establishment={qrData?.establishment ?? ''}
              pin={pin}
              onPinChange={setPin}
              onSubmit={handleSubmit}
              onReset={handleReset}
              error={error}
              isPending={connectMutation.isPending}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Pronote Child Selector Modal */}
      {connectResult && (
        <PronoteChildSelectorModal
          visible={showSelector}
          onClose={() => {
            setShowSelector(false);
            router.back();
          }}
          onSelect={handleChildSelect}
          resources={connectResult.resources}
          childName={childName}
          establishmentName={connectResult.establishmentName}
          isSubmitting={createMappingsMutation.isPending}
        />
      )}
    </SafeAreaView>
  );
}
