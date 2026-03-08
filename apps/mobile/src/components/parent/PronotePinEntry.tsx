/**
 * PronotePinEntry Component
 *
 * PIN entry step for Pronote connection after QR scan.
 */

import { View, TouchableOpacity } from 'react-native';
import { KeyRound, School, Check, X } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useIconColors, useThemeColors } from '@/hooks';
import { bgColors, borderColors } from '@/lib/styles';

interface PronotePinEntryProps {
  establishment: string;
  pin: string;
  onPinChange: (pin: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  error: string | null;
  isPending: boolean;
}

export function PronotePinEntry({
  establishment,
  pin,
  onPinChange,
  onSubmit,
  onReset,
  error,
  isPending,
}: PronotePinEntryProps) {
  const iconColors = useIconColors();
  const colors = useThemeColors();

  return (
    <View className="flex-1 px-4 py-6">
      {/* Instructions */}
      <View className="mb-6 flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-blue-600 dark:bg-blue-400">
          <KeyRound color="white" size={20} />
        </View>
        <View className="flex-1">
          <Text className="font-semibold">Etape 2 : Entrer le code PIN</Text>
          <Text variant="muted" className="text-sm">
            Saisissez le code PIN affiche sur Pronote
          </Text>
        </View>
      </View>

      {/* QR detected confirmation */}
      <View
        className="mb-6 flex-row items-center gap-3 rounded-xl p-4"
        style={{ backgroundColor: bgColors.success[10], borderWidth: 1, borderColor: borderColors.success[20] }}
      >
        <Check color={colors.success} size={20} />
        <View className="flex-1">
          <Text className="font-semibold" style={{ color: colors.success }}>
            QR code detecte
          </Text>
          <View className="mt-1 flex-row items-center gap-2">
            <School color={colors.success} size={14} />
            <Text className="text-sm" style={{ color: colors.success }}>
              {establishment}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={onReset}
          className="rounded-full p-2"
          style={{ backgroundColor: bgColors.muted[30] }}
          accessibilityLabel="Rescanner le QR code"
        >
          <X color={iconColors.foreground} size={16} />
        </TouchableOpacity>
      </View>

      {/* PIN Input */}
      <View className="mb-6">
        <Text className="mb-2 font-medium">Code PIN a 4 chiffres</Text>
        <Input
          placeholder="0000"
          value={pin}
          onChangeText={(text) => onPinChange(text.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          maxLength={4}
          className="text-center text-2xl tracking-widest"
          autoFocus
        />
      </View>

      {/* Error message */}
      {error && (
        <View className="mb-4 rounded-xl p-4" style={{ backgroundColor: bgColors.destructive[10] }}>
          <Text className="text-center text-red-600 dark:text-red-400">{error}</Text>
        </View>
      )}

      {/* Submit Button */}
      <Button
        onPress={onSubmit}
        disabled={pin.length !== 4 || isPending}
        className="mt-auto"
      >
        <Text className="font-semibold text-white dark:text-slate-900">
          {isPending ? 'Connexion...' : 'Connecter Pronote'}
        </Text>
      </Button>

      {/* Help Text */}
      <View className="mt-6 rounded-xl bg-white dark:bg-slate-800 p-4" style={{ backgroundColor: bgColors.muted[50] }}>
        <Text variant="muted" className="text-center text-sm">
          Le code PIN est affiche sur l'ecran Pronote apres le QR code.
          {'\n'}Il expire apres quelques minutes.
        </Text>
      </View>
    </View>
  );
}
