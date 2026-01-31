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
  Alert,
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
import { useTheme } from '@/hooks';
import { bgColors, colors, shadows } from '@/lib/styles';

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
          setError(result.error.message ?? 'Email ou mot de passe incorrect');
          return;
        }
      } else {
        const result = await signInWithUsername(identifier, password);
        if (result.error) {
          setError(result.error.message ?? "Nom d'utilisateur ou mot de passe incorrect");
          return;
        }
      }
      // Login successful - redirect to home which handles role-based routing
      router.replace('/');
    } catch {
      setError('Erreur de connexion. Vérifiez vos identifiants.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      await signInWithGoogle();
    } catch {
      Alert.alert('Erreur', 'Impossible de se connecter avec Google');
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
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-6 py-12">
          {/* Header */}
          <View className="mb-8 items-center">
            <TomAvatar size="lg" className="mb-4" />
            <Text variant="h1" className="text-center text-primary">
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
                    ? 'text-foreground'
                    : 'text-muted-foreground'
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
                    ? 'text-foreground'
                    : 'text-muted-foreground'
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
            >
              <Text className="text-center text-destructive">{error}</Text>
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
                  <TouchableOpacity>
                    <Text variant="small" className="text-right text-primary">
                      Mot de passe oublié ?
                    </Text>
                  </TouchableOpacity>
                </Link>
              )}

              <Button onPress={handleLogin} disabled={isLoading} className="mt-2">
                <Text className="font-semibold text-primary-foreground">
                  {isLoading ? 'Connexion...' : 'Se connecter'}
                </Text>
              </Button>
            </View>
          </Card>

          {/* Google OAuth - Parent only */}
          {accountType === 'parent' && (
            <>
              <View className="my-6 flex-row items-center">
                <View className="h-px flex-1 bg-border" />
                <Text variant="muted" className="px-4">
                  ou
                </Text>
                <View className="h-px flex-1 bg-border" />
              </View>

              <Button variant="outline" onPress={handleGoogleLogin}>
                <Text className="font-semibold">Continuer avec Google</Text>
              </Button>
            </>
          )}

          {/* Register link - Parent only */}
          {accountType === 'parent' && (
            <View className="mt-8 flex-row justify-center">
              <Text variant="muted">Pas encore de compte ? </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text className="font-semibold text-primary">S'inscrire</Text>
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
                style={{ color: colors.info.DEFAULT }}
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
