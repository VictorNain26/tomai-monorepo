import { useState } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Link } from 'expo-router';
import { signIn, signInWithGoogle } from '@repo/api';

import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
        setError(result.error.message ?? 'Erreur de connexion');
        return;
      }

      // Auth successful - AuthGuard will redirect based on role
    } catch {
      setError('Erreur de connexion. Vérifiez vos identifiants.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      // Google OAuth - will open browser
      await signInWithGoogle('/auth/callback');
    } catch {
      Alert.alert('Erreur', 'Impossible de se connecter avec Google');
    }
  }

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
                Email
              </Text>
              <Input
                placeholder="votre@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
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

            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity>
                <Text variant="small" className="text-right text-primary">
                  Mot de passe oublié ?
                </Text>
              </TouchableOpacity>
            </Link>

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

          {/* Divider */}
          <View className="my-6 flex-row items-center">
            <View className="h-px flex-1 bg-border" />
            <Text variant="muted" className="px-4">
              ou
            </Text>
            <View className="h-px flex-1 bg-border" />
          </View>

          {/* Google OAuth */}
          <Button variant="outline" onPress={handleGoogleLogin}>
            <Text className="font-semibold">Continuer avec Google</Text>
          </Button>

          {/* Register link */}
          <View className="mt-8 flex-row justify-center">
            <Text variant="muted">Pas encore de compte ? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text className="font-semibold text-primary">S'inscrire</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
