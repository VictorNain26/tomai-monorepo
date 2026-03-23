/**
 * Login Screen - TomAI 2026
 *
 * Parent-only authentication (email/password + Google OAuth).
 * Children access the app via profile selection after parent connects Pronote.
 */

import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { signIn, signInWithGoogle } from '@/lib/auth';

import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TomAvatar } from '@/components/common';
import { GoogleIcon } from '@/components/icons/google-icon';
import { AuthScreen } from '@/components/auth/auth-screen';
import { bgColors } from '@/lib/styles';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email || !password) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn(email, password);
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
      console.log('[Login] Google result:', JSON.stringify(result, null, 2));
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

  return (
    <AuthScreen>
      {/* Header */}
      <View className="mb-8 items-center">
        <TomAvatar size="lg" className="mb-4" />
        <Text variant="h1" className="text-center text-blue-600 dark:text-blue-400">
          Tom
        </Text>
        <Text variant="muted" className="mt-2 text-center">
          Connectez-vous pour continuer
        </Text>
      </View>

      {/* Error message */}
      {error && (
        <View
          testID="login-error-message"
          className="mb-4 rounded-xl p-3"
          style={{ backgroundColor: bgColors.destructive[10] }}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Text className="text-center text-red-600 dark:text-red-400">{error}</Text>
        </View>
      )}

      {/* Form */}
      <View className="gap-4">
        <Input
          testID="login-identifier-input"
          label="Email"
          placeholder="marie.dupont@exemple.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          disabled={isLoading}
        />

        <Input
          testID="login-password-input"
          label="Mot de passe"
          placeholder="Votre mot de passe"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
          disabled={isLoading}
        />

        <Link href="/(auth)/forgot-password" asChild>
          <Pressable accessibilityLabel="Mot de passe oublié">
            <Text variant="small" className="text-right text-blue-600 dark:text-blue-400">
              Mot de passe oublié ?
            </Text>
          </Pressable>
        </Link>

        <Button testID="login-submit-button" onPress={handleLogin} isLoading={isLoading} className="mt-2">
          Se connecter
        </Button>
      </View>

      {/* Google OAuth */}
      <View className="my-6 flex-row items-center">
        <View className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
        <Text variant="muted" className="px-4">ou</Text>
        <View className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
      </View>

      <Button variant="outline" onPress={handleGoogleLogin} disabled={isLoading}>
        <GoogleIcon size={20} />
        <Text className="font-semibold">Continuer avec Google</Text>
      </Button>

      {/* Register link */}
      <View className="mt-8 flex-row justify-center">
        <Text variant="muted">Pas encore de compte ? </Text>
        <Link href="/(auth)/register" asChild>
          <Pressable accessibilityLabel="Créer un compte">
            <Text className="font-semibold text-blue-600 dark:text-blue-400">S'inscrire</Text>
          </Pressable>
        </Link>
      </View>
    </AuthScreen>
  );
}
