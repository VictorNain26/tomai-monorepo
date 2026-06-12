/**
 * ChildPinSetup Component
 *
 * Sequential PIN/password setup for each imported child.
 * Includes school level picker if inference fails.
 */

import { useState, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { School, ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useThemeColors } from '@/hooks';
import { bgColors, borderColors } from '@/lib/styles';
import { LEVEL_LABELS, type EducationLevelType } from '@/constants/levels';
import { inferSchoolLevel } from '@/lib/infer-school-level';
import type { PronoteResource } from '@/services/pronote/pronote-types';

// ============================================================================
// TYPES
// ============================================================================

interface ChildPinSetupProps {
  resource: PronoteResource;
  index: number;
  total: number;
  onComplete: (data: {
    resource: PronoteResource;
    schoolLevel: EducationLevelType;
    pinType: 'pin' | 'password';
    pinValue: string;
  }) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LEVEL_GROUPS: { title: string; levels: EducationLevelType[] }[] = [
  { title: 'Primaire', levels: ['cp', 'ce1', 'ce2', 'cm1', 'cm2'] },
  { title: 'Collège', levels: ['sixieme', 'cinquieme', 'quatrieme', 'troisieme'] },
  { title: 'Lycée', levels: ['seconde', 'premiere', 'terminale'] },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function ChildPinSetup({
  resource,
  index,
  total,
  onComplete,
}: ChildPinSetupProps) {
  const colors = useThemeColors();

  const inferred = resource.className ? inferSchoolLevel(resource.className) : null;

  const [schoolLevel, setSchoolLevel] = useState<EducationLevelType | null>(inferred);
  const [showLevelPicker, setShowLevelPicker] = useState(inferred === null);
  const [pinType, setPinType] = useState<'pin' | 'password'>('pin');
  const [pinValue, setPinValue] = useState('');
  const [confirmValue, setConfirmValue] = useState('');

  const isLast = index === total - 1;

  const minLength = pinType === 'pin' ? 4 : 6;
  const mismatch = confirmValue.length > 0 && pinValue !== confirmValue;
  const canSubmit =
    schoolLevel !== null &&
    pinValue.length >= minLength &&
    pinValue === confirmValue;

  const handlePinTypeChange = useCallback((type: 'pin' | 'password') => {
    setPinType(type);
    setPinValue('');
    setConfirmValue('');
  }, []);

  const handleComplete = useCallback(() => {
    if (!canSubmit || schoolLevel === null) return;
    onComplete({ resource, schoolLevel, pinType, pinValue });
  }, [canSubmit, schoolLevel, resource, pinType, pinValue, onComplete]);

  return (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View className="px-4 py-6 gap-6">
        {/* Progress */}
        <View className="flex-row items-center justify-between">
          <Text variant="muted" className="text-sm">
            Enfant {index + 1} / {total}
          </Text>
          <View className="flex-row gap-1">
            {Array.from({ length: total }, (_, i) => (
              <View
                key={i}
                className="h-1.5 w-6 rounded-full"
                style={{
                  backgroundColor:
                    i <= index ? colors.primary : colors.border,
                }}
              />
            ))}
          </View>
        </View>

        {/* Child info */}
        <View
          className="flex-row items-center gap-3 rounded-xl p-4"
          style={{ backgroundColor: bgColors.primary[10] }}
        >
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: bgColors.primary[20] }}
          >
            <School color={colors.primary} size={20} />
          </View>
          <View className="flex-1">
            <Text className="font-semibold">{resource.name}</Text>
            {resource.className && (
              <Text variant="muted" className="text-sm">{resource.className}</Text>
            )}
          </View>
        </View>

        {/* School level section */}
        <View>
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="font-medium">Niveau scolaire</Text>
            {inferred !== null && (
              <TouchableOpacity onPress={() => setShowLevelPicker((v) => !v)}>
                <Text className="text-sm" style={{ color: colors.primary }}>
                  {showLevelPicker ? 'Masquer' : 'Modifier'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {schoolLevel !== null && !showLevelPicker ? (
            <View
              className="flex-row items-center justify-between rounded-xl border px-4 py-3"
              style={{ borderColor: borderColors.primary[20], backgroundColor: bgColors.primary[5] }}
            >
              <Text className="font-semibold" style={{ color: colors.primary }}>
                {LEVEL_LABELS[schoolLevel]}
              </Text>
              <ChevronRight color={colors.primary} size={16} />
            </View>
          ) : null}

          {showLevelPicker && (
            <View className="mt-2 gap-4">
              {LEVEL_GROUPS.map((group) => (
                <View key={group.title}>
                  <Text variant="muted" className="mb-2 text-xs font-semibold uppercase tracking-wider">
                    {group.title}
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {group.levels.map((level) => {
                      const isSelected = schoolLevel === level;
                      return (
                        <TouchableOpacity
                          key={level}
                          onPress={() => {
                            setSchoolLevel(level);
                            setShowLevelPicker(false);
                          }}
                          className="rounded-lg border px-3 py-2"
                          style={{
                            borderColor: isSelected
                              ? colors.primary
                              : colors.border,
                            backgroundColor: isSelected
                              ? bgColors.primary[10]
                              : undefined,
                          }}
                          activeOpacity={0.7}
                        >
                          <Text
                            className="text-sm font-medium"
                            style={{ color: isSelected ? colors.primary : colors.foreground }}
                          >
                            {LEVEL_LABELS[level]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* PIN type toggle */}
        <View>
          <Text className="mb-2 font-medium">Type de protection</Text>
          <View className="flex-row gap-3">
            {(['pin', 'password'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => handlePinTypeChange(type)}
                className="flex-1 items-center rounded-xl border py-3"
                style={{
                  borderColor: pinType === type ? colors.primary : colors.border,
                  backgroundColor: pinType === type ? bgColors.primary[10] : undefined,
                }}
                activeOpacity={0.7}
              >
                <Text
                  className="font-medium"
                  style={{ color: pinType === type ? colors.primary : colors.foreground }}
                >
                  {type === 'pin' ? 'Code PIN' : 'Mot de passe'}
                </Text>
                <Text
                  variant="muted"
                  className="mt-0.5 text-xs"
                >
                  {type === 'pin' ? '4–6 chiffres' : '6+ caractères'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* PIN input */}
        <View>
          <Text className="mb-2 font-medium">
            {pinType === 'pin' ? 'Code PIN' : 'Mot de passe'}
          </Text>
          <TextInput
            value={pinValue}
            onChangeText={setPinValue}
            secureTextEntry
            keyboardType={pinType === 'pin' ? 'numeric' : 'default'}
            maxLength={pinType === 'pin' ? 6 : 50}
            placeholder={pinType === 'pin' ? '• • • •' : '••••••••'}
            placeholderTextColor={colors.mutedForeground}
            className="rounded-xl border bg-card px-4 py-4 text-center text-xl tracking-widest text-foreground"
            style={{ borderColor: colors.border }}
            autoFocus
          />
        </View>

        {/* Confirm input */}
        <View>
          <Text className="mb-2 font-medium">Confirmer</Text>
          <TextInput
            value={confirmValue}
            onChangeText={setConfirmValue}
            secureTextEntry
            keyboardType={pinType === 'pin' ? 'numeric' : 'default'}
            maxLength={pinType === 'pin' ? 6 : 50}
            placeholder={pinType === 'pin' ? '• • • •' : '••••••••'}
            placeholderTextColor={colors.mutedForeground}
            className="rounded-xl border bg-card px-4 py-4 text-center text-xl tracking-widest text-foreground"
            style={{
              borderColor: mismatch ? colors.destructive : colors.border,
            }}
            onSubmitEditing={canSubmit ? handleComplete : undefined}
          />
          {mismatch && (
            <Text className="mt-2 text-sm text-destructive">
              Les codes ne correspondent pas
            </Text>
          )}
        </View>

        {/* Submit */}
        <Button
          onPress={handleComplete}
          disabled={!canSubmit}
          className="mt-2"
        >
          <Text className="font-semibold text-primary-foreground">
            {isLast ? 'Terminer' : 'Suivant'}
          </Text>
        </Button>
      </View>
    </ScrollView>
  );
}
