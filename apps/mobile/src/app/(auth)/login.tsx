import { useState } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Link } from 'expo-router';
import { signIn, signInWithUsername, signInWithGoogle } from '@/lib/auth';

import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type AccountType = 'parent' | 'student';

export default function LoginScreen() {
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
        // Parent: email login with Better Auth
        const result = await signIn(identifier, password);

        if (result.error) {
          setError(result.error.message ?? 'Email ou mot de passe incorrect');
          return;
        }
        // Auth successful - AuthGuard will redirect
      } else {
        // Student: username login with Better Auth
        const result = await signInWithUsername(identifier, password);

        if (result.error) {
          setError(result.error.message ?? "Nom d'utilisateur ou mot de passe incorrect");
          return;
        }
        // Auth successful - AuthGuard will redirect
      }
    } catch {
      setError('Erreur de connexion. Vérifiez vos identifiants.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      // expoClient handles the callback automatically via deep link
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
          <View className="mb-8">
            <Text variant="h1" className="text-center text-primary">
              TomIA
            </Text>
            <Text variant="muted" className="mt-2 text-center">
              Connectez-vous pour continuer
            </Text>
          </View>

          {/* Account type toggle */}
          <View className="mb-6 flex-row rounded-lg bg-muted p-1">
            <Pressable
              onPress={() => handleAccountTypeChange('parent')}
              className={`flex-1 rounded-md py-2 ${
                accountType === 'parent' ? 'bg-background shadow-sm' : ''
              }`}
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
              className={`flex-1 rounded-md py-2 ${
                accountType === 'student' ? 'bg-background shadow-sm' : ''
              }`}
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
            <View className="mb-4 rounded-md bg-destructive/10 p-3">
              <Text className="text-center text-destructive">{error}</Text>
            </View>
          )}

          {/* Form */}
          <View className="gap-4">
            <View>
              <Text variant="small" className="mb-2 font-medium">
                {currentConfig.label}
              </Text>
              <Input
                placeholder={currentConfig.placeholder}
                value={identifier}
                onChangeText={setIdentifier}
                keyboardType={currentConfig.keyboardType}
                autoCapitalize="none"
                autoComplete={currentConfig.autoComplete}
                editable={!isLoading}
              />
            </View>

            <View>
              <Text variant="small" className="mb-2 font-medium">
                Mot de passe
              </Text>
              <Input
                placeholder="Votre mot de passe"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                editable={!isLoading}
              />
            </View>

            {accountType === 'parent' && (
              <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity>
                  <Text variant="small" className="text-right text-primary">
                    Mot de passe oublié ?
                  </Text>
                </TouchableOpacity>
              </Link>
            )}

            <Button
              onPress={handleLogin}
              disabled={isLoading}
              className="mt-2"
            >
              <Text className="font-semibold text-primary-foreground">
                {isLoading ? 'Connexion...' : 'Se connecter'}
              </Text>
            </Button>
          </View>

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
            <View className="mt-8">
              <Text variant="muted" className="text-center text-sm">
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
