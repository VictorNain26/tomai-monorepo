/**
 * Login Screen - TomAI 2026
 *
 * Parent + Eleve authentication (email/password + Google OAuth).
 * Children access the app via profile selection after parent connects Pronote.
 */

import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { signIn, signInWithGoogle } from '@/lib/auth';

import { Text } from '@/components/ui/text';
import { TomAvatar } from '@/components/common';
import { AuthScreen } from '@/components/auth/auth-screen';
import {
  AccountTypeToggle,
  type AccountType,
} from '@/components/auth/AccountTypeToggle';
import { LoginForm } from '@/components/auth/LoginForm';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

export default function LoginScreen() {
  const [accountType, setAccountType] = useState<AccountType>('parent');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!identifier || !password) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn(identifier, password);
      if (result.error) {
        setError('Identifiants incorrects');
      }
      // Stack.Protected auto-redirects when session becomes available
    } catch (err) {
      console.error('[Login] Login failed:', err);
      setError('Erreur de connexion. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await signInWithGoogle();
      if (result === null) return; // User cancelled
      if (result?.error) {
        setError(result.error.message ?? 'Impossible de se connecter avec Google');
      }
    } catch (err) {
      console.error('[Login] Google OAuth failed:', err);
      setError('Impossible de se connecter avec Google');
    } finally {
      setIsLoading(false);
    }
  }

  function handleAccountTypeChange(type: AccountType) {
    setAccountType(type);
    setError(null);
  }

  return (
    <AuthScreen>
      <View className="mb-8 items-center">
        <TomAvatar size="lg" className="mb-4" />
        <Text variant="h1" className="text-center text-blue-600 dark:text-blue-400">
          Tom
        </Text>
        <Text variant="muted" className="mt-2 text-center">
          Connectez-vous pour continuer
        </Text>
      </View>

      <AccountTypeToggle
        accountType={accountType}
        onChange={handleAccountTypeChange}
        disabled={isLoading}
      />

      <LoginForm
        accountType={accountType}
        identifier={identifier}
        onIdentifierChange={setIdentifier}
        password={password}
        onPasswordChange={setPassword}
        onSubmit={handleLogin}
        isLoading={isLoading}
        errorMessage={error}
      />

      <GoogleSignInButton onPress={handleGoogleLogin} isLoading={isLoading} />

      <View className="mt-8 flex-row justify-center">
        <Text variant="muted">Pas encore de compte ? </Text>
        <Link href="/(auth)/register" asChild>
          <Pressable accessibilityLabel="Créer un compte">
            <Text className="font-semibold text-blue-600 dark:text-blue-400">
              S'inscrire
            </Text>
          </Pressable>
        </Link>
      </View>
    </AuthScreen>
  );
}
