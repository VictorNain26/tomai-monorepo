/**
 * AccountTypeToggle - TomAI 2026
 *
 * Toggle entre "Parent" et "Eleve" au-dessus du formulaire de login.
 * Adapte le placeholder de l'input identifiant selon le type de compte.
 */

import { View, Pressable } from 'react-native';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';

export type AccountType = 'parent' | 'student';

interface AccountTypeToggleProps {
  accountType: AccountType;
  onChange: (type: AccountType) => void;
  disabled?: boolean;
}

interface ToggleOptionProps {
  label: string;
  active: boolean;
  onPress: () => void;
  testID: string;
  accessibilityLabel: string;
  disabled?: boolean;
}

function ToggleOption({
  label,
  active,
  onPress,
  testID,
  accessibilityLabel,
  disabled,
}: ToggleOptionProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active, disabled }}
      className={cn(
        'flex-1 items-center justify-center rounded-md px-3 py-2',
        active
          ? 'bg-background shadow-sm'
          : 'bg-transparent'
      )}
      style={disabled ? { opacity: 0.5 } : undefined}
    >
      <Text
        variant="small"
        className={cn(
          'font-semibold',
          active
            ? 'text-primary'
            : 'text-muted-foreground'
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function AccountTypeToggle({
  accountType,
  onChange,
  disabled,
}: AccountTypeToggleProps) {
  return (
    <View
      className="mb-6 flex-row rounded-lg border border-border bg-muted p-1"
      accessibilityRole="tablist"
    >
      <ToggleOption
        testID="login-toggle-parent"
        label="Parent"
        active={accountType === 'parent'}
        onPress={() => onChange('parent')}
        accessibilityLabel="Se connecter en tant que parent"
        disabled={disabled}
      />
      <ToggleOption
        testID="login-toggle-student"
        label="Eleve"
        active={accountType === 'student'}
        onPress={() => onChange('student')}
        accessibilityLabel="Se connecter en tant qu'eleve"
        disabled={disabled}
      />
    </View>
  );
}
