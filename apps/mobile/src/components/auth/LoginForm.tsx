/**
 * LoginForm - TomAI 2026
 *
 * Formulaire identifiant/mot de passe + bouton submit + lien mot de passe oublie
 * + message d'erreur. Le label/placeholder de l'identifiant s'adapte au type de compte.
 */

import { View, Pressable } from 'react-native';
import { Link } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { bgColors } from '@/lib/styles';
import type { AccountType } from './AccountTypeToggle';

interface LoginFormProps {
  accountType: AccountType;
  identifier: string;
  onIdentifierChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  errorMessage: string | null;
}

export function LoginForm({
  accountType,
  identifier,
  onIdentifierChange,
  password,
  onPasswordChange,
  onSubmit,
  isLoading,
  errorMessage,
}: LoginFormProps) {
  const isStudent = accountType === 'student';
  const identifierLabel = isStudent ? 'Identifiant' : 'Email';
  const identifierPlaceholder = isStudent
    ? 'ton.identifiant'
    : 'marie.dupont@exemple.com';

  return (
    <>
      {errorMessage && (
        <View
          testID="login-error-message"
          className="mb-4 rounded-xl p-3"
          style={{ backgroundColor: bgColors.destructive[10] }}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Text className="text-center text-destructive">
            {errorMessage}
          </Text>
        </View>
      )}

      <View className="gap-4">
        <Input
          testID="login-identifier-input"
          label={identifierLabel}
          placeholder={identifierPlaceholder}
          value={identifier}
          onChangeText={onIdentifierChange}
          keyboardType={isStudent ? 'default' : 'email-address'}
          autoCapitalize="none"
          autoComplete={isStudent ? 'username' : 'email'}
          disabled={isLoading}
        />

        <Input
          testID="login-password-input"
          label="Mot de passe"
          placeholder="Votre mot de passe"
          value={password}
          onChangeText={onPasswordChange}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
          disabled={isLoading}
        />

        <Link href="/(auth)/forgot-password" asChild>
          <Pressable accessibilityLabel="Mot de passe oublié">
            <Text
              variant="small"
              className="text-right text-primary"
            >
              Mot de passe oublié ?
            </Text>
          </Pressable>
        </Link>

        <Button
          testID="login-submit-button"
          onPress={onSubmit}
          isLoading={isLoading}
          className="mt-2"
        >
          Se connecter
        </Button>
      </View>
    </>
  );
}
