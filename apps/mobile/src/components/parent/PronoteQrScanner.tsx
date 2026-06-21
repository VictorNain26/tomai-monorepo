/**
 * PronoteQrScanner Component
 *
 * Camera-based QR code scanner step for Pronote connection.
 */

import { View, TouchableOpacity } from 'react-native';
import { CameraView } from 'expo-camera';
import { ScanLine } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { bgColors } from '@/lib/styles';
// E2E ONLY — payload used by the hidden injection tap target.
import { E2E_QR_PAYLOAD } from '@/services/pronote/pronote-e2e-stubs';

// Read at render time so RN's metro bundler can dead-code-eliminate the branch
// in production builds where EXPO_PUBLIC_E2E is never injected.
const IS_E2E = process.env.EXPO_PUBLIC_E2E === '1';

interface PronoteQrScannerProps {
  onBarCodeScanned: (result: { data: string }) => void;
  error: string | null;
}

export function PronoteQrScanner({ onBarCodeScanned, error }: PronoteQrScannerProps) {
  return (
    <View className="flex-1">
      {/* Instructions */}
      <View className="px-4 py-4">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary">
            <ScanLine color="white" size={20} />
          </View>
          <View className="flex-1">
            <Text className="font-semibold">Etape 1 : Scanner le QR</Text>
            <Text variant="muted" className="text-sm">
              Allez sur Pronote Parent {'->'} Mobile {'->'} QR Code
            </Text>
          </View>
        </View>
      </View>

      {/* Camera View with overlay */}
      <View className="flex-1 overflow-hidden">
        <CameraView
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={onBarCodeScanned}
        />
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

      {/* E2E ONLY — hidden tap target that injects a fixed QR payload.
          Rendered exclusively when EXPO_PUBLIC_E2E === '1' (preview builds only).
          Production builds never set this flag so this element never renders. */}
      {IS_E2E && (
        <TouchableOpacity
          testID="e2e-inject-qr"
          accessibilityLabel="E2E inject QR"
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
          onPress={() => onBarCodeScanned({ data: JSON.stringify(E2E_QR_PAYLOAD) })}
        />
      )}
    </View>
  );
}
