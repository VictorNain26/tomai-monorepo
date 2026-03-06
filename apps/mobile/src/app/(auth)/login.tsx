/**
 * Login Screen - TomAI 2026
 *
 * Authentication screen for parents (email) and students (username).
 */

import { useState, useEffect } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { signIn, signInWithUsername, signInWithGoogle, useSession } from '@/lib/auth';

import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TomAvatar } from '@/components/common';
import { useTheme, useThemeColors } from '@/hooks';
import { bgColors, shadows } from '@/lib/styles';

// Card colors for segmented control
const CARD_COLORS = {
  light: '#FFFFFF',
  dark: '#374151', // colors.card dark
};

type AccountType = 'parent' | 'student';

export default function LoginScreen() {
  const router = useRouter();
  const { data: session } = useSession();
  const { isDark } = useTheme();
  const colors = useThemeColors();
  const [accountType, setAccountType] = useState<AccountType>('parent');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect when session becomes available (handles OAuth callback and email login)
  useEffect(() => {
    if (session?.user) {
      router.replace('/');
    }
  }, [session, router]);

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
      // Login successful - redirect to home which handles role-based routing
      router.replace('/');
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-50 dark:bg-slate-900"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-6 py-12">
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
          <View
            className="mb-6 flex-row rounded-xl p-1"
            style={{ backgroundColor: bgColors.muted[50] }}
          >
            <Pressable
              onPress={() => handleAccountTypeChange('parent')}
              className="flex-1 rounded-lg py-3"
              style={
                accountType === 'parent'
                  ? [shadows.xs, { backgroundColor: isDark ? CARD_COLORS.dark : CARD_COLORS.light }]
                  : undefined
              }
            >
              <Text
                className={`text-center font-medium ${
                  accountType === 'parent'
                    ? 'text-slate-800 dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Parent
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleAccountTypeChange('student')}
              className="flex-1 rounded-lg py-3"
              style={
                accountType === 'student'
                  ? [shadows.xs, { backgroundColor: isDark ? CARD_COLORS.dark : CARD_COLORS.light }]
                  : undefined
              }
            >
              <Text
                className={`text-center font-medium ${
                  accountType === 'student'
                    ? 'text-slate-800 dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Élève
              </Text>
            </Pressable>
          </View>

          {/* Error message */}
          {error && (
            <View
              className="mb-4 rounded-xl p-3"
              style={{ backgroundColor: bgColors.destructive[10] }}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              <Text className="text-center text-red-600 dark:text-red-400">{error}</Text>
            </View>
          )}

          {/* Form */}
          <Card style={shadows.sm}>
            <View className="gap-4 p-4">
              <Input
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
                  <TouchableOpacity accessibilityLabel="Mot de passe oublié">
                    <Text variant="small" className="text-right text-blue-600 dark:text-blue-400">
                      Mot de passe oublié ?
                    </Text>
                  </TouchableOpacity>
                </Link>
              )}

              <Button onPress={handleLogin} disabled={isLoading} className="mt-2">
                <Text className="font-semibold text-white dark:text-slate-900">
                  {isLoading ? 'Connexion...' : 'Se connecter'}
                </Text>
              </Button>
            </View>
          </Card>

          {/* Google OAuth - Parent only */}
          {accountType === 'parent' && (
            <>
              <View className="my-6 flex-row items-center">
                <View className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                <Text variant="muted" className="px-4">
                  ou
                </Text>
                <View className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              </View>

              <Button variant="outline" onPress={handleGoogleLogin} disabled={isLoading}>
                <Text className="font-semibold">Continuer avec Google</Text>
              </Button>
            </>
          )}

          {/* Register link - Parent only */}
          {accountType === 'parent' && (
            <View className="mt-8 flex-row justify-center">
              <Text variant="muted">Pas encore de compte ? </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity accessibilityLabel="Créer un compte">
                  <Text className="font-semibold text-blue-600 dark:text-blue-400">S'inscrire</Text>
                </TouchableOpacity>
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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
