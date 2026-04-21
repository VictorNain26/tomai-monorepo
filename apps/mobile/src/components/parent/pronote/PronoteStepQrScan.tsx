/**
 * PronoteStepQrScan
 *
 * Second onboarding step : wraps the reusable `PronoteQrScanner` component in
 * a scrollable container so the camera view + error banner behave well with
 * the parent `KeyboardAvoidingView`.
 */

import { ScrollView } from 'react-native';

import { PronoteQrScanner } from '@/components/parent';

interface PronoteStepQrScanProps {
  onBarCodeScanned: (result: { data: string }) => void;
  error: string | null;
}

export function PronoteStepQrScan({
  onBarCodeScanned,
  error,
}: PronoteStepQrScanProps) {
  return (
    <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
      <PronoteQrScanner onBarCodeScanned={onBarCodeScanned} error={error} />
    </ScrollView>
  );
}
