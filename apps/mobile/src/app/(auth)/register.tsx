import { useState } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Link } from 'expo-router';
import { signUp } from '@/lib/auth';

import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    setError(null);

    if (!name || !email || !password || !confirmPassword) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signUp({ email, password, name });

      if (result.error) {
        setError(result.error.message ?? "Erreur lors de l'inscription");
        return;
      }

      // Registration successful - AuthGuard will handle redirect
    } catch {
      setError("Erreur lors de l'inscription. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
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
              Inscription
            </Text>
            <Text variant="muted" className="mt-2 text-center">
              Créez votre compte pour suivre la scolarité de vos enfants
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
                Nom complet
              </Text>
              <Input
                placeholder="Marie Dupont"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
                disabled={isLoading}
              />
            </View>

            <View>
              <Text variant="small" className="mb-2 font-medium">
                Email
              </Text>
              <Input
                placeholder="marie.dupont@exemple.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                disabled={isLoading}
              />
            </View>

            <View>
              <Text variant="small" className="mb-2 font-medium">
                Mot de passe
              </Text>
              <Input
                placeholder="6 caractères minimum"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                disabled={isLoading}
              />
            </View>

            <View>
              <Text variant="small" className="mb-2 font-medium">
                Confirmer le mot de passe
              </Text>
              <Input
                placeholder="Confirmez votre mot de passe"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                disabled={isLoading}
              />
            </View>

            <Button
              onPress={handleRegister}
              disabled={isLoading}
              className="mt-4"
            >
              <Text className="font-semibold text-primary-foreground">
                {isLoading ? 'Création...' : 'Créer mon compte'}
              </Text>
            </Button>
          </View>

          {/* Login link */}
          <View className="mt-8 flex-row justify-center">
            <Text variant="muted">Déjà un compte ? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="font-semibold text-primary">Se connecter</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
