/**
 * Login Screen - TomAI 2026
 *
 * Authentication screen for parents (email) and students (username).
 */

import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { signIn, signInWithUsername, signInWithGoogle } from '@/lib/auth';

import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TomAvatar } from '@/components/common';
import { GoogleIcon } from '@/components/icons/google-icon';
import { AuthScreen } from '@/components/auth/auth-screen';
import { useThemeColors } from '@/hooks';
import { bgColors } from '@/lib/styles';

type AccountType = 'parent' | 'student';

export default function LoginScreen() {
  // Auth redirect handled by Stack.Protected in root _layout.tsx
  const colors = useThemeColors();
  const [accountType, setAccountType] = useState<AccountType>('parent');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = {
    parent: {
      label: 'Email',
      placeholder: 'marie.dupont@exemple.com',
      keyboardType: 'email-address' as const,
      autoComplete: 'email' as const,
    },
    student: {
      label: "Nom d'utilisateur",
      placeholder: 'marie_d123',
      keyboardType: 'default' as const,
      autoComplete: 'username' as const,
    },
  };

  async function handleLogin() {
    if (!identifier || !password) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (accountType === 'parent') {
        const result = await signIn(identifier, password);
        if (result.error) {
          setError('Identifiants incorrects');
          return;
        }
      } else {
        const result = await signInWithUsername(identifier, password);
        if (result.error) {
          setError('Identifiants incorrects');
          return;
        }
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
    setIdentifier('');
    setPassword('');
  }

  const currentConfig = config[accountType];

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

      {/* Account type toggle */}
      <View className="mb-6 flex-row rounded-xl bg-stone-200/50 dark:bg-stone-800/50 p-1">
        <Pressable
          onPress={() => handleAccountTypeChange('parent')}
          testID="login-toggle-parent"
          className={`flex-1 rounded-lg py-3 ${
            accountType === 'parent' ? 'bg-white dark:bg-stone-700' : ''
          }`}
        >
          <Text
            className={`text-center ${
              accountType === 'parent'
                ? 'font-semibold text-stone-800 dark:text-stone-100'
                : 'text-stone-600 dark:text-stone-400'
            }`}
          >
            Parent
          </Text>
        </Pressable>
        <Pressable
          onPress={() => handleAccountTypeChange('student')}
          testID="login-toggle-student"
          className={`flex-1 rounded-lg py-3 ${
            accountType === 'student' ? 'bg-white dark:bg-stone-700' : ''
          }`}
        >
          <Text
            className={`text-center ${
              accountType === 'student'
                ? 'font-semibold text-stone-800 dark:text-stone-100'
                : 'text-stone-600 dark:text-stone-400'
            }`}
          >
            Élève
          </Text>
        </Pressable>
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
          label={currentConfig.label}
          placeholder={currentConfig.placeholder}
          value={identifier}
          onChangeText={setIdentifier}
          keyboardType={currentConfig.keyboardType}
          autoCapitalize="none"
          autoComplete={currentConfig.autoComplete}
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

        {accountType === 'parent' && (
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable accessibilityLabel="Mot de passe oublié">
              <Text variant="small" className="text-right text-blue-600 dark:text-blue-400">
                Mot de passe oublié ?
              </Text>
            </Pressable>
          </Link>
        )}

        <Button testID="login-submit-button" onPress={handleLogin} isLoading={isLoading} className="mt-2">
          Se connecter
        </Button>
      </View>

      {/* Google OAuth - Parent only */}
      {accountType === 'parent' && (
        <>
          <View className="my-6 flex-row items-center">
            <View className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
            <Text variant="muted" className="px-4">
              ou
            </Text>
            <View className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
          </View>

          <Button variant="outline" onPress={handleGoogleLogin} disabled={isLoading}>
            <GoogleIcon size={20} />
            <Text className="font-semibold">Continuer avec Google</Text>
          </Button>
        </>
      )}

      {/* Register link - Parent only */}
      {accountType === 'parent' && (
        <View className="mt-8 flex-row justify-center">
          <Text variant="muted">Pas encore de compte ? </Text>
          <Link href="/(auth)/register" asChild>
            <Pressable accessibilityLabel="Créer un compte">
              <Text className="font-semibold text-blue-600 dark:text-blue-400">S'inscrire</Text>
            </Pressable>
          </Link>
        </View>
      )}

      {/* Info for students */}
      {accountType === 'student' && (
        <View
          className="mt-6 rounded-xl p-4"
          style={{ backgroundColor: bgColors.info[10] }}
        >
          <Text
            variant="small"
            className="text-center"
            style={{ color: colors.info }}
          >
            Ton compte a été créé par tes parents.{'\n'}
            Utilise ton nom d'utilisateur pour te connecter.
          </Text>
        </View>
      )}
    </AuthScreen>
  );
}
