/**
 * Register Screen - TomAI 2026
 *
 * Parent registration screen.
 */

import { useState, useEffect } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { signUp, signInWithGoogle, useSession } from '@/lib/auth';

import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TomAvatar } from '@/components/common';
import { bgColors, shadows } from '@/lib/styles';

export default function RegisterScreen() {
  const router = useRouter();
  const { data: session } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect when session becomes available (handles OAuth callback)
  useEffect(() => {
    if (session?.user) {
      router.replace('/');
    }
  }, [session, router]);

  async function handleGoogleRegister() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await signInWithGoogle();
      if (result === null) return; // User cancelled
      if (result?.error) {
        setError(result.error.message ?? 'Impossible de se connecter avec Google');
      }
    } catch (err) {
      console.error('[Register] Google OAuth failed:', err);
      setError("Impossible de s'inscrire avec Google");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegister() {
    setError(null);

    if (!name || !email || !password || !confirmPassword) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Adresse email invalide');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError('Le mot de passe doit contenir une majuscule');
      return;
    }

    if (!/[a-z]/.test(password)) {
      setError('Le mot de passe doit contenir une minuscule');
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError('Le mot de passe doit contenir un chiffre');
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
    } catch (err) {
      console.error('[Register] Registration failed:', err);
      setError("Erreur lors de l'inscription. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  }

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
                placeholder="8 caractères, majuscule, chiffre"
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
                <Text className="font-semibold text-white dark:text-slate-900">
                  {isLoading ? 'Création...' : 'Créer mon compte'}
                </Text>
              </Button>
            </View>
          </Card>

          {/* Google OAuth */}
          <View className="my-6 flex-row items-center">
            <View className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            <Text variant="muted" className="px-4">
              ou
            </Text>
            <View className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </View>

          <Button variant="outline" onPress={handleGoogleRegister} disabled={isLoading}>
            <Text className="font-semibold">Continuer avec Google</Text>
          </Button>

          {/* Login link */}
          <View className="mt-8 flex-row justify-center">
            <Text variant="muted">Déjà un compte ? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="font-semibold text-blue-600 dark:text-blue-400">Se connecter</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
