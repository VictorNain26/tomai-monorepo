/**
 * Pronote Onboarding Screen
 *
 * Multi-step onboarding shown when a parent has 0 children (first login).
 * Cannot be skipped. The step machine itself lives in `usePronoteOnboarding`;
 * this file is a thin orchestrator that picks the right step component.
 *
 * Steps : welcome -> scan -> pin -> import -> pin-setup -> parent-pin -> parent-pin-confirm
 */

import { View, KeyboardAvoidingView, Platform } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import { Camera } from 'lucide-react-native';

import { SafeAreaView } from '@/components/ui/safe-area-view';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useThemeColors } from '@/hooks';
import { usePronoteOnboarding } from '@/hooks/usePronoteOnboarding';
import { PronoteStepIntro } from '@/components/parent/pronote/PronoteStepIntro';
import { PronoteStepQrScan } from '@/components/parent/pronote/PronoteStepQrScan';
import { PronoteStepPin } from '@/components/parent/pronote/PronoteStepPin';
import { PronoteStepSuccess } from '@/components/parent/pronote/PronoteStepSuccess';
import { PronoteStepChildPin } from '@/components/parent/pronote/PronoteStepChildPin';
import { PronoteStepParentPin } from '@/components/parent/pronote/PronoteStepParentPin';

export default function OnboardingPronoteScreen() {
  const colors = useThemeColors();
  const [permission, requestPermission] = useCameraPermissions();
  const flow = usePronoteOnboarding();

  // ---- Camera permission gates (scan step only) ----

  if (flow.step === 'scan' && !permission) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-stone-50 dark:bg-stone-900">
        <Text variant="muted">Chargement...</Text>
      </SafeAreaView>
    );
  }

  if (flow.step === 'scan' && permission && !permission.granted) {
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

  // ---- Step render ----

  const currentChildResource =
    flow.step === 'pin-setup'
      ? flow.selectedResources[flow.currentPinSetupIndex]
      : undefined;

  return (
    <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-900">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {flow.step === 'welcome' && (
          <PronoteStepIntro onContinue={flow.goToScan} />
        )}

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
            isSubmitting={false}
          />
        )}

        {flow.step === 'pin-setup' && currentChildResource && (
          <PronoteStepChildPin
            resource={currentChildResource}
            index={flow.currentPinSetupIndex}
            total={flow.selectedResources.length}
            isCreatingChildren={flow.isCreatingChildren}
            error={flow.error}
            onComplete={flow.handleChildPinComplete}
          />
        )}

        {flow.step === 'parent-pin' && (
          <PronoteStepParentPin
            value={flow.parentPinValue}
            onChangeText={flow.setParentPinValue}
            onSubmit={flow.handleParentPinSubmit}
            error={null}
            isPending={false}
            isConfirm={false}
          />
        )}

        {flow.step === 'parent-pin-confirm' && (
          <PronoteStepParentPin
            value={flow.parentPinConfirm}
            onChangeText={flow.setParentPinConfirm}
            onSubmit={flow.handleParentPinConfirm}
            error={flow.error}
            isPending={flow.isSavingParentPin}
            isConfirm
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
