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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  ArrowLeft,
  ScanLine,
  KeyRound,
  School,
  Camera,
  X,
  Check,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { PronoteChildSelectorModal } from '@/components/parent';
import {
  useConnectPronote,
  useCreateMappings,
  type PronoteResource,
} from '@/hooks/useParentPronote';
import { useParentDashboard, useIconColors } from '@/hooks';
import { bgColors, borderColors, colors } from '@/lib/styles';

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

  // Find child name if childId is provided
  const currentChild = childId ? children.find((c) => c.id === childId) : null;
  const childName = currentChild
    ? `${currentChild.firstName} ${currentChild.lastName}`
    : '';

  // Handle QR code scan
  const handleBarCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (step !== 'scan') return;

      try {
        // Pronote QR contains JSON with jeton, login, url, etc.
        const parsed = JSON.parse(data);

        // Validate essential fields
        if (!parsed.jeton || !parsed.login || !parsed.url) {
          setError('QR code invalide. Utilisez le QR de Pronote Espace Parents.');
          return;
        }

        // Extract establishment name from URL if possible
        const url = parsed.url as string;
        let establishment = 'Mon établissement';
        try {
          // React Native URL doesn't have hostname, use regex
          const hostnameMatch = url.match(/^https?:\/\/([^/:]+)/);
          if (hostnameMatch?.[1]) {
            establishment = hostnameMatch[1].split('.')[0] || establishment;
          }
        } catch {
          // Ignore URL parsing errors
        }

        setQrData({
          json: data,
          establishment,
        });
        setStep('pin');
        setError(null);
      } catch {
        setError('QR code non reconnu. Scannez le QR Pronote.');
      }
    },
    [step]
  );

  // Handle PIN submission
  const handleSubmit = async () => {
    if (!qrData || pin.length !== 4) {
      setError('Entrez le code PIN à 4 chiffres');
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

      // Connection successful - check if we have a childId to map
      const resources = (result as { resources?: PronoteResource[] }).resources ?? [];
      const establishment = (result as { establishmentName?: string }).establishmentName ?? qrData.establishment;

      if (childId && resources.length > 0) {
        // Show selector to map child
        setConnectResult({ resources, establishmentName: establishment });
        setStep('select');
        setShowSelector(true);
      } else if (resources.length === 0) {
        // No children found in Pronote
        toast.warning('Connexion réussie', 'Votre compte Pronote est connecté, mais aucun enfant n\'a été trouvé.');
        router.back();
      } else {
        // No childId - just connected globally
        toast.success('Connexion réussie', `Votre compte Pronote est connecté. ${resources.length} enfant(s) trouvé(s).`);
        router.back();
      }
    } catch {
      setError('Erreur de connexion. Vérifiez le code PIN.');
    }
  };

  // Handle child selection from modal
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
        toast.success('Association réussie', `${resource.name} est maintenant lié à ${childName}.`);
        router.back();
      } catch {
        toast.error('Erreur', 'Impossible de créer l\'association.');
      }
    },
    [childId, childName, createMappingsMutation, router, toast]
  );

  // Reset to scan step
  const handleReset = () => {
    setStep('scan');
    setQrData(null);
    setPin('');
    setError(null);
  };

  // Permission not granted
  if (!permission) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text variant="muted">Chargement...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="p-1"
            accessibilityLabel="Retour"
            accessibilityRole="button"
          >
            <ArrowLeft color={iconColors.foreground} size={24} />
          </TouchableOpacity>
          <Text variant="h3">Connexion Pronote</Text>
        </View>

        <View className="flex-1 items-center justify-center px-6">
          <Camera color={iconColors.foreground} size={48} />
          <Text className="mt-4 text-center text-lg font-semibold">
            Accès caméra requis
          </Text>
          <Text variant="muted" className="mt-2 text-center">
            Pour scanner le QR code Pronote, autorisez l'accès à la caméra.
          </Text>
          <Button onPress={requestPermission} className="mt-6">
            <Text className="font-semibold text-primary-foreground">
              Autoriser la caméra
            </Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
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
            /* STEP 1: QR Scanner */
            <View className="flex-1">
              {/* Instructions */}
              <View className="px-4 py-4">
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-primary">
                    <ScanLine color="white" size={20} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold">Étape 1 : Scanner le QR</Text>
                    <Text variant="muted" className="text-sm">
                      Allez sur Pronote Parent {'->'} Mobile {'->'} QR Code
                    </Text>
                  </View>
                </View>
              </View>

              {/* Camera View with overlay using absolute positioning */}
              <View className="flex-1 overflow-hidden">
                {/* Camera layer */}
                <CameraView
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                  facing="back"
                  barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                  }}
                  onBarcodeScanned={handleBarCodeScanned}
                />
                {/* Overlay with scan area (absolute positioned on top) */}
                <View
                  className="absolute inset-0 items-center justify-center"
                  style={{ backgroundColor: bgColors.black[50] }}
                >
                  <View className="h-64 w-64 rounded-2xl border-4 border-white">
                    <View className="absolute -left-1 -top-1 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-primary" />
                    <View className="absolute -right-1 -top-1 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-primary" />
                    <View className="absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-primary" />
                    <View className="absolute -bottom-1 -right-1 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-primary" />
                  </View>
                  <Text className="mt-4 text-center text-white">
                    Placez le QR code dans le cadre
                  </Text>
                </View>
              </View>

              {/* Error message */}
              {error && (
                <View className="mx-4 my-4 rounded-xl p-4" style={{ backgroundColor: bgColors.destructive[10] }}>
                  <Text className="text-center text-destructive">{error}</Text>
                </View>
              )}
            </View>
          ) : (
            /* STEP 2: PIN Entry */
            <View className="flex-1 px-4 py-6">
              {/* Instructions */}
              <View className="mb-6 flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-primary">
                  <KeyRound color="white" size={20} />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold">Étape 2 : Entrer le code PIN</Text>
                  <Text variant="muted" className="text-sm">
                    Saisissez le code PIN affiché sur Pronote
                  </Text>
                </View>
              </View>

              {/* QR detected confirmation */}
              <View
                className="mb-6 flex-row items-center gap-3 rounded-xl p-4"
                style={{ backgroundColor: bgColors.success[10], borderWidth: 1, borderColor: borderColors.success[20] }}
              >
                <Check color={colors.success.DEFAULT} size={20} />
                <View className="flex-1">
                  <Text className="font-semibold" style={{ color: colors.success.DEFAULT }}>
                    QR code détecté
                  </Text>
                  <View className="mt-1 flex-row items-center gap-2">
                    <School color={colors.success.DEFAULT} size={14} />
                    <Text className="text-sm" style={{ color: colors.success.DEFAULT }}>
                      {qrData?.establishment}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={handleReset}
                  className="rounded-full p-2"
                  style={{ backgroundColor: bgColors.muted[30] }}
                >
                  <X color={iconColors.foreground} size={16} />
                </TouchableOpacity>
              </View>

              {/* PIN Input */}
              <View className="mb-6">
                <Text className="mb-2 font-medium">Code PIN à 4 chiffres</Text>
                <Input
                  placeholder="0000"
                  value={pin}
                  onChangeText={(text) => setPin(text.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                  className="text-center text-2xl tracking-widest"
                  autoFocus
                />
              </View>

              {/* Error message */}
              {error && (
                <View className="mb-4 rounded-xl p-4" style={{ backgroundColor: bgColors.destructive[10] }}>
                  <Text className="text-center text-destructive">{error}</Text>
                </View>
              )}

              {/* Submit Button */}
              <Button
                onPress={handleSubmit}
                disabled={pin.length !== 4 || connectMutation.isPending}
                className="mt-auto"
              >
                <Text className="font-semibold text-primary-foreground">
                  {connectMutation.isPending ? 'Connexion...' : 'Connecter Pronote'}
                </Text>
              </Button>

              {/* Help Text */}
              <View className="mt-6 rounded-xl border border-border p-4" style={{ backgroundColor: bgColors.muted[50] }}>
                <Text variant="muted" className="text-center text-sm">
                  Le code PIN est affiché sur l'écran Pronote après le QR code.
                  {'\n'}Il expire après quelques minutes.
                </Text>
              </View>
            </View>
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
