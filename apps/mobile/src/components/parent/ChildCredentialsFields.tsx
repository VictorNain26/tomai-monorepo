/**
 * ChildCredentialsFields — shared controlled component for child credential fields.
 *
 * Renders: username input, password input (with strength indicator), school level picker.
 * Used by add-child screen (manual creation) and the Pronote wizard (Task 13).
 *
 * Props:
 *   username, password, schoolLevel  — controlled values
 *   onChange(field, value)           — field update callback
 *   errors                           — field-level error messages (username, password, schoolLevel)
 */

import { View } from 'react-native';

import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { LevelPicker } from '@/app/(parent)/add-child-level-picker';
import { passwordStrength } from '@/lib/child-credential-validators';
import type { EducationLevelType } from '@/constants/levels';

// ============================================================================
// TYPES
// ============================================================================

export interface ChildCredentialsErrors {
  username?: string;
  password?: string;
  schoolLevel?: string;
}

export interface ChildCredentialsFieldsProps {
  username: string;
  password: string;
  schoolLevel: EducationLevelType;
  onChange: (field: 'username' | 'password' | 'schoolLevel', value: string) => void;
  errors: ChildCredentialsErrors;
}

// ============================================================================
// PASSWORD STRENGTH BAR
// ============================================================================

function PasswordStrengthBar({ password }: { password: string }) {
  if (!password) return null;
  const strength = passwordStrength(password);
  const label =
    strength === 'weak' ? 'Faible' : strength === 'medium' ? 'Moyen' : 'Fort';
  const barClass =
    strength === 'weak'
      ? 'bg-destructive'
      : strength === 'medium'
        ? 'bg-warning'
        : 'bg-success';
  const width = strength === 'weak' ? 'w-1/3' : strength === 'medium' ? 'w-2/3' : 'w-full';

  return (
    <View className="mt-1 gap-1" testID={`password-strength-${strength}`}>
      <View className="h-1 w-full rounded-full bg-muted">
        <View className={`h-1 rounded-full ${barClass} ${width}`} />
      </View>
      <Text variant="tiny">{`Force : ${label}`}</Text>
    </View>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ChildCredentialsFields({
  username,
  password,
  schoolLevel,
  onChange,
  errors,
}: ChildCredentialsFieldsProps) {
  return (
    <View className="gap-6">
      {/* Username */}
      <Input
        label="Identifiant"
        placeholder="ex. alice.dupont (min. 3 caractères)"
        value={username}
        onChangeText={(v) => onChange('username', v)}
        variant={errors.username ? 'error' : 'default'}
        errorMessage={errors.username}
        accessibilityLabel="Identifiant de connexion de l'enfant"
        autoCapitalize="none"
        autoCorrect={false}
        testID="credentials-username"
      />

      {/* Password */}
      <View className="gap-1">
        <Input
          label="Mot de passe"
          placeholder="min. 8 caractères"
          value={password}
          onChangeText={(v) => onChange('password', v)}
          variant={errors.password ? 'error' : 'default'}
          errorMessage={errors.password}
          accessibilityLabel="Mot de passe de l'enfant"
          secureTextEntry
          testID="credentials-password"
        />
        <PasswordStrengthBar password={password} />
      </View>

      {/* School level */}
      <LevelPicker
        value={schoolLevel}
        onChange={(v) => onChange('schoolLevel', v)}
      />
    </View>
  );
}
