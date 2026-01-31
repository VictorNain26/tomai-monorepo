/**
 * Register Screen - TomAI 2026
 *
 * Parent registration screen.
 */

import { useState } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { signUp } from '@/lib/auth';

import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TomAvatar } from '@/components/common';
import { bgColors, shadows } from '@/lib/styles';

export default function RegisterScreen() {
  const router = useRouter();
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

      // Registration successful - redirect to home which handles role-based routing
      router.replace('/');
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
          <View className="mb-8 items-center">
            <TomAvatar size="lg" className="mb-4" />
            <Text variant="h1" className="text-center text-primary">
              Inscription
            </Text>
            <Text variant="muted" className="mt-2 text-center px-4">
              Créez votre compte pour suivre la scolarité de vos enfants
            </Text>
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
                label="Nom complet"
                placeholder="Marie Dupont"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
                disabled={isLoading}
              />

              <Input
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
                label="Mot de passe"
                placeholder="6 caractères minimum"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                disabled={isLoading}
              />

              <Input
                label="Confirmer le mot de passe"
                placeholder="Confirmez votre mot de passe"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                disabled={isLoading}
              />

              <Button
                onPress={handleRegister}
                disabled={isLoading}
                className="mt-2"
              >
                <Text className="font-semibold text-primary-foreground">
                  {isLoading ? 'Création...' : 'Créer mon compte'}
                </Text>
              </Button>
            </View>
          </Card>

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
