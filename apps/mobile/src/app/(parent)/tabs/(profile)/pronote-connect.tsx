/**
 * Pronote QR Connect Screen
 *
 * Camera-based QR code (re)connection for a parent who has already been
 * onboarded (ie. parent PIN already configured). After a successful Pronote
 * login the parent can import new children into their existing TomAI account.
 *
 * Thin orchestrator : the state machine lives in `usePronoteReconnect` and
 * each step is rendered by the shared `PronoteStep*` components (also used
 * by the initial onboarding screen).
 *
 * Usage:
 * - From profile tab : /(parent)/tabs/(profile)/pronote-connect
 * - From child detail : /(parent)/tabs/(home)/pronote-connect (re-exported)
 */

import {
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import { ArrowLeft, Camera } from 'lucide-react-native';

import { SafeAreaView } from '@/components/ui/safe-area-view';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useThemeColors } from '@/hooks';
import { usePronoteReconnect } from '@/hooks/usePronoteReconnect';
import { PronoteStepQrScan } from '@/components/parent/pronote/PronoteStepQrScan';
import { PronoteStepPin } from '@/components/parent/pronote/PronoteStepPin';
import { PronoteStepSuccess } from '@/components/parent/pronote/PronoteStepSuccess';
import { PronoteStepChildPin } from '@/components/parent/pronote/PronoteStepChildPin';

// ============================================================================
// HEADER
// ============================================================================

function ScreenHeader({
  title,
  onBack,
  foreground,
}: {
  title: string;
  onBack: () => void;
  foreground: string;
}) {
  return (
    <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
      <TouchableOpacity
        onPress={onBack}
        className="h-10 w-10 items-center justify-center rounded-full"
        accessibilityLabel="Retour"
        accessibilityRole="button"
      >
        <ArrowLeft color={foreground} size={24} />
      </TouchableOpacity>
      <Text variant="h3">{title}</Text>
    </View>
  );
}

// ============================================================================
// SCREEN
// ============================================================================

export default function PronoteConnectScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [permission, requestPermission] = useCameraPermissions();
  const flow = usePronoteReconnect();

  // ---- Camera permission gates ----

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
        <ScreenHeader
          title="Connexion Pronote"
          onBack={() => router.back()}
          foreground={colors.foreground}
        />
        <View className="flex-1 items-center justify-center px-6">
          <Camera color={colors.foreground} size={48} />
          <Text className="mt-4 text-center text-lg font-semibold">
            Acces camera requis
          </Text>
          <Text variant="muted" className="mt-2 text-center">
            Pour scanner le QR code Pronote, autorisez l'acces a la camera.
          </Text>
          <Button onPress={requestPermission} className="mt-6">
            <Text className="font-semibold text-primary-foreground">
              Autoriser la camera
            </Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // ---- PIN Setup step (full-screen, ChildPinSetup has its own scroll) ----

  if (flow.step === 'pin-setup') {
    const currentResource = flow.selectedResources[flow.currentPinSetupIndex];
    if (!currentResource) return null;

    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScreenHeader
          title="Créer l'accès enfant"
          onBack={() => router.back()}
          foreground={colors.foreground}
        />
        <PronoteStepChildPin
          resource={currentResource}
          index={flow.currentPinSetupIndex}
          total={flow.selectedResources.length}
          isCreatingChildren={false}
          error={flow.error}
          onComplete={flow.handleChildPinComplete}
        />
      </SafeAreaView>
    );
  }

  // ---- Main flow (scan / pin / import) ----

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title="Connexion Pronote"
        onBack={() => router.back()}
        foreground={colors.foreground}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {flow.step === 'scan' && (
          <PronoteStepQrScan
            onBarCodeScanned={flow.handleBarCodeScanned}
            error={flow.error}
          />
        )}

        {flow.step === 'pin' && (
          <PronoteStepPin
            establishment={flow.establishment}
            pin={flow.pin}
            onPinChange={flow.setPin}
            onSubmit={flow.handlePinSubmit}
            onReset={flow.handlePinReset}
            error={flow.error}
            isPending={flow.isConnecting}
          />
        )}

        {flow.step === 'import' && (
          <PronoteStepSuccess
            resources={flow.resources}
            existingChildNames={flow.existingChildNames}
            onImport={flow.handleImport}
            isSubmitting={flow.isImporting}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
