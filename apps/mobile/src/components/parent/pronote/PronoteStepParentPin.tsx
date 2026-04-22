/**
 * PronoteStepParentPin
 *
 * Final onboarding step : parent picks (then confirms) a 4-6 digit PIN that
 * gates access to sensitive settings in the parent space. The same component
 * is reused for both entry and confirmation via the `isConfirm` flag.
 */

import { View, ScrollView, TextInput } from 'react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useThemeColors } from '@/hooks';

interface PronoteStepParentPinProps {
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  error: string | null;
  isPending: boolean;
  isConfirm: boolean;
}

export function PronoteStepParentPin({
  value,
  onChangeText,
  onSubmit,
  error,
  isPending,
  isConfirm,
}: PronoteStepParentPinProps) {
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
