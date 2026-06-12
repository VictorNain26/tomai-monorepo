import { useState } from 'react';
import { View, TextInput, Animated } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { bgColors } from '@/lib/styles';
import { useThemeColors } from '@/hooks';

interface PinPromptProps {
  name: string;
  type: 'pin' | 'password';
  onSubmit: (value: string) => Promise<boolean>;
  onCancel: () => void;
}

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30_000;

export function PinPrompt({ name, type, onSubmit, onCancel }: PinPromptProps) {
  const colors = useThemeColors();
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  // useState instead of useRef: Animated.Value is stable and can be read during render
  const [shakeAnim] = useState(() => new Animated.Value(0));

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }

  async function handleSubmit() {
    if (locked || !value) return;

    const valid = await onSubmit(value);
    if (valid) return;

    setError(true);
    setValue('');
    shake();

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    if (newAttempts >= MAX_ATTEMPTS) {
      setLocked(true);
      setTimeout(() => {
        setLocked(false);
        setAttempts(0);
      }, LOCK_DURATION_MS);
    }
  }

  return (
    <View className="flex-1 items-center justify-center bg-background px-8">
      <Text variant="h3" className="mb-6">
        {type === 'pin' ? `Code de ${name}` : `Mot de passe de ${name}`}
      </Text>

      <Animated.View style={{ transform: [{ translateX: shakeAnim }] }} className="w-full max-w-xs">
        <TextInput
          value={value}
          onChangeText={(text) => { setValue(text); setError(false); }}
          secureTextEntry
          keyboardType={type === 'pin' ? 'numeric' : 'default'}
          maxLength={type === 'pin' ? 6 : 50}
          autoFocus
          editable={!locked}
          onSubmitEditing={handleSubmit}
          className="rounded-xl border border-border bg-card px-4 py-4 text-center text-2xl tracking-widest text-foreground"
          placeholderTextColor={colors.mutedForeground}
          placeholder={type === 'pin' ? '• • • •' : '••••••••'}
        />
      </Animated.View>

      {error && (
        <Text className="mt-3 text-destructive text-sm">
          Code incorrect{attempts >= 3 ? ` (${MAX_ATTEMPTS - attempts} essai(s) restant(s))` : ''}
        </Text>
      )}

      {locked && (
        <View className="mt-3 rounded-lg px-4 py-2" style={{ backgroundColor: bgColors.destructive[10] }}>
          <Text className="text-destructive text-sm text-center">
            Trop de tentatives. Réessayez dans 30 secondes.
          </Text>
        </View>
      )}

      <View className="mt-8 flex-row gap-4">
        <Button variant="outline" onPress={onCancel}>
          <Text>Annuler</Text>
        </Button>
        <Button onPress={handleSubmit} disabled={!value || locked}>
          <Text className="text-primary-foreground">Valider</Text>
        </Button>
      </View>
    </View>
  );
}
