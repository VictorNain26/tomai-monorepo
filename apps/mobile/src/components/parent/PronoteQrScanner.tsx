/**
 * PronoteQrScanner Component
 *
 * Camera-based QR code scanner step for Pronote connection.
 */

import { View } from 'react-native';
import { CameraView } from 'expo-camera';
import { ScanLine } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { bgColors } from '@/lib/styles';

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
          <View className="h-10 w-10 items-center justify-center rounded-full bg-blue-600 dark:bg-blue-400">
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
            <View className="absolute -left-1 -top-1 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-blue-600 dark:border-blue-400" />
            <View className="absolute -right-1 -top-1 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-blue-600 dark:border-blue-400" />
            <View className="absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-blue-600 dark:border-blue-400" />
            <View className="absolute -bottom-1 -right-1 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-blue-600 dark:border-blue-400" />
          </View>
          <Text className="mt-4 text-center text-white">
            Placez le QR code dans le cadre
          </Text>
        </View>
      </View>

      {/* Error message */}
      {error && (
        <View className="mx-4 my-4 rounded-xl p-4" style={{ backgroundColor: bgColors.destructive[10] }}>
          <Text className="text-center text-red-600 dark:text-red-400">{error}</Text>
        </View>
      )}
    </View>
  );
}
